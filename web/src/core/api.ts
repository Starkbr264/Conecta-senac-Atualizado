/**
 * Cliente HTTP do frontend web.
 *
 * FONTE DA VERDADE UNICA: o backend Spring Boot em `backend/demo/`
 * (porta 8081, Postgres/Supabase), que tambem serve esta SPA — quando o
 * build usa `VITE_API_BASE=same-origin`, a API fica na MESMA origem da
 * pagina e nao ha CORS nem porta extra.
 *
 * O servidor Node em `server/` (porta 3333, `server/data/db.json`) e um
 * MOCK LEGADO, usado so em desenvolvimento offline. As duas APIs expõem o
 * MESMO contrato HTTP; o mock nunca deve rodar junto da API real sobre o
 * mesmo cliente. Ver `compose.yaml` e `docs/ARQUITETURA_ATUALIZADA.md`.
 *
 * Endpoints usados (paridade total com `mobile/src/services/api.ts`):
 *   - GET  /api/dados   -> baixa o banco completo
 *   - POST /api/login   -> valida credenciais
 *   - POST /api/sinc    -> envia as alteracoes locais
 *   - POST /api/reset   -> recarrega os dados de exemplo
 *   - GET  /api/sessao  -> le a sessao global
 *   - POST /api/logout  -> encerra a sessao
 *
 * Nenhum endpoint, metodo ou formato de payload foi alterado. Esta camada
 * apenas isola o `fetch` e adiciona tipagem sobre os tipos reais.
 */

import type {
  BancoDados,
  RespostaErro,
  RespostaLogin,
  Sessao,
  Unidade,
  Usuario,
} from '../types';

/**
 * Sentinela aceito em `__CONECTA_API_BASE__` e em `VITE_API_BASE` para
 * significa "mesma origem da pagina".
 *
 * Existe um sentinela em vez de aceitar string vazia porque o Vite **nao**
 * registra a variavel de ambiente quando ela vale `""`: o `import.meta.env`
 * gerado vira o objeto literal `{}` e o valor se perde silenciosamente. Um
 * token nao vazio sempre e inlinado no bundle.
 */
const SENTINELA_MESMA_ORIGEM = 'same-origin';

/**
 * Base da API.
 *
 * ATENCAO: o host de producao abaixo faz parte do contrato existente e NAO
 * foi alterado. Ordem de resolucao:
 *   1. `window.__CONECTA_API_BASE__` (injetado antes do bundle)
 *   2. `VITE_API_BASE` do build — use o valor `same-origin` quando o frontend
 *      for servido pelo proprio backend, em `http://host:porta/`
 *   3. o host de producao
 */
export const API_BASE: string = resolverBase();

function resolverBase(): string {
  // `__CONECTA_API_BASE__` e declarado em `declare global { interface Window }`
  // dentro de src/types/index.ts — nao e necessario nenhum cast aqui.
  const janela: string | undefined = window.__CONECTA_API_BASE__;
  if (typeof janela === 'string' && janela !== '') return materializar(janela);

  const env = import.meta.env?.VITE_API_BASE as string | undefined;
  if (typeof env === 'string' && env !== '') return materializar(env);

  return 'https://conecta-senac.onrender.com';
}

/** Traduz o sentinela para a origem real; qualquer outro valor passa direto. */
function materializar(valor: string): string {
  return valor === SENTINELA_MESMA_ORIGEM ? window.location.origin : valor;
}

/* ========================================================================
 * Modo de operacao: MOCK (server/) ou PRODUCAO (backend/ Spring Boot)
 *
 * O repositorio mantem DUAS camadas de persistencia independentes:
 *
 *   - MODO MOCK     -> `server/` (Node puro, porta 3333, persiste
 *                      `server/data/db.json`). E o que web e mobile falam hoje.
 *   - MODO PRODUCAO -> `backend/` (Spring Boot, porta 8081, Postgres/Supabase).
 *
 * Os dois expoem o MESMO contrato HTTP (`/api/dados`, `/api/sinc`, `/api/login`,
 * `/api/reset`), por isso a troca e apenas uma mudanca de base. Este bloco
 * torna o modo EXPLICITO em vez de implícito, para que um developer saiba
 * qual camada esta em uso sem ler a configuracao de build.
 *
 * Como alternar (ordem de precedencia):
 *
 *   1. `window.__CONECTA_MODO_API__ = 'mock' | 'producao'`  (runtime)
 *   2. `VITE_MODO_API=mock|producao`                        (build)
 *   3. inferencia: base em loopback -> mock; qualquer outro host -> producao
 *
 * Exemplos de build:
 *   VITE_API_BASE=http://127.0.0.1:3333 VITE_MODO_API=mock      npm run build
 *   VITE_API_BASE=https://api.exemplo.com  VITE_MODO_API=producao npm run build
 * ===================================================================== */

/** Qual camada de persistencia o frontend esta usando. */
export type ModoApi = 'mock' | 'producao';

/** Modo efetivo, resolvido uma unica vez no boot do bundle. */
export const MODO_API: ModoApi = resolverModo();

/** Atalho booleano para os call-sites que so precisam de um if. */
export const EH_MODO_MOCK: boolean = MODO_API === 'mock';

/** URL do servidor Node (`server/index.js`) — modo MOCK. */
export const URL_MOCK_PADRAO = 'http://localhost:3333';

/** URL do backend Spring Boot (`backend/demo`) — modo PRODUCAO. */
export const URL_PRODUCAO_PADRAO = 'https://conecta-senac.onrender.com';

function resolverModo(): ModoApi {
  const explicito = explicitoModo();
  if (explicito) return explicito;
  return ehLoopback(API_BASE) ? 'mock' : 'producao';
}

function explicitoModo(): ModoApi | null {
  const janela = (window as unknown as { __CONECTA_MODO_API__?: string })[
    '__CONECTA_MODO_API__'
  ];
  if (ehModoValido(janela)) return janela;

  const env = import.meta.env?.VITE_MODO_API;
  if (ehModoValido(env)) return env;

  return null;
}

function ehModoValido(valor: unknown): valor is ModoApi {
  return valor === 'mock' || valor === 'producao';
}

/**
 * Detecta endereco de loopback. Aceita o formato completo e tambem o
 * `localhost:porta` / `127.0.0.1:porta`, alem dos hosts de emulador mobile.
 */
function ehLoopback(base: string): boolean {
  let host = base;
  try {
    host = new URL(base, window.location.origin).hostname;
  } catch {
    // base relativa ou malformada: cai no recorte textual abaixo
    host = base.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0].split(':')[0];
  }
  const normalizado = host.toLowerCase();
  return (
    normalizado === 'localhost' ||
    normalizado === '127.0.0.1' ||
    normalizado === '0.0.0.0' ||
    normalizado === '::1' ||
    normalizado === '10.0.2.2' ||
    normalizado.endsWith('.local')
  );
}

/**
 * Tempo maximo de uma requisicao, em milissegundos.
 *
 * Antes o `fetch` nao tinha limite e o `initDados()` ficava pendurado para
 * sempre sempre que a API nao respondesse (o `fetch` so rejeita apos o
 * timeout de TCP do SO). Com o limite, a falha cai no `catch` ja existente de
 * `sincronizarServidor` e a aplicacao entra em modo offline com o cache local
 * em vez de ficar com a tela congelada.
 *
 * O limite pode ser ajustado com `VITE_API_TIMEOUT_MS` (ver `.env.example`).
 * Valores <= 0 caem no padrao de 25 s (cold start do Render free medido ~11 s;
 * o antigo padrao de 12 s abortava com AbortError em maquinas mais lentas).
 */
export const API_TIMEOUT_MS: number = resolverTimeoutMs();

function resolverTimeoutMs(): number {
  const bruto = import.meta.env?.VITE_API_TIMEOUT_MS;
  const n = typeof bruto === 'string' && bruto !== '' ? Number(bruto) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 25_000;
}

/** Token JWT armazenado apos o login (localStorage). */
export function obterToken(): string | null {
  try { return localStorage.getItem('conecta_token'); } catch { return null; }
}

export function salvarToken(token: string | null): void {
  try {
    if (token) localStorage.setItem('conecta_token', token);
    else localStorage.removeItem('conecta_token');
  } catch { /* ignore */ }
}

/** `fetch` com abort por tempo, motivos de erro preservados e token JWT. */
async function requisitar(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const headers = new Headers(init.headers);
    const token = obterToken();
    if (token) headers.set('Authorization', 'Bearer ' + token);
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** URL completa de um caminho de API. */
export function apiUrl(caminho: string): string {
  return `${API_BASE}${caminho.startsWith('/') ? caminho : `/${caminho}`}`;
}

/** Erro devolvido pelo servidor Node com o status HTTP preservado. */
export class ErroApi extends Error {
  readonly status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
  }
}

/** Le o corpo JSON de uma resposta, tolerando corpo vazio. */
async function lerJson<T>(res: Response): Promise<T> {
  const texto = await res.text();
  if (texto === '') return {} as T;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return {} as T;
  }
}

/**
 * `GET` JSON com tratamento de erro padronizado.
 * Lanca {@link ErroApi} para qualquer status >= 400, usando o campo `erro`
 * devolvido por `server/index.js`.
 */
export async function apiGet<T>(caminho: string): Promise<T> {
  const res = await requisitar(apiUrl(caminho), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401) {
    salvarToken(null);
    throw new ErroApi('Sessao expirada. Faca login novamente.', 401);
  }
  if (!res.ok) {
    const corpo = await lerJson<Partial<RespostaErro>>(res);
    throw new ErroApi(corpo.erro ?? `Falha na requisicao (${res.status})`, res.status);
  }
  return lerJson<T>(res);
}

/** `POST` JSON com tratamento de erro padronizado. */
export async function apiPost<T>(caminho: string, corpo?: unknown): Promise<T> {
  const res = await requisitar(apiUrl(caminho), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo ?? {}),
  });
  if (res.status === 401) {
    salvarToken(null);
    throw new ErroApi('Sessao expirada. Faca login novamente.', 401);
  }
  if (!res.ok) {
    const corpoErro = await lerJson<Partial<RespostaErro>>(res);
    throw new ErroApi(
      corpoErro.erro ?? `Falha na requisicao (${res.status})`,
      res.status,
    );
  }
  return lerJson<T>(res);
}

/** Baixa o banco completo (`GET /api/dados`). */
export function buscarDados(): Promise<BancoDados> {
  return apiGet<BancoDados>('/api/dados');
}

/** Lista as unidades publicas necessarias para a tela de login. */
export function buscarUnidadesPublicas(): Promise<Unidade[]> {
  return apiGet<Unidade[]>('/api/unidades');
}

/** Envia o lote de sincronizacao (`POST /api/sinc`). */
export function sincronizar(payload: unknown): Promise<unknown> {
  return apiPost<unknown>('/api/sinc', payload);
}

/** Autentica no servidor (`POST /api/login`). */
export function login(email: string, senha: string): Promise<RespostaLogin> {
  return apiPost<RespostaLogin>('/api/login', { email, senha });
}

/** Le a sessao ativa (`GET /api/sessao`). */
export function lerSessaoRemota(): Promise<Sessao | null> {
  return apiGet<Sessao | null>('/api/sessao');
}

/** Encerra a sessao no servidor (`POST /api/logout`). */
export function logoutRemoto(): Promise<unknown> {
  salvarToken(null);
  return apiPost<unknown>('/api/logout');
}

/** Restaura o banco de demonstracao (`POST /api/reset`). */
export function resetarDados(): Promise<unknown> {
  return apiPost<unknown>('/api/reset');
}

/** Extrai o usuario de uma resposta de login em qualquer formato aceito. */
export function extrairUsuarioLogin(resposta: RespostaLogin): Usuario | null {
  return resposta.usuario ?? resposta.sessao ?? null;
}
