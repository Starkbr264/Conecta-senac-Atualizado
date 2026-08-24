/*
 * storage.ts
 * Camada de dados do MOBILE — sincronizada com o servidor central.
 *
 * Como funciona:
 *   - AsyncStorage continua sendo o cache local (funciona offline).
 *   - O SERVIdOR é a fonte da verdade. Ao iniciar (initDados), o app:
 *       1) envia apenas as ALTERAÇÕES LOCAIS pendentes (dirty tracking);
 *       2) baixa o banco completo (/api/dados) e passa a usá-lo como
 *          fonte da verdade local.
 *   - Toda escrita local (CRUD) marca o registro como "sujo" e dispara o
 *     envio ao servidor em background (best-effort). Exclusões são
 *     propagadas via /api/sinc com a lista de ids removidos.
 *   - Assim o que é alterado no WEB aparece no MOBILE e vice-versa, sem que
 *     um cliente sobrescreva o banco central com dados de seed divergentes.
 *
 * Estrutura:
 *   K            — chaves do AsyncStorage
 *   CACHE        — espelho em memória (lido pelas telas)
 *   ESTADO_SYNC  — registros sujos + remoções pendentes de envio
 *   seed()       — dados iniciais locais (só se nunca houve dados)
 *   _sync()      — sincronização completa com o servidor
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Usuario, Unidade, Sala, Turma, Reserva, Chave,
  Solicitacao, Notificacao, Sessao, Turno, DiaSemana, StatusTurma
} from '@/types';
import { buscarDados, enviarAlteracoes, loginApi, resetarApi } from '@/services/api';

// Chaves do AsyncStorage
const K = {
  usuarios:     '@sn_usuarios',
  unidades:     '@sn_unidades',
  salas:        '@sn_salas',
  turmas:       '@sn_turmas',
  reservas:     '@sn_reservas',
  chaves:       '@sn_chaves',
  notificacoes: '@sn_notificacoes',
  solicitacoes: '@sn_solicitacoes',
  sessao:       '@sn_sessao',
  sync:         '@sn_sync_v1',
  init:         '@sn_init_v2',
};

// Versão atual da semente local. Ao mudar esta versão, o app re-executa o
// seed uma vez, corrigindo instalações antigas que usavam um seed divergente
// do servidor (ex.: 5 unidades com IDs trocados).
const INIT_VERSION = 'v2';

// Cache em memoria — carregado uma vez no boot
type Cache = {
  usuarios: Usuario[]; unidades: Unidade[]; salas: Sala[]; turmas: Turma[];
  reservas: Reserva[]; chaves: Chave[]; notificacoes: Notificacao[];
  solicitacoes: Solicitacao[];
};

const CACHE: Cache = {
  usuarios: [], unidades: [], salas: [], turmas: [],
  reservas: [], chaves: [], notificacoes: [], solicitacoes: [],
};

// Estado de sincronização: registros alterados/criados (dirty) e ids removidos
// localmente que ainda não foram propagados ao servidor.
type EstadoSync = {
  dirty: Record<string, number[]>;
  remocoes: Record<string, number[]>;
};

const ESTADO_SYNC: EstadoSync = { dirty: {}, remocoes: {} };

let loaded = false;
let loadingPromise: Promise<void> | null = null;
let syncLoaded = false;

// Nome das colecoes no mesmo formato usado pelo servidor
const COLECOES = ['usuarios', 'unidades', 'salas', 'turmas', 'reservas', 'chaves', 'notificacoes', 'solicitacoes'] as const;

const DIAS_VALIDOS: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

// Limite acima de todos os ids fixos do seed (max 10001). Registros criados
// localmente usam ids por timestamp (13 digitos) e sao enviados como "criados".
const LIMITE_ID_SEED = 100000;

// Campos de cada colecao que referenciam ids de outras colecoes. Usado para
// atualizar referencias quando o servidor devolve ids oficiais para registros
// criados localmente com id provisorio.
const REFERENCIAS: Record<string, string[]> = {
  usuarios: ['unidadeId'],
  unidades: [],
  salas: ['unidadeId'],
  turmas: ['instrutorId', 'unidadeId'],
  reservas: ['salaId', 'turmaId', 'instrutorId', 'unidadeId'],
  chaves: ['salaId', 'instrutorId', 'unidadeId'],
  notificacoes: ['paraId', 'unidadeId'],
  solicitacoes: ['salaId', 'instrutorId', 'unidadeId', 'turmaId'],
};

// Mapeia um campo de referencia para a colecao alvo
function _colecaoDoCampo(campo: string): string {
  switch (campo) {
    case 'unidadeId': return 'unidades';
    case 'salaId': return 'salas';
    case 'turmaId': return 'turmas';
    case 'instrutorId':
    case 'paraId': return 'usuarios';
    default: return '';
  }
}

// Aplica o mapeamento de ids provisorios -> oficiais devolvido pelo servidor.
// Renomeia o id dos registros criados localmente e tambem as referencias
// (ex.: salas criadas apontando para uma unidade nova).
function _aplicarIdsNovos(idsNovos: Record<string, Record<number, number>>): void {
  const cacheDinamico = CACHE as unknown as Record<string, Array<Record<string, unknown>>>;
  const mapas: Record<string, Map<number, number>> = {};

  for (const chave of COLECOES) {
    const mapa = idsNovos[chave];
    if (!mapa || !Object.keys(mapa).length) continue;
    const porChave = new Map<number, number>();
    for (const [antigo, novo] of Object.entries(mapa)) {
      porChave.set(Number(antigo), Number(novo));
    }
    mapas[chave] = porChave;

    // 1) Renomeia o id dos registros criados no proprio cache
    const lista = cacheDinamico[chave] ?? [];
    for (const item of lista) {
      const novoId = porChave.get(Number(item.id));
      if (novoId != null) item.id = novoId;
    }
  }

  // 2) Atualiza referencias nas demais colecoes
  for (const alvo of COLECOES) {
    const campos = REFERENCIAS[alvo] ?? [];
    if (!campos.length) continue;
    const lista = cacheDinamico[alvo] ?? [];
    for (const item of lista) {
      for (const campo of campos) {
        const valor = item[campo];
        if (valor == null) continue;
        const mapa = mapas[_colecaoDoCampo(campo)];
        if (!mapa) continue;
        const novoValor = mapa.get(Number(valor));
        if (novoValor != null) item[campo] = novoValor;
      }
    }
  }

  // 3) Persiste as colecoes que tiveram ids renomeados
  for (const chave of COLECOES) {
    if (idsNovos[chave] && Object.keys(idsNovos[chave]).length) {
      void _save(K[chave], cacheDinamico[chave]);
    }
  }
}

// ==== Helpers privados ====
async function _load<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch (e) { 
    console.error(`Erro ao carregar ${key}:`, e);
    return []; 
  }
}

// Sanitiza registros corrompidos: remove null/invalidos de arrays de dias
function _sanitizarReservas(reservas: Reserva[]): Reserva[] {
  return reservas.map(r => {
    if (!Array.isArray(r.diasSemana)) return { ...r, diasSemana: [] };
    const dias = r.diasSemana.filter(
      (d): d is DiaSemana => d != null && DIAS_VALIDOS.includes(d as DiaSemana)
    );
    return dias.length === r.diasSemana.length ? r : { ...r, diasSemana: dias };
  });
}

function _sanitizarSolics(solics: Solicitacao[]): Solicitacao[] {
  return solics.map(s => {
    if (!Array.isArray(s.diasSemana)) return s;
    const dias = s.diasSemana.filter(
      (d): d is DiaSemana => d != null && DIAS_VALIDOS.includes(d as DiaSemana)
    );
    return dias.length === (s.diasSemana?.length ?? 0) ? s : { ...s, diasSemana: dias };
  });
}

async function _save(key: string, val: unknown[]): Promise<void> {
  try { 
    const json = JSON.stringify(val);
    await AsyncStorage.setItem(key, json);
  } catch (e) { 
    console.error(`Erro ao salvar ${key}:`, e);
    throw e;
  }
}

// Gera um id único e seguro para novos registros.
// Em vez de maxId+1 (que colidia com registros já existentes no servidor
// quando o cache local estava desatualizado — ex.: criava unidade id 1006 que
// já era "Sobradinho" no servidor e sobrescrevia), usa um id baseado no
// relógio (13 dígitos), sempre acima dos ids fixos do seed (<= 10001). Assim
// um registro criado no mobile nunca sobrescreve um registro do web.
function _nextId<T extends { id: number }>(list: T[]): number {
  const maxAtual = list.reduce((mx, x) => Math.max(mx, x.id || 0), 0);
  let id = Date.now();
  while (list.some(x => Number(x.id) === id)) id += 1;
  return Math.max(maxAtual + 1, id);
}

// ==== Estado de sincronizacao (dirty tracking) ====
async function _loadSyncState(): Promise<void> {
  if (syncLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(K.sync);
    if (raw) {
      const parsed = JSON.parse(raw);
      ESTADO_SYNC.dirty = parsed.dirty && typeof parsed.dirty === 'object' ? parsed.dirty : {};
      ESTADO_SYNC.remocoes = parsed.remocoes && typeof parsed.remocoes === 'object' ? parsed.remocoes : {};
    }
  } catch (e) {
    console.warn('[sync] Estado de sync invalido, ignorando:', e);
  }
  syncLoaded = true;
}

async function _saveSyncState(): Promise<void> {
  try {
    await AsyncStorage.setItem(K.sync, JSON.stringify(ESTADO_SYNC));
  } catch (e) {
    console.warn('[sync] Falha ao salvar estado de sync:', e);
  }
}

// Marca registros como alterados/criados localmente (pendentes de envio)
function _marcarSujo(chave: keyof Cache, ids: number[]): void {
  const arr = ESTADO_SYNC.dirty[chave] || (ESTADO_SYNC.dirty[chave] = []);
  for (const id of ids) {
    if (id != null && !arr.includes(Number(id))) arr.push(Number(id));
  }
  // Se foi recriado, remove da fila de remocoes
  const rem = ESTADO_SYNC.remocoes[chave];
  if (rem && rem.length) {
    ESTADO_SYNC.remocoes[chave] = rem.filter(id => !ids.includes(Number(id)));
  }
}

// Marca ids como removidos localmente (pendentes de envio ao servidor)
function _marcarRemovido(chave: keyof Cache, ids: number[]): void {
  const arr = ESTADO_SYNC.remocoes[chave] || (ESTADO_SYNC.remocoes[chave] = []);
  for (const id of ids) {
    if (id != null && !arr.includes(Number(id))) arr.push(Number(id));
  }
  const dirt = ESTADO_SYNC.dirty[chave];
  if (dirt && dirt.length) {
    ESTADO_SYNC.dirty[chave] = dirt.filter(id => !ids.includes(Number(id)));
  }
}

// Grava uma colecao no AsyncStorage e dispara o envio ao servidor
async function _persistColecao<Chave extends keyof Cache>(chave: Chave): Promise<void> {
  await _save(K[chave], CACHE[chave]);
  await _saveSyncState();
  // Envio em background: nunca bloqueia a UI nem quebra se o servidor cair
  void _enviarPendentes();
}

// Envia ao servidor apenas o que mudou localmente (dirty + remocoes).
// - Registros com id oficial (<= LIMITE_ID_SEED) vao em "alteracoes" (upsert);
// - Registros recém-criados (id provisorio por timestamp) vao em "criados" e o
//   servidor atribui o id oficial, devolvendo o mapeamento em "idsNovos";
// - Exclusoes vao em "remocoes".
// Se o servidor nao estiver disponivel, mantem o estado para a proxima tentativa.
async function _enviarPendentes(): Promise<void> {
  await _loadSyncState();

  const alteracoes: Record<string, unknown[]> = {};
  const criados: Record<string, unknown[]> = {};
  const remocoes: Record<string, (number | string)[]> = {};

  for (const chave of COLECOES) {
    const ids = ESTADO_SYNC.dirty[chave];
    if (ids && ids.length) {
      const lista = (CACHE[chave] as unknown as Array<{ id: number }>);
      const registros = ids
        .map(id => lista.find(x => Number(x?.id) === Number(id)))
        .filter((x): x is { id: number } => x != null) as unknown[];
      const novos = registros.filter(r => Number((r as { id: number }).id) > LIMITE_ID_SEED);
      const existentes = registros.filter(r => Number((r as { id: number }).id) <= LIMITE_ID_SEED);
      if (existentes.length) alteracoes[chave] = existentes;
      if (novos.length) criados[chave] = novos;
    }
    const removidos = ESTADO_SYNC.remocoes[chave];
    if (removidos && removidos.length) remocoes[chave] = removidos;
  }

  if (
    !Object.keys(alteracoes).length &&
    !Object.keys(criados).length &&
    !Object.keys(remocoes).length
  ) return;

  try {
    const res = await enviarAlteracoes(alteracoes, remocoes, criados);
    if (res.ok) {
      ESTADO_SYNC.dirty = {};
      ESTADO_SYNC.remocoes = {};
      await _saveSyncState();
      // Aplica os ids oficiais devolvidos pelo servidor para os registros
      // que foram criados localmente (e suas referencias).
      if (res.idsNovos && Object.keys(res.idsNovos).length) {
        _aplicarIdsNovos(res.idsNovos);
      }
      console.log('[sync] Alteracoes locais propagadas ao servidor.');
    }
  } catch (e) {
    console.warn('[sync] Falha ao enviar alteracoes (vai tentar depois):', e);
  }
}

// Sincronizacao completa:
//  1) propaga as alteracoes locais pendentes (feitas offline);
//  2) baixa o banco do servidor e passa a usa-lo como fonte da verdade.
async function _sync(): Promise<void> {
  try {
    await _enviarPendentes();
    const remoto = await buscarDados();
    if (!remoto) return; // servidor indisponivel: mantem o cache local

    // Substitui o cache local pelos dados do servidor
    const cacheDinamico = CACHE as unknown as Record<string, unknown[]>;
    for (const colecao of COLECOES) {
      const dados = remoto[colecao];
      if (!Array.isArray(dados)) continue;
      cacheDinamico[colecao] = dados;
      await _save(K[colecao], dados);
    }

    // Tudo foi reconciliado: limpa pendências
    ESTADO_SYNC.dirty = {};
    ESTADO_SYNC.remocoes = {};
    await _saveSyncState();
    console.log('[sync] Banco sincronizado com o servidor.');
  } catch (e) {
    console.warn('[sync] Sincronizacao falhou (modo offline):', e);
  }
}

// ==== Seed inicial ====
// A fonte da verdade é o servidor central (server/seed.js). No primeiro uso:
//   1) tenta BAIXAR o banco do servidor e usa ELE como semente — assim o
//      mobile nasce com exatamente os mesmos dados do web;
//   2) se o servidor estiver fora do ar, usa um seed embutido que ESPELHA o
//      server/seed.js (mesmos IDs e nomes: 10 unidades 1001..1010 etc.),
//      preservando registros criados pelo usuário que não existam no seed.
async function seed(): Promise<void> {
  const versao = await AsyncStorage.getItem(K.init);
  if (versao === INIT_VERSION) return;

  // Carrega o que já existe no aparelho (para preservar registros do usuário)
  const [us, un, sa, tu, re, ch, no, so] = await Promise.all([
    _load<Usuario>(K.usuarios),
    _load<Unidade>(K.unidades),
    _load<Sala>(K.salas),
    _load<Turma>(K.turmas),
    _load<Reserva>(K.reservas),
    _load<Chave>(K.chaves),
    _load<Notificacao>(K.notificacoes),
    _load<Solicitacao>(K.solicitacoes),
  ]);
  const local: Record<string, unknown[]> = {
    usuarios: us, unidades: un, salas: sa, turmas: tu,
    reservas: re, chaves: ch, notificacoes: no, solicitacoes: so,
  };

  // 1) Servidor disponível: usa o banco do servidor como semente inicial
  const remoto = await buscarDados();
  if (remoto) {
    for (const colecao of COLECOES) {
      const dados = remoto[colecao];
      if (Array.isArray(dados)) await _save(K[colecao], dados);
    }
    await AsyncStorage.setItem(K.init, INIT_VERSION);
    console.log('[seed] Banco inicial baixado do servidor.');
    return;
  }

  // 2) Offline: seed embutido espelhando o server/seed.js
  const hoje = new Date();
  const iso = (d: Date): string => d.toISOString().split('T')[0];
  const addDias = (n: number): string => {
    const d = new Date(hoje); d.setDate(d.getDate() + n); return iso(d);
  };

  // ---- Unidades (10, IDs 1001..1010) ----
  const unidades: Unidade[] = [
    { id: 1001, nome: 'SENAC Asa Norte',    cep: '70750-500', cidade: 'Brasília/DF',    endereco: 'SCS Q.3 Bl.A - Asa Norte' },
    { id: 1002, nome: 'SENAC Asa Sul',      cep: '70390-045', cidade: 'Brasília/DF',    endereco: 'SCS Q.3 Bl.A - Asa Sul' },
    { id: 1003, nome: 'SENAC Taguatinga',   cep: '72015-900', cidade: 'Taguatinga/DF',  endereco: 'QS 1 Rua 210 Lote 30' },
    { id: 1004, nome: 'SENAC Ceilândia',    cep: '72220-270', cidade: 'Ceilândia/DF',   endereco: 'Setor O, Qd.602 Conj.A' },
    { id: 1005, nome: 'SENAC Gama',         cep: '72405-080', cidade: 'Gama/DF',        endereco: 'St. Central Qd.01 Conj.A' },
    { id: 1006, nome: 'SENAC Sobradinho',   cep: '73025-500', cidade: 'Sobradinho/DF',  endereco: 'Conj.7 Área Esp. S/N' },
    { id: 1007, nome: 'SENAC Planaltina',   cep: '73380-100', cidade: 'Planaltina/DF',  endereco: 'Setor Comercial Lote 1' },
    { id: 1008, nome: 'SENAC Samambaia',    cep: '72301-080', cidade: 'Samambaia/DF',   endereco: 'QS 318 Conj.1 Lote 1' },
    { id: 1009, nome: 'SENAC Santa Maria',  cep: '72503-503', cidade: 'Santa Maria/DF', endereco: 'Av. Alagados Qd.400' },
    { id: 1010, nome: 'SENAC Águas Claras', cep: '71907-530', cidade: 'Águas Claras/DF',endereco: 'Av. Araras Qd.600 Lote 10' },
  ];

  // ---- Usuarios (admin + 11 coord + 20 instrutores + 10 recepcao) ----
  const coordList: Array<[string, string, number, number]> = [
    ['Anadiria Passos', 'coord.asanorte@senacdf.com', 2001, 1001],
    ['Joao Paulo Ferreira', 'coord.Paulo@senacdf.com', 2002, 1001],
    ['Bruno Mendes Costa', 'coord.asasul@senacdf.com', 2003, 1002],
    ['Carla Souza Lima', 'coord.taguatinga@senacdf.com', 2004, 1003],
    ['Daniel Rocha Neves', 'coord.ceilandia@senacdf.com', 2005, 1004],
    ['Elaine Cristina Dias', 'coord.gama@senacdf.com', 2006, 1005],
    ['Fábio Alves Santos', 'coord.sobradinho@senacdf.com', 2007, 1006],
    ['Gabriela Moura', 'coord.planaltina@senacdf.com', 2008, 1007],
    ['Henrique Lopes', 'coord.samambaia@senacdf.com', 2009, 1008],
    ['Isabela Ramos', 'coord.santamaria@senacdf.com', 2010, 1009],
    ['João Victor Pinto', 'coord.aguasclaras@senacdf.com', 2011, 1010],
  ];
  const coordenadores: Usuario[] = coordList.map(([nome, email, id, unidadeId]) => ({
    id, nome, email, senha: 'Coord@123', perfil: 'coordenador', unidadeId,
  }));

  const instList: Array<[string, string, number, number]> = [
    ['Katia Regina Barros', 'katia.barros@senacdf.com', 3001, 1001],
    ['Aline Moraes', 'aline.moraes@senacdf.com', 3002, 1001],
    ['Leonardo Cruz', 'leonardo.cruz@senacdf.com', 3003, 1002],
    ['Caio Batista', 'caio.batista@senacdf.com', 3004, 1002],
    ['Mariana Oliveira', 'mariana.oliveira@senacdf.com', 3005, 1003],
    ['Diana Castro', 'diana.castro@senacdf.com', 3006, 1003],
    ['Natan Ferreira', 'natan.ferreira@senacdf.com', 3007, 1004],
    ['Erick Almeida', 'erick.almeida@senacdf.com', 3008, 1004],
    ['Olivia Martins', 'olivia.martins@senacdf.com', 3009, 1005],
    ['Fernanda Lima', 'fernanda.lima@senacdf.com', 3010, 1005],
    ['Pedro Henrique Melo', 'pedro.melo@senacdf.com', 3011, 1006],
    ['Gustavo Rocha', 'gustavo.rocha@senacdf.com', 3012, 1006],
    ['Queila Nascimento', 'queila.nascimento@senacdf.com', 3013, 1007],
    ['Helena Duarte', 'helena.duarte@senacdf.com', 3014, 1007],
    ['Rafael Torres', 'rafael.torres@senacdf.com', 3015, 1008],
    ['Igor Martins', 'igor.martins@senacdf.com', 3016, 1008],
    ['Sabrina Almeida', 'sabrina.almeida@senacdf.com', 3017, 1009],
    ['Julia Naves', 'julia.naves@senacdf.com', 3018, 1009],
    ['Thiago Vieira', 'thiago.vieira@senacdf.com', 3019, 1010],
    ['Lucas Teixeira', 'lucas.teixeira@senacdf.com', 3020, 1010],
  ];
  const instrutores: Usuario[] = instList.map(([nome, email, id, unidadeId]) => ({
    id, nome, email, senha: 'Inst@123', perfil: 'instrutor', unidadeId,
  }));

  const recepList: Array<[string, string, number, number]> = [
    ['Úrsula Campos', 'recep.asanorte@senacdf.com', 4001, 1001],
    ['Vinícius Cardoso', 'recep.asasul@senacdf.com', 4002, 1002],
    ['Wanda Silveira', 'recep.taguatinga@senacdf.com', 4003, 1003],
    ['Xênia Prudente', 'recep.ceilandia@senacdf.com', 4004, 1004],
    ['Yara Gonçalves', 'recep.gama@senacdf.com', 4005, 1005],
    ['Zilda Fonseca', 'recep.sobradinho@senacdf.com', 4006, 1006],
    ['Adriana Pereira', 'recep.planaltina@senacdf.com', 4007, 1007],
    ['Bernardo Castro', 'recep.samambaia@senacdf.com', 4008, 1008],
    ['Cecília Duarte', 'recep.santamaria@senacdf.com', 4009, 1009],
    ['Diego Farias', 'recep.aguasclaras@senacdf.com', 4010, 1010],
  ];
  const recepcoes: Usuario[] = recepList.map(([nome, email, id, unidadeId]) => ({
    id, nome, email, senha: 'Recep@123', perfil: 'recepcao', unidadeId,
  }));

  const usuarios: Usuario[] = [
    { id: 1, nome: 'Administrador SENAC', email: 'Senac_GDF@Hotmail.com', senha: 'Senac.DF2007', perfil: 'admin', unidadeId: 1001 },
    ...coordenadores,
    ...instrutores,
    ...recepcoes,
  ];

  // ---- Salas (50 — 5 por unidade) ----
  const TURNOS_ALL: Turno[] = ['Matutino', 'Vespertino', 'Noturno'];
  const TIPOS_SALA = [
    'Laboratório de Informática',
    'Sala Comum',
    'Cozinha Didática',
    'Auditório',
    'Sala de Reunião',
  ];
  const CAPACIDADES = [30, 40, 20, 80, 12];
  const ANDARES = ['1º Andar', 'Térreo', '1º Andar', 'Térreo', '2º Andar'];

  const salas: Sala[] = [];
  let sid = 5000;
  unidades.forEach((u, ui) => {
    TIPOS_SALA.forEach((tipo, ti) => {
      sid += 1;
      const numero = String(ui + 1).padStart(2, '0');
      const nomes = [
        `Lab Informática ${numero}`,
        `Sala Comum ${numero}`,
        `Lab Práticas ${numero}`,
        `Auditório ${numero}`,
        `Sala Reunião ${numero}`,
      ];
      const turnos = (ti === 2 || ti === 4) ? (['Matutino', 'Vespertino'] as Turno[]) : TURNOS_ALL;
      salas.push({
        id: sid,
        nome: nomes[ti],
        capacidade: CAPACIDADES[ti],
        tipo,
        andar: ANDARES[ti],
        bloco: `Bloco ${String.fromCharCode(65 + ti)}`,
        turnosDisponiveis: turnos,
        unidadeId: u.id,
        statusManual: null,
        motivoManual: '',
        manualPor: '',
        manualCriadaEm: null,
      });
    });
  });

  // ---- Turmas (40 — 4 por unidade) ----
  const CURSOS = [
    'Técnico em Informática',
    'Gastronomia Básica',
    'Gestão de Pessoas',
    'Técnico em Estética',
    'Redes de Computadores',
    'Auxiliar de Enfermagem',
    'Design Gráfico',
    'Logística',
    'Atendimento ao Cliente',
    'Empreendedorismo',
  ];
  const TURNOS_TURMA: Turno[] = ['Matutino', 'Vespertino', 'Noturno', 'Matutino'];

  const turmas: Turma[] = [];
  let tid = 6000;
  unidades.forEach((u, ui) => {
    for (let k = 0; k < 4; k++) {
      tid += 1;
      const instrutor = instrutores.filter(i => i.unidadeId === u.id)[k % 2];
      turmas.push({
        id: tid,
        codigo: `2025.0${String(tid - 6000).padStart(2, '0')}`,
        nome: `2025.${String(ui + 1).padStart(2, '0')}.${(k + 1) * 10 + ui}`,
        curso: CURSOS[(ui + k) % CURSOS.length],
        turno: TURNOS_TURMA[k],
        dataInicio: addDias(-20 + k * 5),
        dataFim: addDias(80 + k * 20),
        instrutorId: instrutor.id,
        unidadeId: u.id,
      });
    }
  });

  // ---- Reservas (30 + 1 cancelada) ----
  const PADROES_DIAS: DiaSemana[][] = [
    ['seg', 'ter', 'qua', 'qui', 'sex'],
    ['seg', 'qua', 'sex'],
    ['ter', 'qui'],
  ];

  const reservas: Reserva[] = [];
  let rid = 7000;
  unidades.forEach((u, ui) => {
    const salasU = salas.filter(s => s.unidadeId === u.id);
    const turmasU = turmas.filter(t => t.unidadeId === u.id);
    for (let k = 0; k < 3; k++) {
      rid += 1;
      const sala = salasU[k % salasU.length];
      const turma = turmasU[k % turmasU.length];
      reservas.push({
        id: rid,
        salaId: sala.id,
        turmaId: turma.id,
        turno: turma.turno,
        diasSemana: PADROES_DIAS[k % PADROES_DIAS.length],
        dataInicio: addDias(-20 + k * 5),
        dataFim: addDias(80 + k * 20),
        status: 'ATIVA',
        unidadeId: u.id,
        instrutorId: turma.instrutorId ?? undefined,
      });
    }
  });
  reservas.push({
    id: 7031, salaId: 5003, turmaId: 6001, turno: 'Vespertino',
    diasSemana: ['sab'], dataInicio: addDias(20), dataFim: addDias(20),
    status: 'CANCELADA', unidadeId: 1001, instrutorId: 3001,
  });

  // ---- Chaves (20 — 2 por unidade) ----
  const chaves: Chave[] = [];
  let cid = 8000;
  unidades.forEach((u, ui) => {
    const salasU = salas.filter(s => s.unidadeId === u.id);
    for (let k = 0; k < 2; k++) {
      cid += 1;
      const sala = salasU[k % salasU.length];
      chaves.push({
        id: cid,
        codigo: `CH-${String(ui + 1).padStart(2, '0')}${k + 1}`,
        salaId: sala.id,
        andar: sala.andar,
        status: k === 0 ? 'disponivel' : 'pega',
        instrutorId: k === 0 ? null : instrutores.filter(i => i.unidadeId === u.id)[0].id,
        pegaEm: k === 0 ? null : new Date(Date.now() - 3600000).toISOString(),
        unidadeId: u.id,
      });
    }
  });

  // ---- Notificacoes (4) e Solicitacoes (4) ----
  const notificacoes: Notificacao[] = [
    { id: 9001, tipo: 'info', titulo: 'Reserva confirmada', msg: 'Turma vinculada a uma sala com sucesso.', paraPerfil: 'coordenador', paraId: null, unidadeId: 1001, lida: false, criadaEm: new Date(Date.now() - 3600000).toISOString() },
    { id: 9002, tipo: 'aviso', titulo: 'Sala em manutenção', msg: 'Algumas salas podem estar temporariamente indisponíveis.', paraPerfil: 'recepcao', paraId: null, unidadeId: 1001, lida: false, criadaEm: new Date(Date.now() - 7200000).toISOString() },
    { id: 9003, tipo: 'ok', titulo: 'Solicitação aprovada', msg: 'Uso de sala aprovado para atividade prática.', paraPerfil: 'instrutor', paraId: 3007, unidadeId: 1004, lida: false, criadaEm: new Date(Date.now() - 10800000).toISOString() },
    { id: 9004, tipo: 'info', titulo: 'Chave retirada', msg: 'Uma chave foi retirada para aula vespertina.', paraPerfil: 'coordenador', paraId: null, unidadeId: 1005, lida: true, criadaEm: new Date(Date.now() - 14400000).toISOString() },
  ];

  const solicitacoes: Solicitacao[] = [
    { id: 10001, salaId: 5005, instrutorId: 3005, unidadeId: 1003, data: addDias(2), turnos: ['Noturno'], motivo: 'Aula extra de portfólio fotográfico', status: 'pendente', criadaEm: new Date(Date.now() - 5400000).toISOString() },
    { id: 10002, salaId: 5012, instrutorId: 3007, unidadeId: 1004, data: addDias(5), turnos: ['Matutino'], turmaId: 6010, motivo: 'Mostra de projetos integradores', status: 'aprovada', criadaEm: new Date(Date.now() - 9000000).toISOString(), respondidaEm: new Date(Date.now() - 3600000).toISOString() },
    { id: 10003, salaId: 5050, instrutorId: 3019, unidadeId: 1010, data: addDias(1), turnos: ['Vespertino'], motivo: 'Atendimento de mentoria para turma', status: 'pendente', criadaEm: new Date(Date.now() - 1800000).toISOString() },
    { id: 10004, salaId: 5047, instrutorId: 3017, unidadeId: 1009, data: addDias(3), turnos: ['Vespertino'], motivo: 'Reposição de conteúdo prático', status: 'recusada', criadaEm: new Date(Date.now() - 12600000).toISOString(), respondidaEm: new Date(Date.now() - 7200000).toISOString(), resposta: 'Sala bloqueada para manutenção.' },
  ];

  // Grava o seed espelhado, preservando registros criados pelo usuário que
  // não existem na semente (ex.: ids gerados por data/hora).
  const seedDados: Record<string, unknown[]> = {
    usuarios, unidades, salas, turmas, reservas, chaves, notificacoes, solicitacoes,
  };
  for (const colecao of COLECOES) {
    const seedList = seedDados[colecao] ?? [];
    const atualList = local[colecao] ?? [];
    const extra = atualList.filter(a => {
      const id = (a as { id?: unknown })?.id;
      if (id == null) return false;
      return !seedList.some(s => Number((s as { id?: unknown })?.id) === Number(id));
    });
    await _save(K[colecao], [...seedList, ...extra]);
  }

  await AsyncStorage.setItem(K.init, INIT_VERSION);
  console.log('[seed] Seed local (espelho do servidor) aplicado.');
}

// ==== Inicializacao ====
export async function initDados(force = false): Promise<void> {
  if (loaded && !force) return;

  // Evita multiplas chamadas concorrentes (varias telas chamam initDados)
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    if (force) {
      console.log('Carregando dados (force=true)...');
      loaded = false; // Reset do estado carregado
    }

    await seed();
    const [us, un, sa, tu, re, ch, no, so] = await Promise.all([
      _load<Usuario>(K.usuarios),
      _load<Unidade>(K.unidades),
      _load<Sala>(K.salas),
      _load<Turma>(K.turmas),
      _load<Reserva>(K.reservas),
      _load<Chave>(K.chaves),
      _load<Notificacao>(K.notificacoes),
      _load<Solicitacao>(K.solicitacoes),
    ]);
    await _loadSyncState();

    CACHE.usuarios     = us.length > 0 ? us : CACHE.usuarios;
    CACHE.unidades     = un.length > 0 ? un : CACHE.unidades;
    CACHE.salas        = sa.length > 0 ? sa : CACHE.salas;
    CACHE.turmas       = tu.length > 0 ? tu : CACHE.turmas;
    CACHE.reservas     = re.length > 0 ? _sanitizarReservas(re) : CACHE.reservas;
    CACHE.chaves       = ch.length > 0 ? ch : CACHE.chaves;
    CACHE.notificacoes = no.length > 0 ? no : CACHE.notificacoes;
    CACHE.solicitacoes = so.length > 0 ? _sanitizarSolics(so) : CACHE.solicitacoes;
    loaded = true;

    // Sincroniza com o servidor central (web + mobile compartilham o banco)
    await _sync();

    console.log(`Dados carregados: ${CACHE.usuarios.length} users, ${CACHE.unidades.length} unidades`);
  })();

  try {
    await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export async function resetarTudo(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(K));
  loaded = false;
  syncLoaded = false;
  ESTADO_SYNC.dirty = {};
  ESTADO_SYNC.remocoes = {};
  // Pede ao servidor para recarregar os dados de exemplo e baixa a resposta
  const remoto = await resetarApi();
  if (remoto) {
    const cacheDinamico = CACHE as unknown as Record<string, unknown[]>;
    for (const colecao of COLECOES) {
      const dados = remoto[colecao];
      if (!Array.isArray(dados)) continue;
      cacheDinamico[colecao] = dados;
      await _save(K[colecao], dados);
    }
    loaded = true;
  } else {
    await initDados();
  }
}

// ==== Sessao ====
export async function getSessao(): Promise<Sessao | null> {
  try {
    const raw = await AsyncStorage.getItem(K.sessao);
    return raw ? (JSON.parse(raw) as Sessao) : null;
  } catch { return null; }
}
export async function setSessao(u: Sessao): Promise<void> {
  await AsyncStorage.setItem(K.sessao, JSON.stringify(u));
}
export async function clearSessao(): Promise<void> {
  await AsyncStorage.removeItem(K.sessao);
}

// ==== Login ====
export async function loginUser(email: string, senha: string): Promise<Usuario | null> {
  // 1) Tenta validar no servidor central (web e mobile usam o mesmo banco)
  const remoto = await loginApi(email, senha);
  if (remoto) return remoto;

  // 2) Offline: valida contra o cache local
  const u = CACHE.usuarios.find(u =>
    u.email.toLowerCase() === email.toLowerCase() && u.senha === senha
  );
  return u ?? null;
}

// ==== Leituras ====
export const getUnidades   = (): Unidade[] => [...CACHE.unidades];
export const getUnidadeById = (id: number | null | undefined): Unidade | null =>
  id ? (CACHE.unidades.find(u => u.id === id) ?? null) : null;
export const getUsuarios   = (): Usuario[] => [...CACHE.usuarios];
export const getUserById   = (id: number | null | undefined): Usuario | null =>
  id ? (CACHE.usuarios.find(u => u.id === id) ?? null) : null;
export const getUsersByPerfil = (p: string): Usuario[] =>
  CACHE.usuarios.filter(u => u.perfil === p);
export const getSalas         = (): Sala[] => [...CACHE.salas];
export const getSalaById      = (id: number | null): Sala | null =>
  id ? (CACHE.salas.find(s => s.id === id) ?? null) : null;
export const getSalasByUnidade = (uid: number | null): Sala[] =>
  uid ? CACHE.salas.filter(s => s.unidadeId === uid) : [];
export const getTurmas    = (): Turma[] => [...CACHE.turmas];
export const getTurmaById = (id: number | null | undefined): Turma | null =>
  id ? (CACHE.turmas.find(t => t.id === id) ?? null) : null;
export const getReservas  = (): Reserva[] => [...CACHE.reservas];
export const getReservaById = (id: number | null | undefined): Reserva | null =>
  id ? (CACHE.reservas.find(r => r.id === id) ?? null) : null;
export const getChaves    = (): Chave[] => [...CACHE.chaves];
export const getChaveById = (id: number): Chave | null =>
  CACHE.chaves.find(c => c.id === id) ?? null;
export const getSolics    = (): Solicitacao[] => [...CACHE.solicitacoes];
export const getNotifs    = (): Notificacao[] => [...CACHE.notificacoes];

export function getNotifsPara(perfil: string, unidadeId: number | null, userId?: number): Notificacao[] {
  return CACHE.notificacoes.filter(n => {
    if (userId && n.paraId && n.paraId === userId) return true;
    if (n.paraPerfil === perfil)
      return !n.unidadeId || !unidadeId || n.unidadeId === unidadeId;
    return false;
  });
}
export function countNaoLidas(perfil: string, unidadeId: number | null, userId?: number): number {
  return getNotifsPara(perfil, unidadeId, userId).filter(n => !n.lida).length;
}

// ==== CRUD Usuarios ====
export async function addUser(d: Omit<Usuario, 'id'>): Promise<Usuario> {
  const item: Usuario = { ...d, id: _nextId(CACHE.usuarios) };
  CACHE.usuarios.push(item);
  _marcarSujo('usuarios', [item.id]);
  await _persistColecao('usuarios');
  return item;
}
export async function updUser(id: number, d: Partial<Usuario>): Promise<Usuario | null> {
  const idx = CACHE.usuarios.findIndex(u => u.id === id);
  if (idx < 0) return null;
  CACHE.usuarios[idx] = { ...CACHE.usuarios[idx], ...d };
  _marcarSujo('usuarios', [id]);
  await _persistColecao('usuarios');
  return CACHE.usuarios[idx];
}
export async function delUser(id: number): Promise<void> {
  const antes = CACHE.usuarios.length;
  CACHE.usuarios = CACHE.usuarios.filter(u => u.id !== id);
  const depois = CACHE.usuarios.length;
  console.log(`Deletado user ${id}: ${antes} → ${depois}`);
  if (depois < antes) _marcarRemovido('usuarios', [id]);
  await _persistColecao('usuarios');
}

// ==== CRUD Unidades ====
export async function addUnidade(d: Omit<Unidade, 'id'>): Promise<Unidade> {
  const item: Unidade = { ...d, id: _nextId(CACHE.unidades) };
  CACHE.unidades.push(item);
  _marcarSujo('unidades', [item.id]);
  await _persistColecao('unidades');
  return item;
}
export async function updUnidade(id: number, d: Partial<Unidade>): Promise<void> {
  const idx = CACHE.unidades.findIndex(u => u.id === id);
  if (idx < 0) return;
  CACHE.unidades[idx] = { ...CACHE.unidades[idx], ...d };
  _marcarSujo('unidades', [id]);
  await _persistColecao('unidades');
}
export async function delUnidade(id: number): Promise<void> {
  const antes = CACHE.unidades.length;
  CACHE.unidades = CACHE.unidades.filter(u => u.id !== id);
  const depois = CACHE.unidades.length;
  console.log(`Deletada unidade ${id}: ${antes} → ${depois}`);
  if (depois < antes) _marcarRemovido('unidades', [id]);
  await _persistColecao('unidades');
}

// ==== CRUD Salas ====
export async function addSala(d: Omit<Sala, 'id'>): Promise<Sala> {
  const item: Sala = { ...d, id: _nextId(CACHE.salas) };
  CACHE.salas.push(item);
  _marcarSujo('salas', [item.id]);
  await _persistColecao('salas');
  return item;
}
export async function updSala(id: number, d: Partial<Sala>): Promise<void> {
  const idx = CACHE.salas.findIndex(s => s.id === id);
  if (idx < 0) return;
  CACHE.salas[idx] = { ...CACHE.salas[idx], ...d };
  _marcarSujo('salas', [id]);
  await _persistColecao('salas');
}
export async function delSala(id: number): Promise<void> {
  const antes = CACHE.salas.length;
  CACHE.salas = CACHE.salas.filter(s => s.id !== id);
  if (CACHE.salas.length < antes) _marcarRemovido('salas', [id]);
  await _persistColecao('salas');
}

// ==== CRUD Turmas ====
export async function addTurma(d: Omit<Turma, 'id'>): Promise<Turma> {
  const item: Turma = { ...d, id: _nextId(CACHE.turmas) };
  CACHE.turmas.push(item);
  _marcarSujo('turmas', [item.id]);
  await _persistColecao('turmas');
  return item;
}
export async function updTurma(id: number, d: Partial<Turma>): Promise<void> {
  const idx = CACHE.turmas.findIndex(t => t.id === id);
  if (idx < 0) return;
  CACHE.turmas[idx] = { ...CACHE.turmas[idx], ...d };
  _marcarSujo('turmas', [id]);
  await _persistColecao('turmas');
}
export async function delTurma(id: number): Promise<void> {
  CACHE.turmas = CACHE.turmas.filter(t => t.id !== id);
  _marcarRemovido('turmas', [id]);
  // Remove tambem as reservas vinculadas (espelha o web)
  const reservasRemovidas = CACHE.reservas.filter(r => r.turmaId === id).map(r => r.id);
  CACHE.reservas = CACHE.reservas.filter(r => r.turmaId !== id);
  if (reservasRemovidas.length) _marcarRemovido('reservas', reservasRemovidas);
  await _persistColecao('turmas');
  await _persistColecao('reservas');
}

// ==== CRUD Reservas ====
export async function addReserva(d: Omit<Reserva, 'id'>): Promise<Reserva> {
  const item: Reserva = { ...d, id: _nextId(CACHE.reservas) };
  CACHE.reservas.push(item);
  _marcarSujo('reservas', [item.id]);
  await _persistColecao('reservas');
  return item;
}
export async function updReserva(id: number, d: Partial<Reserva>): Promise<void> {
  const idx = CACHE.reservas.findIndex(r => r.id === id);
  if (idx < 0) return;
  CACHE.reservas[idx] = { ...CACHE.reservas[idx], ...d };
  _marcarSujo('reservas', [id]);
  await _persistColecao('reservas');
}
export async function delReserva(id: number): Promise<void> {
  const antes = CACHE.reservas.length;
  CACHE.reservas = CACHE.reservas.filter(r => r.id !== id);
  if (CACHE.reservas.length < antes) _marcarRemovido('reservas', [id]);
  await _persistColecao('reservas');
}

// ==== Conflito de reservas (espelha verificarConflito do web) ====
export function verificarConflito(
  nova: { salaId: number; turno: Turno; diasSemana: DiaSemana[]; dataInicio: string; dataFim: string },
  ignorarId: number | null = null
): string | null {
  const reservas = CACHE.reservas.filter(r => r.id !== ignorarId && r.status !== 'CANCELADA');
  for (const r of reservas) {
    if (r.salaId !== nova.salaId) continue;
    if (r.turno !== nova.turno) continue;

    const semSobreposicao = nova.dataFim < r.dataInicio || r.dataFim < nova.dataInicio;
    if (semSobreposicao) continue;

    const diasComuns = nova.diasSemana.filter(d => r.diasSemana.includes(d));
    if (diasComuns.length > 0) {
      const sala = getSalaById(r.salaId);
      const turma = r.turmaId ? getTurmaById(r.turmaId) : null;
      const diasStr = diasComuns.map(d => d.toUpperCase()).join(', ');
      return `Conflito! "${sala?.nome ?? '?'}" ja esta ocupada no ${r.turno} (${diasStr}) por "${turma?.nome ?? 'Sem turma'}".`;
    }
  }
  return null;
}

// ==== CRUD Chaves ====
export async function addChave(d: Omit<Chave, 'id'>): Promise<Chave> {
  const item: Chave = { ...d, id: _nextId(CACHE.chaves) };
  CACHE.chaves.push(item);
  _marcarSujo('chaves', [item.id]);
  await _persistColecao('chaves');
  return item;
}
export async function updChave(id: number, d: Partial<Chave>): Promise<Chave | null> {
  const idx = CACHE.chaves.findIndex(c => c.id === id);
  if (idx < 0) return null;
  CACHE.chaves[idx] = { ...CACHE.chaves[idx], ...d };
  _marcarSujo('chaves', [id]);
  await _persistColecao('chaves');
  return CACHE.chaves[idx];
}
export async function delChave(id: number): Promise<void> {
  const antes = CACHE.chaves.length;
  CACHE.chaves = CACHE.chaves.filter(c => c.id !== id);
  if (CACHE.chaves.length < antes) _marcarRemovido('chaves', [id]);
  await _persistColecao('chaves');
}
export async function retirarChave(id: number, instrutorId: number): Promise<Chave | null> {
  const resp = getUserById(instrutorId);
  const chave = getChaveById(id);
  if (!resp || !chave || resp.unidadeId !== chave.unidadeId) return null;
  return updChave(id, { status: 'pega', instrutorId, pegaEm: new Date().toISOString() });
}
export async function devolverChave(id: number): Promise<Chave | null> {
  return updChave(id, { status: 'disponivel', instrutorId: null, pegaEm: null });
}

// ==== CRUD Solicitacoes ====
export async function addSolic(d: Omit<Solicitacao, 'id'>): Promise<Solicitacao> {
  const item: Solicitacao = { ...d, id: _nextId(CACHE.solicitacoes) };
  CACHE.solicitacoes.push(item);
  _marcarSujo('solicitacoes', [item.id]);
  await _persistColecao('solicitacoes');
  return item;
}
export async function updSolic(id: number, d: Partial<Solicitacao>): Promise<void> {
  const idx = CACHE.solicitacoes.findIndex(s => s.id === id);
  if (idx < 0) return;
  CACHE.solicitacoes[idx] = { ...CACHE.solicitacoes[idx], ...d };
  _marcarSujo('solicitacoes', [id]);
  await _persistColecao('solicitacoes');
}

// ==== CRUD Notificacoes ====
export async function addNotif(d: Omit<Notificacao, 'id' | 'lida' | 'criadaEm'>): Promise<Notificacao> {
  const item: Notificacao = {
    ...d,
    id: _nextId(CACHE.notificacoes),
    lida: false,
    criadaEm: new Date().toISOString(),
  };
  CACHE.notificacoes.push(item);
  _marcarSujo('notificacoes', [item.id]);
  await _persistColecao('notificacoes');
  return item;
}
export async function marcarTodasLidas(perfil: string, unidadeId: number | null, userId?: number): Promise<void> {
  const afetadas = getNotifsPara(perfil, unidadeId, userId);
  if (!afetadas.length) return;
  afetadas.forEach(n => { n.lida = true; });
  _marcarSujo('notificacoes', afetadas.map(n => n.id));
  await _persistColecao('notificacoes');
}

// ==== Utilitarios ====
export function calcStatus(turma: Turma | null): StatusTurma {
  if (!turma) return 'encerrada';
  const hoje = new Date().toISOString().split('T')[0];
  if (turma.dataFim && hoje > turma.dataFim) return 'encerrada';
  if (turma.dataInicio && hoje < turma.dataInicio) {
    const diff = Math.ceil(
      (new Date(turma.dataInicio + 'T00:00:00').getTime() -
       new Date(hoje + 'T00:00:00').getTime()) / 86400000
    );
    if (diff >= 0 && diff <= 7) return 'iminente';
    return 'posterior';
  }
  return 'ativa';
}
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '-';
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
export function fmtDiasSemana(dias: Array<string | null | undefined> | null | undefined): string {
  if (!Array.isArray(dias)) return '';
  const validos = dias.filter((d): d is string => d != null && d.trim() !== '');
  return validos.map(d => d.toUpperCase()).join(', ');
}
export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function iniciais(nome: string): string {
  return nome.trim().split(/\s+/).slice(0, 2)
    .map(p => p.charAt(0).toUpperCase()).join('') || 'SN';
}
export function diaDaSemana(iso: string): DiaSemana {
  const p = iso.split('-').map(Number);
  return (['dom','seg','ter','qua','qui','sex','sab'] as DiaSemana[])[
    new Date(p[0], p[1] - 1, p[2]).getDay()
  ];
}
export function hojeISO(): string {
  return new Date().toISOString().split('T')[0];
}
