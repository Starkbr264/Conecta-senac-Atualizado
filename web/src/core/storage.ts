/**
 * Camada de dados do Conecta-Senac (frontend web).
 *
 * Conversao tipada do antigo `storage.js`. Nenhuma regra de negocio foi
 * alterada: os mesmos nomes, os mesmos valores padrao, a mesma ordem de
 * persistencia e o mesmo contrato com o servidor Node.
 *
 * Fontes:
 *  - persistencia local: `localStorage` (espelho de trabalho offline);
 *  - fonte da verdade:    `GET /api/dados` em `server/index.js`.
 */

import { buscarDados, buscarUnidadesPublicas, login as loginRemoto, sincronizar, extrairUsuarioLogin, salvarToken, obterToken, ErroApi } from './api';
import { getSessao } from './theme';
import type {
  Atualizar,
  Chave,
  NovaChave,
  NovaNotificacao,
  NovaReserva,
  NovaSolicitacao,
  NovoUsuario,
  NovoUnidade,
  NovoSala,
  NovoTurma,
  Notificacao,
  Perfil,
  Reserva,
  Sala,
  Sessao,
  Solicitacao,
  StatusManualSala,
  Turma,
  Unidade,
  Usuario,
} from '../types';

// ---------------------------------------------------------------------------
// Chaves de persistencia local
// ---------------------------------------------------------------------------

/** Chaves usadas no `localStorage` — NAO alterar (ha dados em producao). */
export const K = {
  usuarios: 'sn_v6_usuarios',
  unidades: 'sn_v6_unidades',
  salas: 'sn_v6_salas',
  turmas: 'sn_v6_turmas',
  reservas: 'sn_v6_reservas',
  chaves: 'sn_v6_chaves',
  notificacoes: 'sn_v6_notificacoes',
  solicitacoes: 'sn_v6_solicitacoes',
  sessao: 'sn_v6_sessao',
  tema: 'sn_v6_tema',
  init: 'sn_v6_init_v1',
  syncPendentes: 'sn_v6_sync_pendentes',
} as const;

/** Nomes das coleções espelhadas em cache. */
export const COLECOES = [
  'usuarios',
  'unidades',
  'salas',
  'turmas',
  'reservas',
  'chaves',
  'notificacoes',
  'solicitacoes',
] as const;

type Colecao = (typeof COLECOES)[number];

/** Forma do espelho em memoria. */
export interface CacheDados {
  usuarios: Usuario[];
  unidades: Unidade[];
  salas: Sala[];
  turmas: Turma[];
  reservas: Reserva[];
  chaves: Chave[];
  notificacoes: Notificacao[];
  solicitacoes: Solicitacao[];
  loaded: boolean;
  loadingPromise: Promise<CacheDados> | null;
  /**
   * Ids removidos localmente aguardando propagacao ao servidor. O merge de
   * `/api/sinc` e por id; sem esta fila, exclusoes offline seria
   * ressuscitadas na proxima sincronizacao.
   */
  _remocoes: Partial<Record<Colecao, number[]>>;
}

export interface SyncPayload {
  operacaoId?: string;
  criados?: Partial<Record<Colecao, unknown[]>>;
  alteracoes?: Partial<Record<Colecao, unknown[]>>;
  remocoes?: Partial<Record<Colecao, number[]>>;
}

interface SyncPendente {
  operacaoId: string;
  payload: SyncPayload;
}

export interface SyncResult {
  confirmado: boolean;
  pendente: boolean;
  /** A operacao bloqueada contem senha e nao foi persistida na fila. */
  exigeConexao?: boolean;
  erro?: unknown;
}

export class SincronizacaoPendenteError extends Error {
  readonly pendente = true;
  /**
   * `true` quando a operacao contem senha: ela fica so em memoria (nunca em
   * `localStorage`) e POR ISSO exige conexao para concluir — nao sobrevive a
   * recarregar a pagina.
   */
  readonly exigeConexao: boolean;

  constructor(exigeConexao = false) {
    super(
      exigeConexao
        ? 'Operacao com senha nao confirmada: exige conexao com o servidor e nao e mantida entre sessoes.'
        : 'Operacao mantida localmente e pendente de sincronizacao.',
    );
    this.name = 'SincronizacaoPendenteError';
    this.exigeConexao = exigeConexao;
  }
}

/** Espelho em memoria dos dados (leitura livre para depuracao). */
export const CACHE: CacheDados = {
  usuarios: [],
  unidades: [],
  salas: [],
  turmas: [],
  reservas: [],
  chaves: [],
  notificacoes: [],
  solicitacoes: [],
  loaded: false,
  loadingPromise: null,
  _remocoes: {},
};

// ---------------------------------------------------------------------------
// Persistencia local
// ---------------------------------------------------------------------------

/** Le e desserializa uma chave do localStorage (`[]` em caso de erro). */
function lv<T>(key: string): T[] {
  try {
    const bruto = localStorage.getItem(key);
    if (!bruto) return [];
    const dados: unknown = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as T[]) : [];
  } catch {
    return [];
  }
}

/** Serializa e grava uma chave do localStorage (silencia quota/erro). */
function sv(key: string, valor: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
  } catch {
    /* quota cheia / modo privado: o cache em memoria continua valendo */
  }
}

/** ID negativo provisório; o ID positivo oficial é sempre criado pelo backend. */
function nextId(lista: Array<{ id: number }>): number {
  const menor = lista.reduce((mx, x) => Math.min(mx, Number(x.id) || 0), 0);
  return Math.min(menor, -Date.now()) - 1;
}

/** Normaliza um perfil para minusculas (como gravado no banco). */
export function lowerPerfil(v: unknown): string {
  return String(v ?? '').toLowerCase();
}

/** Recarrega o cache a partir do `localStorage`. */
export function loadCache(): void {
  CACHE.usuarios = lv<Usuario>(K.usuarios);
  CACHE.unidades = lv<Unidade>(K.unidades);
  CACHE.salas = lv<Sala>(K.salas);
  CACHE.turmas = lv<Turma>(K.turmas);
  CACHE.reservas = lv<Reserva>(K.reservas);
  CACHE.chaves = lv<Chave>(K.chaves);
  CACHE.notificacoes = lv<Notificacao>(K.notificacoes);
  CACHE.solicitacoes = lv<Solicitacao>(K.solicitacoes);
  lerFilaSync();
}

/** Grava a colecao no localStorage e a propaga ao servidor. */
const syncPromises = new WeakMap<object, Promise<SyncResult>>();
let filaSync: SyncPendente[] = [];
let flushPromise: Promise<SyncResult> | null = null;

/**
 * Status HTTP que significam recusa definitiva da operacao (validacao ou regra
 * de negocio): a operacao sai da fila e o erro e reportado. Rede, 5xx, 401,
 * 408 e 429 mantem a operacao pendente para reenvio.
 */
const REJEICOES_DEFINITIVAS = new Set([400, 403, 404, 409, 422]);

function lerFilaSync(): void {
  try {
    const valor = localStorage.getItem(K.syncPendentes);
    const lista: unknown = valor ? JSON.parse(valor) : [];
    filaSync = Array.isArray(lista) ? lista as SyncPendente[] : [];
  } catch {
    filaSync = [];
  }
}

function salvarFilaSync(): void {
  // Operacoes de usuario com senha ficam somente em memoria: uma senha nunca
  // deve sobreviver em localStorage, mesmo quando a API estiver indisponivel.
  const persistiveis = filaSync.filter((op) => !JSON.stringify(op.payload).includes('"senha"'));
  sv(K.syncPendentes, persistiveis);
}

function novoOperacaoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function payloadDaColecao(key: Colecao, tipo: 'criados' | 'alteracoes', item: unknown): SyncPayload {
  return { [tipo]: { [key]: [item] } } as SyncPayload;
}

function persist(key: Colecao, payload?: SyncPayload, entidade?: object): void {
  sv(K[key], CACHE[key]);
  const delta = payload ?? payloadDaColecao(key, 'alteracoes', CACHE[key][CACHE[key].length - 1]);
  const promessa = enfileirar(delta);
  if (entidade) syncPromises.set(entidade, promessa);
}

/** Coloca um id na fila de remocoes pendentes. */
function marcarRemovido(key: Colecao, id: number): void {
  if (!CACHE._remocoes[key]) CACHE._remocoes[key] = [];
  const fila = CACHE._remocoes[key] as number[];
  if (fila.indexOf(id) === -1) fila.push(id);
}

/**
 * Envia a colecao alterada + remocoes pendentes ao servidor central, em
 * segundo plano (merge por id em `/api/sinc`). Se o servidor estiver fora do
 * ar, as remocoes permanecem na fila para a proxima tentativa.
 */
function aplicarIdsOficiais(res: unknown): void {
  if (!res || typeof res !== 'object') return;
  const mapas = (res as { idsNovos?: Record<string, Record<string, number>> }).idsNovos;
  if (!mapas) return;
  const resolve = (colecao: string, valor: unknown): unknown =>
    mapas[colecao]?.[String(valor)] ?? valor;
  COLECOES.forEach((key) => {
    CACHE[key].forEach((item) => {
      if (mapas[key]?.[String(item.id)] !== undefined) item.id = Number(resolve(key, item.id));
      (['unidadeId', 'instrutorId', 'salaId', 'turmaId'] as const).forEach((campo) => {
        const colecao = campo === 'unidadeId' ? 'unidades' : campo === 'instrutorId' ? 'usuarios'
          : campo === 'salaId' ? 'salas' : 'turmas';
        const atual = (item as unknown as Record<string, unknown>)[campo];
        if (atual !== undefined && mapas[colecao]?.[String(atual)] !== undefined)
          (item as unknown as Record<string, unknown>)[campo] = resolve(colecao, atual);
      });
    });
    sv(K[key], CACHE[key]);
  });
}

async function flushPendentes(): Promise<SyncResult> {
  if (flushPromise) return flushPromise;
  flushPromise = (async (): Promise<SyncResult> => {
    while (filaSync.length) {
      const atual = filaSync[0];
      try {
        const resposta = await sincronizar(atual.payload);
        aplicarIdsOficiais(resposta);
        filaSync.shift();
        salvarFilaSync();
        if (resposta && typeof resposta === 'object' && 'banco' in resposta) {
          const banco = (resposta as { banco?: Record<string, unknown> }).banco;
          Object.keys(atual.payload.criados ?? {}).concat(Object.keys(atual.payload.alteracoes ?? {})).forEach((nome) => {
            const key = nome as Colecao;
            if (Array.isArray(banco?.[key])) {
              CACHE[key] = banco[key] as never;
              sv(K[key], banco[key]);
            }
          });
        }
      } catch (erro) {
        // Rejeicao definitiva de negocio/validacao (4xx): o servidor recusou a
        // operacao. Retira-a da fila para nao bloquear as demais, mas NUNCA de
        // forma silenciosa — o erro segue para a interface.
        if (erro instanceof ErroApi && REJEICOES_DEFINITIVAS.has(erro.status)) {
          filaSync.shift();
          salvarFilaSync();
          return { confirmado: false, pendente: false, erro };
        }
        // Falha de rede / 5xx / 401: mantem o delta para reenvio.
        return { confirmado: false, pendente: true, erro };
      }
    }
    return { confirmado: true, pendente: false };
  })().finally(() => { flushPromise = null; });
  return flushPromise;
}

function enfileirar(payload: SyncPayload): Promise<SyncResult> {
  const operacaoId = payload.operacaoId ?? novoOperacaoId();
  const operacao: SyncPendente = { operacaoId, payload: { ...payload, operacaoId } };
  filaSync.push(operacao);
  salvarFilaSync();
  return flushPendentes().then((resultado) => {
    // Operacao com senha nao foi persistida na fila (salvarFilaSync a filtra);
    // se ainda pendente, ela vale so nesta sessao — o chamador precisa saber.
    const contemSenha = JSON.stringify(payload).includes('"senha"');
    if (!resultado.confirmado && resultado.pendente && contemSenha) {
      return { ...resultado, exigeConexao: true };
    }
    return resultado;
  });
}

async function confirmar(entidade: object | null): Promise<void> {
  const promessa = entidade ? syncPromises.get(entidade) : undefined;
  if (!promessa) return;
  const resultado = await promessa;
  if (resultado.confirmado) return;
  if (resultado.pendente) throw new SincronizacaoPendenteError(resultado.exigeConexao === true);
  throw resultado.erro instanceof Error
    ? resultado.erro
    : new Error('Operacao recusada pelo servidor.');
}

/**
 * Confirma a fila apos uma exclusao local: lança `SincronizacaoPendenteError`
 * quando a falha e de rede (operacao mantida) e o erro original do servidor
 * quando a operacao foi recusada definitivamente.
 */
async function confirmarFila(): Promise<void> {
  if (!filaSync.length) lerFilaSync();
  const resultado = await flushPendentes();
  if (resultado.confirmado) return;
  if (resultado.pendente) throw new SincronizacaoPendenteError();
  throw resultado.erro instanceof Error
    ? resultado.erro
    : new Error('Operacao recusada pelo servidor.');
}

/**
 * Sincroniza com o servidor central (fonte da verdade web + mobile):
 *  1) propaga remocoes pendentes feitas offline;
 *  2) baixa o banco completo do servidor e substitui cache + localStorage.
 *
 * IMPORTANTE: nao envia o cache local em massa — isso sobrescreveria o banco
 * central com dados divergentes. Cada alteracao local ja foi (ou sera)
 * propagada por {@link pushColecao}.
 */
export async function sincronizarServidor(): Promise<void> {
  if (!filaSync.length) lerFilaSync();
  if (filaSync.length && !(await flushPendentes()).confirmado) return;
  // Sem token JWT nao ha o que sincronizar: /api/dados exige autenticacao e a
  // chamada retornaria 401 (logado antes como "modo offline"/"sessao expirada",
  // mensagem enganosa na tela de login, que roda este fluxo antes do login).
  // Antes do login, buscar somente as unidades publicas para preencher o
  // seletor; o banco completo continua protegido por JWT.
  if (!obterToken()) {
    try {
      const unidades = await buscarUnidadesPublicas();
      CACHE.unidades = unidades;
      sv(K.unidades, unidades);
    } catch {
      /* API indisponivel: preserva o cache local e segue offline. */
    }
    return;
  }
  try {
    if (CACHE._remocoes && Object.keys(CACHE._remocoes).length) {
      const remocoes: Partial<Record<Colecao, number[]>> = {};
      Object.keys(CACHE._remocoes).forEach((chave) => {
        const fila = CACHE._remocoes[chave as Colecao];
        if (fila && fila.length) remocoes[chave as Colecao] = fila;
      });

      if (Object.keys(remocoes).length) {
        await sincronizar({ alteracoes: {}, remocoes, operacaoId: novoOperacaoId() });
        CACHE._remocoes = {};
      }
    }

    const remoto = await buscarDados();

    COLECOES.forEach((chave) => {
      const dados = remoto[chave];
      if (Array.isArray(dados)) {
        (CACHE[chave] as unknown[]) = dados as unknown[];
        sv(K[chave], dados);
      }
    });

    console.log('[web] Banco sincronizado com o servidor central.');
  } catch (err) {
    console.warn('[web] Sincronizacao falhou (modo offline):', err);
  }
}

// ---------------------------------------------------------------------------
// Leitura — Usuarios
// ---------------------------------------------------------------------------

export function getUsuarios(): Usuario[] {
  return [...CACHE.usuarios];
}

export function getUsuarioById(id: number | string): Usuario | null {
  return CACHE.usuarios.find((u) => String(u.id) === String(id)) ?? null;
}

/** Alias historico mantido por compatibilidade. */
export function getUserById(id: number | string): Usuario | null {
  return getUsuarioById(id);
}

export function getUsersByPerfil(perfil: Perfil | string): Usuario[] {
  const alvo = lowerPerfil(perfil);
  return CACHE.usuarios.filter((u) => lowerPerfil(u.perfil) === alvo);
}

// ---------------------------------------------------------------------------
// Leitura — Unidades
// ---------------------------------------------------------------------------

export function getUnidades(): Unidade[] {
  return [...CACHE.unidades];
}

export function getUnidadeById(id: number | string | null | undefined): Unidade | null {
  if (id === null || id === undefined || id === '') return null;
  return CACHE.unidades.find((u) => String(u.id) === String(id)) ?? null;
}

/**
 * Unidade que deve ser gravada em um registro quando a tela nao tem uma.
 *
 * <p>Este e o ponto que resolvia o "unidadeId perdido": o legado gravava
 * `undefined` (o cast `as number` do TypeScript mentia em runtime) e o
 * registro naso aparecia em nenhum filtro por unidade, virando orfao.
 *
 * <p>Ordem de resolucao:
 * <ol>
 *   <li>unidade da sessao (o usuario logado);</li>
 *   <li>primeira unidade cadastrada (evita orfao no modo demonstracao,
 *       em que nao ha sessao);</li>
 *   <li>{@code 0} — sentinela explicito, melhor que {@code undefined}
 *       silencioso, porque o filtro por unidade consegue detecta-lo.</li>
 * </ol>
 */
export function unidadePadrao(): number {
  const sessao = getSessao();
  if (sessao && sessao.unidadeId) return Number(sessao.unidadeId);
  const primeira = CACHE.unidades[0];
  if (primeira) return Number(primeira.id);
  return 0;
}

/**
 * Registros que ainda apontam para uma unidade.
 *
 * <p>Usado pela tela de administracao para impedir a exclusao de uma unidade
 * que ainda tem salas, turmas, reservas, chaves ou solicitacoes — sem isso
 * o banco fica com referencias orfas (as colunas nao tem chave estrangeira).
 */
export function referenciasDaUnidade(unidadeId: number | string): string[] {
  const alvo = String(unidadeId);
  const conta = <T extends { unidadeId?: number | null }>(lista: T[]): number =>
    lista.filter((r) => String(r.unidadeId) === alvo).length;
  const pendencias: string[] = [];
  if (conta(CACHE.usuarios) > 0) pendencias.push('usuarios');
  if (conta(CACHE.salas) > 0) pendencias.push('salas');
  if (conta(CACHE.turmas) > 0) pendencias.push('turmas');
  if (conta(CACHE.reservas) > 0) pendencias.push('reservas');
  if (conta(CACHE.chaves) > 0) pendencias.push('chaves');
  if (conta(CACHE.solicitacoes) > 0) pendencias.push('solicitacoes');
  return pendencias;
}

// ---------------------------------------------------------------------------
// Leitura — Salas
// ---------------------------------------------------------------------------

export function getSalas(): Sala[] {
  return [...CACHE.salas];
}

export function getSalaById(id: number | string | null | undefined): Sala | null {
  if (id === null || id === undefined || id === '') return null;
  return CACHE.salas.find((s) => String(s.id) === String(id)) ?? null;
}

/**
 * Compara dois `unidadeId` de forma tolerante ao tipo.
 *
 * <p>Era o ponto de falha da entidade Unidade: as telas comparavam
 * `registro.unidadeId === uid()` (igualdade estrita). Com `uid()` nulo
 * (sessao sem unidade) a comparacao dava sempre `false` e a lista saia
 * VAZIA; e com o id vindo como texto do servidor (`"1001"`) o `===` tambem
 * falhava. Aqui a comparacao e feita por texto, e dois ids ausentes
 * (<code>null</code>/<code>undefined</code>) nao sao consideredos iguais —
 * um registro sem unidade e um registro orfao, nunca pertence a uma unidade.
 */
export function mesmaUnidade(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): boolean {
  if (a === null || a === undefined || a === '') return false;
  if (b === null || b === undefined || b === '') return false;
  return String(a) === String(b);
}

/**
 * Unidade da sessao logada, ou `null` quando nao ha sessao/unidade.
 *
 * <p>Use `mesmaUnidade(x.unidadeId, unidadeDaSessao())` para filtrar.
 */
export function unidadeDaSessao(): number | null {
  const sess = getSessao();
  if (!sess || sess.unidadeId === null || sess.unidadeId === undefined) return null;
  return Number(sess.unidadeId);
}

export function getSalasByUnidade(uid: number | string | null | undefined): Sala[] {
  if (uid === null || uid === undefined || uid === '') return [];
  return CACHE.salas.filter((s) => mesmaUnidade(s.unidadeId, uid));
}

// ---------------------------------------------------------------------------
// Leitura — Turmas
// ---------------------------------------------------------------------------

export function getTurmas(): Turma[] {
  return [...CACHE.turmas];
}

export function getTurmaById(id: number | string | null | undefined): Turma | null {
  if (id === null || id === undefined || id === '') return null;
  return CACHE.turmas.find((t) => String(t.id) === String(id)) ?? null;
}

// ---------------------------------------------------------------------------
// Leitura — Reservas
// ---------------------------------------------------------------------------

export function getReservas(): Reserva[] {
  return [...CACHE.reservas];
}

export function getReservaById(id: number | string | null | undefined): Reserva | null {
  if (id === null || id === undefined || id === '') return null;
  return CACHE.reservas.find((r) => String(r.id) === String(id)) ?? null;
}

// ---------------------------------------------------------------------------
// Leitura — Chaves
// ---------------------------------------------------------------------------

export function getChaves(): Chave[] {
  return [...CACHE.chaves];
}

export function getChaveById(id: number | string | null | undefined): Chave | null {
  if (id === null || id === undefined || id === '') return null;
  return CACHE.chaves.find((c) => String(c.id) === String(id)) ?? null;
}

// ---------------------------------------------------------------------------
// Leitura — Notificacoes
// ---------------------------------------------------------------------------

/**
 * Notificacoes visiveis para um perfil/unidade.
 *
 * Regras preservadas do legado: (1) destinatario direto (`paraId`) tem
 * precedencia; (2) caso contrario, vale `paraPerfil`; (3) `unidadeId` so
 * filtra quando ambos os lados estao preenchidos.
 */
export function getNotifsPara(perfil: Perfil | string, unidadeId?: number | string | null): Notificacao[] {
  const sess = getSessao();
  const pn = lowerPerfil(perfil);

  return CACHE.notificacoes.filter((n) => {
    if (sess && n.paraId && String(n.paraId) === String(sess.id)) return true;

    if (n.paraPerfil && lowerPerfil(n.paraPerfil) === pn) {
      return !n.unidadeId || !unidadeId || mesmaUnidade(n.unidadeId, unidadeId);
    }

    return false;
  });
}

// ---------------------------------------------------------------------------
// Leitura — Solicitacoes
// ---------------------------------------------------------------------------

export function getSolics(): Solicitacao[] {
  return [...CACHE.solicitacoes];
}

// ---------------------------------------------------------------------------
// Autenticacao
// ---------------------------------------------------------------------------

/**
 * Autentica um usuario.
 *
 * 1) valida no servidor central (mesmo banco usado pelo mobile);
 * 2) em caso de falha/indisponibilidade, valida contra o cache local.
 */
export async function loginUser(email: string, senha: string): Promise<Usuario | null> {
  try {
    const resposta = await loginRemoto(email, senha);
    const usuario = extrairUsuarioLogin(resposta);
    if (usuario) {
      // armazena o token JWT para uso nas proximas requisicoes
      const token = (resposta as { token?: string }).token;
      if (token) salvarToken(token);
      return usuario;
    }
  } catch (e) {
    // 401 = credenciais invalidas ou sessao expirada: nao cai para offline
    if (e instanceof Error && 'status' in e && (e as { status: number }).status === 401) {
      salvarToken(null);
      return null;
    }
    /* offline: cai para a validacao local */
  }

  // Modo offline: nao validamos senha localmente (seguranca).
  // Se existir um token JWT armazenado, permite acesso com o usuario em cache.
  const token = obterToken();
  if (token) {
    const alvo = email.toLowerCase();
    const u = CACHE.usuarios.find(
      (x) => (x.email ?? '').toLowerCase() === alvo,
    );
    if (u) return { ...u };
  }

  return null;
}

// ---------------------------------------------------------------------------
// CRUD — Usuarios
// ---------------------------------------------------------------------------

export async function addUser(dados: NovoUsuario & { nome: string; email: string; perfil: Perfil | string; unidadeId: number }): Promise<Usuario> {
  const item: Usuario = {
    ...dados,
    id: nextId(CACHE.usuarios),
    perfil: lowerPerfil(dados.perfil) as Perfil,
  };
  const senha = (dados as unknown as { senha?: string }).senha;
  delete (item as unknown as { senha?: string }).senha;
  CACHE.usuarios.push(item);
  persist('usuarios', payloadDaColecao('usuarios', 'criados', { ...item, ...(senha ? { senha } : {}) }), item);
  await confirmar(item);
  return item;
}

export async function updUser(id: number | string, dados: Atualizar<Usuario>): Promise<Usuario | null> {
  const idx = CACHE.usuarios.findIndex((u) => String(u.id) === String(id));
  if (idx < 0) return null;

  const payload: Atualizar<Usuario> = { ...dados };
  if (payload.perfil) payload.perfil = lowerPerfil(payload.perfil) as Perfil;

  CACHE.usuarios[idx] = { ...CACHE.usuarios[idx], ...payload };
  const senha = (payload as unknown as { senha?: string }).senha;
  delete (CACHE.usuarios[idx] as unknown as { senha?: string }).senha;
  persist('usuarios', payloadDaColecao('usuarios', 'alteracoes', { ...CACHE.usuarios[idx], ...(senha ? { senha } : {}) }), CACHE.usuarios[idx]);
  await confirmar(CACHE.usuarios[idx]);
  return { ...CACHE.usuarios[idx] };
}

export async function delUser(id: number | string): Promise<void> {
  CACHE.usuarios = CACHE.usuarios.filter((u) => String(u.id) !== String(id));
  persist('usuarios', { remocoes: { usuarios: [Number(id)] } });
}

export async function delUserAsync(id: number | string): Promise<void> {
  await delUser(id);
  await confirmarFila();
}

// ---------------------------------------------------------------------------
// CRUD — Unidades
// ---------------------------------------------------------------------------

export function addUnidade(d: NovoUnidade): Unidade {
  const item: Unidade = { ...d, id: nextId(CACHE.unidades) };
  CACHE.unidades.push(item);
  persist('unidades', payloadDaColecao('unidades', 'criados', item), item);
  return item;
}

export async function addUnidadeAsync(d: NovoUnidade): Promise<Unidade> {
  const item = addUnidade(d);
  await confirmar(item);
  return { ...item };
}

export function updUnidade(id: number | string, d: Atualizar<Unidade>): Unidade | null {
  const idx = CACHE.unidades.findIndex((u) => String(u.id) === String(id));
  if (idx < 0) return null;
  CACHE.unidades[idx] = { ...CACHE.unidades[idx], ...d };
  persist('unidades', payloadDaColecao('unidades', 'alteracoes', CACHE.unidades[idx]), CACHE.unidades[idx]);
  return { ...CACHE.unidades[idx] };
}

export async function updUnidadeAsync(id: number | string, d: Atualizar<Unidade>): Promise<Unidade | null> {
  const item = updUnidade(id, d);
  if (!item) return null;
  await confirmar(CACHE.unidades.find((u) => String(u.id) === String(id)) ?? null);
  return item;
}

export function delUnidade(id: number | string): void {
  CACHE.unidades = CACHE.unidades.filter((u) => String(u.id) !== String(id));
  persist('unidades', { remocoes: { unidades: [Number(id)] } });
}

export async function delUnidadeAsync(id: number | string): Promise<void> {
  delUnidade(id);
  await confirmarFila();
}

// ---------------------------------------------------------------------------
// CRUD — Salas
// ---------------------------------------------------------------------------

/**
 * Entrada de `addSala`/`addTurma`.
 *
 * `unidadeId` e opcional porque as paginas de demonstracao (`dashboard.html`)
 * cadastram salas e turmas sem contexto de unidade — o legado tambem gravava o
 * registro sem esse campo.
 */
export type NovaSalaSemUnidade = Omit<NovoSala, 'unidadeId'> & { unidadeId?: number };
export type NovaTurmaSemUnidade = Omit<NovoTurma, 'unidadeId'> & { unidadeId?: number };

export function addSala(d: NovaSalaSemUnidade): Sala {
  const turnos = d.turnosDisponiveis ?? d.turnos ?? [];
  const item: Sala = {
    ...d,
    id: nextId(CACHE.salas),
    turnosDisponiveis: turnos,
    turnos,
    // Antes: `d.unidadeId as number` — o cast mascarava `undefined` em
    // runtime e a sala naso aparecia em nenhum filtro por unidade.
    unidadeId: d.unidadeId ?? unidadePadrao(),
  };
  CACHE.salas.push(item);
  persist('salas', payloadDaColecao('salas', 'criados', item), item);
  return item;
}

export async function addSalaAsync(d: NovaSalaSemUnidade): Promise<Sala> {
  const item = addSala(d);
  await confirmar(item);
  return { ...item };
}

export function updSala(id: number | string, d: Atualizar<Sala>): Sala | null {
  const idx = CACHE.salas.findIndex((s) => String(s.id) === String(id));
  if (idx < 0) return null;

  const turnos = d.turnosDisponiveis ?? d.turnos ?? CACHE.salas[idx].turnosDisponiveis ?? [];
  CACHE.salas[idx] = { ...CACHE.salas[idx], ...d, turnosDisponiveis: turnos, turnos };
  persist('salas', payloadDaColecao('salas', 'alteracoes', CACHE.salas[idx]), CACHE.salas[idx]);
  return { ...CACHE.salas[idx] };
}

export async function updSalaAsync(id: number | string, d: Atualizar<Sala>): Promise<Sala | null> {
  const item = updSala(id, d);
  if (!item) return null;
  await confirmar(CACHE.salas.find((s) => String(s.id) === String(id)) ?? null);
  return item;
}

export function delSala(id: number | string): void {
  CACHE.salas = CACHE.salas.filter((s) => String(s.id) !== String(id));
  persist('salas', { remocoes: { salas: [Number(id)] } });
}

export async function delSalaAsync(id: number | string): Promise<void> {
  delSala(id);
  await confirmarFila();
}

// ---------------------------------------------------------------------------
// CRUD — Turmas
// ---------------------------------------------------------------------------

/**
 * Cria uma turma. O legado sincroniza `nome` e `codigo` no mesmo valor
 * (regra de exibicao mantida — ver `docs/CASO_DE_USO.md` UC-06).
 */
export function addTurma(d: NovaTurmaSemUnidade): Turma {
  const nome = d.codigo || d.nome || '';
  const item:Turma = {
    ...d,
    id: nextId(CACHE.turmas),
    nome,
    codigo: nome,
    // Antes: `d.unidadeId as number` — mesma correcao de `addSala`.
    unidadeId: d.unidadeId ?? unidadePadrao(),
  };
  CACHE.turmas.push(item);
  persist('turmas', payloadDaColecao('turmas', 'criados', item), item);
  return item;
}

export async function addTurmaAsync(d: NovaTurmaSemUnidade): Promise<Turma> {
  const item = addTurma(d);
  await confirmar(item);
  return { ...item };
}

export function updTurma(id: number | string, d: Atualizar<Turma>): Turma | null {
  const idx = CACHE.turmas.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) return null;
  CACHE.turmas[idx] = { ...CACHE.turmas[idx], ...d };
  persist('turmas', payloadDaColecao('turmas', 'alteracoes', CACHE.turmas[idx]), CACHE.turmas[idx]);
  return { ...CACHE.turmas[idx] };
}

export async function updTurmaAsync(id: number | string, d: Atualizar<Turma>): Promise<Turma | null> {
  const item = updTurma(id, d);
  if (!item) return null;
  await confirmar(CACHE.turmas.find((t) => String(t.id) === String(id)) ?? null);
  return item;
}

/**
 * Exclui uma turma e, em cascata no cliente, as reservas vinculadas.
 * (Regra do legado — ver `README.md` do frontend original.)
 */
export function delTurma(id: number | string): void {
  const reservasRemovidas = CACHE.reservas
    .filter((r) => String(r.turmaId) === String(id))
    .map((r) => Number(r.id));
  CACHE.turmas = CACHE.turmas.filter((t) => String(t.id) !== String(id));
  CACHE.reservas = CACHE.reservas.filter((r) => String(r.turmaId) !== String(id));

  persist('turmas', { remocoes: { turmas: [Number(id)] } });
  if (reservasRemovidas.length) persist('reservas', { remocoes: { reservas: reservasRemovidas } });
}

export async function delTurmaAsync(id: number | string): Promise<void> {
  delTurma(id);
  await confirmarFila();
}

// ---------------------------------------------------------------------------
// CRUD — Reservas
// ---------------------------------------------------------------------------

export function addReserva(d: NovaReserva): Reserva {
  const item: Reserva = {
    ...d,
    id: nextId(CACHE.reservas),
    status: d.status || 'ATIVA',
    unidadeId: d.unidadeId ?? unidadePadrao(),
  };
  CACHE.reservas.push(item);
  persist('reservas', payloadDaColecao('reservas', 'criados', item), item);
  return item;
}

export async function addReservaAsync(d: NovaReserva): Promise<Reserva> {
  const item = addReserva(d);
  await confirmar(item);
  return { ...item };
}

export async function updReservaAsync(id: number | string, d: Atualizar<Reserva>): Promise<Reserva | null> {
  const item = updReserva(id, d);
  if (!item) return null;
  await confirmar(CACHE.reservas.find((r) => String(r.id) === String(id)) ?? null);
  return item;
}

export function updReserva(id: number | string, d: Atualizar<Reserva>): Reserva | null {
  const idx = CACHE.reservas.findIndex((r) => String(r.id) === String(id));
  if (idx < 0) return null;
  CACHE.reservas[idx] = { ...CACHE.reservas[idx], ...d };
  persist('reservas', payloadDaColecao('reservas', 'alteracoes', CACHE.reservas[idx]), CACHE.reservas[idx]);
  return { ...CACHE.reservas[idx] };
}

export function delReserva(id: number | string): void {
  CACHE.reservas = CACHE.reservas.filter((r) => String(r.id) !== String(id));
  persist('reservas', { remocoes: { reservas: [Number(id)] } });
}

export async function delReservaAsync(id: number | string): Promise<void> {
  delReserva(id);
  await confirmarFila();
}

// ---------------------------------------------------------------------------
// CRUD — Chaves
// ---------------------------------------------------------------------------

export function addChave(d: NovaChave): Chave {
  const item: Chave = {
    ...d,
    id: nextId(CACHE.chaves),
    status: d.status || 'disponivel',
    unidadeId: d.unidadeId ?? unidadePadrao(),
  };
  CACHE.chaves.push(item);
  persist('chaves', payloadDaColecao('chaves', 'criados', item), item);
  return item;
}

export function updChave(id: number | string, d: Atualizar<Chave>): Chave | null {
  const idx = CACHE.chaves.findIndex((c) => String(c.id) === String(id));
  if (idx < 0) return null;
  CACHE.chaves[idx] = { ...CACHE.chaves[idx], ...d };
  persist('chaves', payloadDaColecao('chaves', 'alteracoes', CACHE.chaves[idx]), CACHE.chaves[idx]);
  return { ...CACHE.chaves[idx] };
}

export async function updChaveAsync(id: number | string, d: Atualizar<Chave>): Promise<Chave | null> {
  const item = updChave(id, d);
  if (!item) return null;
  await confirmar(CACHE.chaves.find((c) => String(c.id) === String(id)) ?? null);
  return item;
}

export function delChave(id: number | string): void {
  CACHE.chaves = CACHE.chaves.filter((c) => String(c.id) !== String(id));
  persist('chaves', { remocoes: { chaves: [Number(id)] } });
}

export async function delChaveAsync(id: number | string): Promise<void> {
  delChave(id);
  await confirmarFila();
}

/** Registra a retirada de uma chave por um instrutor. */
export function retirarChave(id: number | string, instrutorId: number | string): Chave | null {
  return updChave(id, {
    status: 'pega',
    instrutorId: Number(instrutorId),
    pegaEm: new Date().toISOString(),
  });
}

export async function retirarChaveAsync(id: number | string, instrutorId: number | string): Promise<Chave | null> {
  const item = retirarChave(id, instrutorId);
  await confirmar(CACHE.chaves.find((c) => String(c.id) === String(id)) ?? null);
  return item;
}

/**
 * Registra a devolucao de uma chave.
 *
 * ATENCAO — pendencia conhecida (documentada em
 * `docs/RELATORIO_REFATORACAO.md`): o legado APAGA `instrutorId` e `pegaEm`,
 * pagando o custo de nao manter historico de movimentacoes. O comportamento
 * foi mantido deliberadamente para nao alterar regra de negocio nesta tarefa.
 */
export function devolverChaveApi(id: number | string): Chave | null {
  return updChave(id, { status: 'disponivel', instrutorId: null, pegaEm: null });
}

export async function devolverChaveAsync(id: number | string): Promise<Chave | null> {
  const item = devolverChaveApi(id);
  await confirmar(CACHE.chaves.find((c) => String(c.id) === String(id)) ?? null);
  return item;
}

export async function addChaveAsync(d: NovaChave): Promise<Chave> {
  const item = addChave(d);
  await confirmar(item);
  return { ...item };
}

// ---------------------------------------------------------------------------
// CRUD — Solicitacoes
// ---------------------------------------------------------------------------

export function addSolic(d: NovaSolicitacao): Solicitacao {
  const item: Solicitacao = {
    ...d,
    id: nextId(CACHE.solicitacoes),
    status: d.status || 'pendente',
    unidadeId: d.unidadeId ?? unidadePadrao(),
  };
  CACHE.solicitacoes.push(item);
  persist('solicitacoes', payloadDaColecao('solicitacoes', 'criados', item), item);
  return item;
}

export async function addSolicAsync(d: NovaSolicitacao): Promise<Solicitacao> {
  const item = addSolic(d);
  await confirmar(item);
  return { ...item };
}

export function updSolic(id: number | string, d: Atualizar<Solicitacao>): Solicitacao | null {
  const idx = CACHE.solicitacoes.findIndex((s) => String(s.id) === String(id));
  if (idx < 0) return null;
  CACHE.solicitacoes[idx] = { ...CACHE.solicitacoes[idx], ...d };
  persist('solicitacoes', payloadDaColecao('solicitacoes', 'alteracoes', CACHE.solicitacoes[idx]), CACHE.solicitacoes[idx]);
  return { ...CACHE.solicitacoes[idx] };
}

export async function updSolicAsync(id: number | string, d: Atualizar<Solicitacao>): Promise<Solicitacao | null> {
  const item = updSolic(id, d);
  if (!item) return null;
  await confirmar(CACHE.solicitacoes.find((s) => String(s.id) === String(id)) ?? null);
  return item;
}

// ---------------------------------------------------------------------------
// CRUD — Notificacoes
// ---------------------------------------------------------------------------

/**
 * Cria uma notificacao, normalizando os nomes de campo aceitos pelo legado
 * (`msg`/`mensagem`, `paraPerfil`/`para`, `paraId`/`paraUsuarioId`).
 */
export function addNotif(
  d: Partial<Notificacao> & {
    msg?: string;
    texto?: string;
    title?: string;
    para?: string;
    paraUsuarioId?: number | null;
  },
): Notificacao {
  const item: Notificacao = {
    id: nextId(CACHE.notificacoes),
    tipo: d.tipo || 'info',
    titulo: d.titulo || d.title || '',
    msg: d.msg || d.texto || '',
    mensagem: d.mensagem || '',
    paraPerfil: lowerPerfil(d.paraPerfil || d.para || ''),
    paraId: d.paraId ?? d.paraUsuarioId ?? null,
    unidadeId: d.unidadeId ?? null,
    lida: false,
    criadaEm: new Date().toISOString(),
  };

  CACHE.notificacoes.push(item);
  persist('notificacoes', payloadDaColecao('notificacoes', 'criados', item), item);
  return item;
}

export async function addNotifAsync(d: Parameters<typeof addNotif>[0]): Promise<Notificacao> {
  const item = addNotif(d);
  await confirmar(item);
  return { ...item };
}

export function countNaoLidas(perfil: Perfil | string, unidadeId?: number | string | null): number {
  return getNotifsPara(perfil, unidadeId).filter((n) => !n.lida).length;
}

export function marcarTodasLidas(perfil: Perfil | string, unidadeId?: number | string | null): void {
  const alteradas = getNotifsPara(perfil, unidadeId);
  alteradas.forEach((n) => {
    n.lida = true;
  });
  if (alteradas.length) persist('notificacoes', { alteracoes: { notificacoes: alteradas } }, alteradas[0]);
}

// ---------------------------------------------------------------------------
// Override manual de status de sala
// ---------------------------------------------------------------------------

export interface OverrideSala {
  status: StatusManualSala;
  motivo: string;
  por: string;
  criadaEm: string | null;
}

/** Override manual ativo para uma sala, ou `null`. */
export function getOverride(salaId: number | string, unidadeId?: number | string | null): OverrideSala | null {
  const sala = getSalaById(salaId);
  if (!sala || !sala.statusManual) return null;

  if (unidadeId && sala.unidadeId && String(sala.unidadeId) !== String(unidadeId)) return null;

  return {
    status: sala.statusManual,
    motivo: sala.motivoManual || '',
    por: sala.manualPor || '',
    criadaEm: sala.manualCriadaEm || null,
  };
}

/** Define (ou limpa, quando `status` e nulo) o override manual da sala. */
export function setOverride(
  salaId: number | string,
  unidadeId: number | string | null | undefined,
  status: StatusManualSala | null,
  motivo?: string,
  por?: string,
): Sala | null {
  return updSala(salaId, {
    statusManual: status,
    motivoManual: status ? motivo || '' : '',
    manualPor: status ? por || '' : '',
    manualCriadaEm: status ? new Date().toISOString().slice(0, 19) : null,
    unidadeId: unidadeId ? Number(unidadeId) : undefined,
  });
}

/** Versao aguardada de {@link setOverride}: só confirma após a API. */
export async function setOverrideAsync(
  salaId: number | string,
  unidadeId: number | string | null | undefined,
  status: StatusManualSala | null,
  motivo?: string,
  por?: string,
): Promise<Sala | null> {
  const item = setOverride(salaId, unidadeId, status, motivo, por);
  if (!item) return null;
  await confirmar(CACHE.salas.find((s) => String(s.id) === String(salaId)) ?? null);
  return item;
}

// ---------------------------------------------------------------------------
// Sessao / tema (re-exportados de ./theme para preservar a superficie global)
// ---------------------------------------------------------------------------

export { clearSessao, getSessao, getTema, initTema, setSessao, toggleTema } from './theme';
export type { Sessao };

// ---------------------------------------------------------------------------
// Inicializacao
// ---------------------------------------------------------------------------

/**
 * Carrega todos os dados.
 *
 * Apos popular o cache local, sincroniza com o servidor central, que passa a
 * ser a fonte da verdade — assim, alteracoes feitas no mobile aparecem no web.
 */
export async function loadAllData(force = false): Promise<CacheDados> {
  if (!CACHE.loaded || force) {
    loadCache();
    CACHE.loaded = true;
  }

  await sincronizarServidor();

  return CACHE;
}

/** Alias historico de {@link loadAllData}. */
export async function initDados(force = false): Promise<CacheDados> {
  await loadAllData(force);
  console.log(
    '%c<svg width="1em" height="1em">OK</svg> core/storage.ts — dados carregados',
    'color:#10b981;font-weight:bold',
  );
  return CACHE;
}

/** Tipos auxiliares reexportados para convenience das paginas. */
export type { NovaChave, NovaNotificacao, NovaSolicitacao, NovoSala, NovoTurma, NovoUnidade, NovoUsuario };
