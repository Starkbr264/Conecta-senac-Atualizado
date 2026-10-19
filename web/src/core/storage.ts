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

import { buscarDados, login as loginRemoto, sincronizar, extrairUsuarioLogin } from './api';
import { getSessao } from './theme';
import type {
  Atualizar,
  Chave,
  NovaChave,
  NovaNotificacao,
  NovaReserva,
  NovaSolicitacao,
  NovaSolicitacao as _NovaSolicitacao,
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

/** Proximo id livre de uma colecao (max + 1, como no legado). */
function nextId(lista: Array<{ id: number }>): number {
  return lista.reduce((mx, x) => Math.max(mx, Number(x.id) || 0), 0) + 1;
}

/** Copia ordenada por id. */
export function sortById<T extends { id: number }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
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
}

/** Grava a colecao no localStorage e a propaga ao servidor. */
function persist(key: Colecao): void {
  sv(K[key], CACHE[key]);
  pushColecao(key);
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
function pushColecao(key: Colecao): void {
  const itens = CACHE[key] as unknown[] | undefined;
  if (!itens) return;

  try {
    const remocoes: Partial<Record<Colecao, number[]>> = {};
    const fila = CACHE._remocoes[key];
    if (fila && fila.length) remocoes[key] = fila;

    sincronizar({ alteracoes: { [key]: itens }, remocoes })
      .then(() => {
        delete CACHE._remocoes[key];
      })
      .catch(() => {
        /* servidor indisponivel: mantem a fila para a proxima sincronizacao */
      });
  } catch {
    /* nunca interrompe a operacao local */
  }
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
  try {
    if (CACHE._remocoes && Object.keys(CACHE._remocoes).length) {
      const remocoes: Partial<Record<Colecao, number[]>> = {};
      Object.keys(CACHE._remocoes).forEach((chave) => {
        const fila = CACHE._remocoes[chave as Colecao];
        if (fila && fila.length) remocoes[chave as Colecao] = fila;
      });

      if (Object.keys(remocoes).length) {
        await sincronizar({ alteracoes: {}, remocoes });
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

/** Alias historico mantido por compatibilidade. */
export function getUsuariosByPerfil(perfil: Perfil | string): Usuario[] {
  return getUsersByPerfil(perfil);
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

export function getSalasByUnidade(uid: number | string): Sala[] {
  return CACHE.salas.filter((s) => String(s.unidadeId) === String(uid));
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

export function getNotifs(): Notificacao[] {
  return [...CACHE.notificacoes];
}

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
      return !n.unidadeId || !unidadeId || String(n.unidadeId) === String(unidadeId);
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
    if (usuario) return usuario;
  } catch {
    /* offline: cai para a validacao local */
  }

  const alvo = email.toLowerCase();
  const u = CACHE.usuarios.find(
    (x) => (x.email ?? '').toLowerCase() === alvo && x.senha === senha,
  );

  return u ? { ...u } : null;
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
  CACHE.usuarios.push(item);
  persist('usuarios');
  return item;
}

export async function addUsuario(dados: NovoUsuario & { nome: string; email: string; perfil: Perfil | string; unidadeId: number }): Promise<Usuario> {
  return addUser(dados);
}

export async function updUser(id: number | string, dados: Atualizar<Usuario>): Promise<Usuario | null> {
  const idx = CACHE.usuarios.findIndex((u) => String(u.id) === String(id));
  if (idx < 0) return null;

  const payload: Atualizar<Usuario> = { ...dados };
  if (payload.perfil) payload.perfil = lowerPerfil(payload.perfil) as Perfil;

  CACHE.usuarios[idx] = { ...CACHE.usuarios[idx], ...payload };
  persist('usuarios');
  return { ...CACHE.usuarios[idx] };
}

export async function updUsuario(id: number | string, dados: Atualizar<Usuario>): Promise<Usuario | null> {
  return updUser(id, dados);
}

export async function delUser(id: number | string): Promise<void> {
  CACHE.usuarios = CACHE.usuarios.filter((u) => String(u.id) !== String(id));
  marcarRemovido('usuarios', Number(id));
  persist('usuarios');
}

export async function delUsuario(id: number | string): Promise<void> {
  return delUser(id);
}

// ---------------------------------------------------------------------------
// CRUD — Unidades
// ---------------------------------------------------------------------------

export function addUnidade(d: NovoUnidade): Unidade {
  const item: Unidade = { ...d, id: nextId(CACHE.unidades) };
  CACHE.unidades.push(item);
  persist('unidades');
  return item;
}

export function updUnidade(id: number | string, d: Atualizar<Unidade>): Unidade | null {
  const idx = CACHE.unidades.findIndex((u) => String(u.id) === String(id));
  if (idx < 0) return null;
  CACHE.unidades[idx] = { ...CACHE.unidades[idx], ...d };
  persist('unidades');
  return { ...CACHE.unidades[idx] };
}

export function delUnidade(id: number | string): void {
  CACHE.unidades = CACHE.unidades.filter((u) => String(u.id) !== String(id));
  marcarRemovido('unidades', Number(id));
  persist('unidades');
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
    unidadeId: d.unidadeId as number,
  };
  CACHE.salas.push(item);
  persist('salas');
  return item;
}

export function updSala(id: number | string, d: Atualizar<Sala>): Sala | null {
  const idx = CACHE.salas.findIndex((s) => String(s.id) === String(id));
  if (idx < 0) return null;

  const turnos = d.turnosDisponiveis ?? d.turnos ?? CACHE.salas[idx].turnosDisponiveis ?? [];
  CACHE.salas[idx] = { ...CACHE.salas[idx], ...d, turnosDisponiveis: turnos, turnos };
  persist('salas');
  return { ...CACHE.salas[idx] };
}

export function updateSala(id: number | string, d: Atualizar<Sala>): Sala | null {
  return updSala(id, d);
}

export function delSala(id: number | string): void {
  CACHE.salas = CACHE.salas.filter((s) => String(s.id) !== String(id));
  marcarRemovido('salas', Number(id));
  persist('salas');
}

export function deleteSala(id: number | string): void {
  return delSala(id);
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
    unidadeId: d.unidadeId as number,
  };
  CACHE.turmas.push(item);
  persist('turmas');
  return item;
}

export function updTurma(id: number | string, d: Atualizar<Turma>): Turma | null {
  const idx = CACHE.turmas.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) return null;
  CACHE.turmas[idx] = { ...CACHE.turmas[idx], ...d };
  persist('turmas');
  return { ...CACHE.turmas[idx] };
}

export function updateTurma(id: number | string, d: Atualizar<Turma>): Turma | null {
  return updTurma(id, d);
}

/**
 * Exclui uma turma e, em cascata no cliente, as reservas vinculadas.
 * (Regra do legado — ver `README.md` do frontend original.)
 */
export function delTurma(id: number | string): void {
  CACHE.turmas = CACHE.turmas.filter((t) => String(t.id) !== String(id));
  marcarRemovido('turmas', Number(id));

  CACHE.reservas = CACHE.reservas.filter((r) => String(r.turmaId) !== String(id));

  persist('turmas');
  persist('reservas');
}

export function deleteTurma(id: number | string): void {
  return delTurma(id);
}

// ---------------------------------------------------------------------------
// CRUD — Reservas
// ---------------------------------------------------------------------------

export function addReserva(d: NovaReserva): Reserva {
  const item: Reserva = { ...d, id: nextId(CACHE.reservas), status: d.status || 'ATIVA' };
  CACHE.reservas.push(item);
  persist('reservas');
  return item;
}

export async function addReservaAsync(d: NovaReserva): Promise<Reserva> {
  return addReserva(d);
}

export function updReserva(id: number | string, d: Atualizar<Reserva>): Reserva | null {
  const idx = CACHE.reservas.findIndex((r) => String(r.id) === String(id));
  if (idx < 0) return null;
  CACHE.reservas[idx] = { ...CACHE.reservas[idx], ...d };
  persist('reservas');
  return { ...CACHE.reservas[idx] };
}

export function delReserva(id: number | string): void {
  CACHE.reservas = CACHE.reservas.filter((r) => String(r.id) !== String(id));
  marcarRemovido('reservas', Number(id));
  persist('reservas');
}

export function deleteReserva(id: number | string): void {
  return delReserva(id);
}

// ---------------------------------------------------------------------------
// CRUD — Chaves
// ---------------------------------------------------------------------------

export function addChave(d: NovaChave): Chave {
  const item: Chave = { ...d, id: nextId(CACHE.chaves), status: d.status || 'disponivel' };
  CACHE.chaves.push(item);
  persist('chaves');
  return item;
}

export function updChave(id: number | string, d: Atualizar<Chave>): Chave | null {
  const idx = CACHE.chaves.findIndex((c) => String(c.id) === String(id));
  if (idx < 0) return null;
  CACHE.chaves[idx] = { ...CACHE.chaves[idx], ...d };
  persist('chaves');
  return { ...CACHE.chaves[idx] };
}

export function delChave(id: number | string): void {
  CACHE.chaves = CACHE.chaves.filter((c) => String(c.id) !== String(id));
  marcarRemovido('chaves', Number(id));
  persist('chaves');
}

export function deleteChave(id: number | string): void {
  return delChave(id);
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
  return retirarChave(id, instrutorId);
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
  return devolverChaveApi(id);
}

// ---------------------------------------------------------------------------
// CRUD — Solicitacoes
// ---------------------------------------------------------------------------

export function addSolic(d: NovaSolicitacao): Solicitacao {
  const item: Solicitacao = { ...d, id: nextId(CACHE.solicitacoes), status: d.status || 'pendente' };
  CACHE.solicitacoes.push(item);
  persist('solicitacoes');
  return item;
}

export function updSolic(id: number | string, d: Atualizar<Solicitacao>): Solicitacao | null {
  const idx = CACHE.solicitacoes.findIndex((s) => String(s.id) === String(id));
  if (idx < 0) return null;
  CACHE.solicitacoes[idx] = { ...CACHE.solicitacoes[idx], ...d };
  persist('solicitacoes');
  return { ...CACHE.solicitacoes[idx] };
}

export async function updSolicAsync(id: number | string, d: Atualizar<Solicitacao>): Promise<Solicitacao | null> {
  return updSolic(id, d);
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
  persist('notificacoes');
  return item;
}

export async function addNotifAsync(d: Parameters<typeof addNotif>[0]): Promise<Notificacao> {
  return addNotif(d);
}

export function countNaoLidas(perfil: Perfil | string, unidadeId?: number | string | null): number {
  return getNotifsPara(perfil, unidadeId).filter((n) => !n.lida).length;
}

export function marcarTodasLidas(perfil: Perfil | string, unidadeId?: number | string | null): void {
  getNotifsPara(perfil, unidadeId).forEach((n) => {
    n.lida = true;
  });
  persist('notificacoes');
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

/** Marca o cache como carregado sem sincronizar (uso em testes). */
export function resetCache(): void {
  CACHE.loaded = false;
  CACHE.loadingPromise = null;
  CACHE._remocoes = {};
}

/** Reexporta o tipo de sessao usado pelos módulos de pagina. */
export type SessaoUsuario = Sessao;

/** Tipos auxiliares reexportados para convenience das paginas. */
export type { NovaChave, NovaNotificacao, NovaSolicitacao, NovoSala, NovoTurma, NovoUnidade, NovoUsuario };