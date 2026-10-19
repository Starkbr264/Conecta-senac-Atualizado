/*
 * api.ts
 * Cliente HTTP da API central — conecta o MOBILE ao mesmo servidor do WEB.
 *
 * O servidor roda em server/index.js (porta 3333) e é a fonte da verdade
 * compartilhada: o que é alterado no mobile aparece no web e vice-versa.
 *
 * URL base:
 *   - Em desenvolvimento, derivamos o IP da máquina a partir do hostUri do
 *     Expo (funciona em emulador Android, iOS Simulator e celular físico na
 *     mesma rede Wi-Fi, sem precisar de configuração manual).
 *   - Em produção, troque por um domínio público (ex: https://api.senac.com.br).
 *
 * Padrão usado:
 *   - GET  /api/dados   -> baixa o banco completo (sincronização inicial)
 *   - POST /api/login   -> valida credenciais contra o servidor
 *   - POST /api/sinc    -> envia as alterações locais (merge por id)
 *   - POST /api/reset   -> recarrega os dados de exemplo no servidor
 *
 * Todas as funções são "best-effort": se o servidor estiver fora do ar, o
 * app continua funcionando com o cache local (AsyncStorage) e sincroniza
 * quando o servidor voltar.
 */

import Constants from 'expo-constants';
import { Usuario } from '@/types';

/**
 * Descobre o IP da máquina que roda o Metro/Expo.
 * Exemplo de hostUri: "192.168.0.10:8081" -> API em "192.168.0.10:3333".
 */
function descobrirHost(): string {
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }
  // Fallback: mesma máquina (emulador Android usa 10.0.2.2 para o host)
  return '10.0.2.2';
}

/**
 * Para apontar para outro servidor (produção ou IP fixo), use UMA das duas
 * fontes abaixo, nesta ordem de precedencia:
 *
 *   1. campo "extra.apiUrl" no app.json — recomendado, versionavel:
 *        "extra": { "apiUrl": "http://192.168.0.20:3333" }
 *   2. variavel de ambiente EXPO_PUBLIC_API_URL — injetada no bundle pelo
 *        Metro/.env do Expo (ver .env.example na raiz do repositorio).
 *
 * Se nenhuma estiver presente, usamos a descoberta automática pelo IP do
 * Metro/Expo. O valor "same-origin" significa "a origem da propria pagina".
 */
const extra =
  Constants.expoConfig?.extra as Record<string, string> | undefined;
const apiUrlConfig = extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;

export const API_URL = apiUrlConfig || `http://${descobrirHost()}:3333`;

/* ========================================================================
 * Modo de operacao: MOCK (server/) ou PRODUCAO (backend/ Spring Boot)
 *
 * Espelha `web/src/core/api.ts`. O repositorio mantem DUAS camadas de
 * persistencia com o MESMO contrato HTTP:
 *
 *   - MODO MOCK     -> `server/` (Node puro, porta 3333, persiste
 *                      `server/data/db.json`). E o padrao do mobile.
 *   - MODO PRODUCAO -> `backend/` (Spring Boot, porta 8081, Postgres/Supabase).
 *
 * Este bloco torna o modo EXPLICITO, em vez de implícito na URL, para que
 * um developer saiba qual camada esta em uso sem abrir o app.json.
 *
 * Como alternar (ordem de precedencia):
 *
 *   1. `extra.modoApi` no `app.json`   -> "mock" | "producao"   (recomendado)
 *   2. `EXPO_PUBLIC_MODO_API` no .env do Expo (injetada no bundle)
 *   3. inferencia: base em loopback/IP privado -> mock; host publico -> producao
 *
 * Exemplo de app.json:
 *   { "expo": { "extra": {
 *       "apiUrl":  "http://192.168.0.20:3333",
 *       "modoApi": "mock" } } }
 *
 * Para apontar para o Spring Boot, troque tambem o `apiUrl`:
 *   { "extra": { "apiUrl": "http://192.168.0.20:8081", "modoApi": "producao" } }
 * ===================================================================== */

/** Qual camada de persistencia o mobile esta usando. */
export type ModoApi = 'mock' | 'producao';

/** Modo efetivo, resolvido uma unica vez no boot do app. */
export const MODO_API: ModoApi = resolverModo();

/** Atalho booleano para os call-sites que so precisam de um if. */
export const EH_MODO_MOCK: boolean = MODO_API === 'mock';

function resolverModo(): ModoApi {
  const explicito = extra?.modoApi ?? process.env.EXPO_PUBLIC_MODO_API;
  if (explicito === 'mock' || explicito === 'producao') return explicito;
  return ehHostPrivado(API_URL) ? 'mock' : 'producao';
}

/**
 * Detecta endereco de loopback ou de rede local. Alem dos hosts literais,
 * qualquer IPv4 privado (RFC 1918) e qualquer `.local` contam como mock.
 */
function ehHostPrivado(base: string): boolean {
  let host = '';
  try {
    host = new URL(base).hostname;
  } catch {
    return false;
  }
  const normalizado = host.toLowerCase();
  if (
    normalizado === 'localhost' ||
    normalizado === '0.0.0.0' ||
    normalizado === '::1' ||
    normalizado.endsWith('.local')
  ) {
    return true;
  }
  const octetos = normalizado.split('.');
  if (octetos.length !== 4) return false;
  const n = octetos.map((o) => Number(o));
  if (n.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return false;
  return n[0] === 10 || (n[0] === 192 && n[1] === 168) || (n[0] === 172 && n[1] >= 16 && n[1] <= 31);
}

// ---- Helpers privados ------------------------------------------------------

/**
 * Executa um fetch com timeout e converte a resposta em JSON.
 * Lança erro se a resposta não for 2xx (para o chamador tratar).
 */
async function req<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // 8s de timeout

  try {
    const resp = await fetch(`${API_URL}${caminho}`, {
      ...opcoes,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(opcoes?.headers || {}) },
    });
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error((corpo as { erro?: string })?.erro || `Erro ${resp.status}`);
    }
    return corpo as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---- API pública -----------------------------------------------------------

/** Baixa o banco completo do servidor (todas as coleções). */
export async function buscarDados(): Promise<Record<string, unknown[]> | null> {
  try {
    return await req<Record<string, unknown[]>>('/api/dados');
  } catch {
    return null; // servidor indisponível -> o chamador usa o cache local
  }
}

/** Valida credenciais no servidor. Retorna o usuário ou null. */
export async function loginApi(email: string, senha: string): Promise<Usuario | null> {
  try {
    const resp = await req<{ usuario: Usuario }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
    return resp.usuario ?? null;
  } catch {
    return null; // servidor indisponível -> o chamador tenta o cache local
  }
}

/**
 * Resultado de uma sincronização com o servidor.
 * `ok`       -> se o servidor aceitou as alterações;
 * `banco`    -> banco completo pós-merge (o cliente pode usá-lo como fonte);
 * `idsNovos` -> mapeamento { colecao: { idProvisorio: idOficial } } dos
 *               registros criados nesta sincronização.
 */
export type ResultadoSinc = {
  ok: boolean;
  banco: Record<string, unknown[]> | null;
  idsNovos: Record<string, Record<number, number>>;
};

/**
 * Envia as alterações locais para o servidor.
 * `alteracoes` mapeia o nome da coleção -> lista de registros ALTERADOS.
 * `criados`    mapeia o nome da coleção -> lista de registros NOVOS (com id
 *               provisório; o servidor atribui o id oficial e devolve o mapa).
 * `remocoes`   mapeia o nome da coleção -> lista de ids apagados localmente.
 */
export async function enviarAlteracoes(
  alteracoes: Record<string, unknown[]> = {},
  remocoes: Record<string, (number | string)[]> = {},
  criados: Record<string, unknown[]> = {}
): Promise<ResultadoSinc> {
  try {
    const resp = await req<{ ok: boolean; banco: Record<string, unknown[]> | null; idsNovos?: Record<string, Record<number, number>> }>('/api/sinc', {
      method: 'POST',
      body: JSON.stringify({ alteracoes, remocoes, criados }),
    });
    return {
      ok: resp.ok === true,
      banco: resp.banco ?? null,
      idsNovos: resp.idsNovos ?? {},
    };
  } catch {
    return { ok: false, banco: null, idsNovos: {} };
  }
}

/** Pede ao servidor para recarregar os dados de exemplo e baixa o resultado. */
export async function resetarApi(): Promise<Record<string, unknown[]> | null> {
  try {
    const resp = await req<{ ok: boolean; banco: Record<string, unknown[]> }>('/api/reset', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return resp.banco ?? null;
  } catch {
    return null;
  }
}
