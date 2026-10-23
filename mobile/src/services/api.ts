/*
 * api.ts
 * Cliente HTTP da API central.
 *
 * FONTE DA VERDADE UNICA: o backend Spring Boot em `backend/demo/`
 * (porta 8081, Postgres/Supabase), que tambem serve o frontend web.
 *
 * O servidor Node em `server/` (porta 3333, `server/data/db.json`) e um
 * MOCK LEGADO. Ele existe para desenvolvimento offline e so sobe com o
 * perfil `mock` do compose — nunca junto com a API, para nao haver duas
 * bases divergindo. Ver `compose.yaml` e `docs/ARQUITETURA_ATUALIZADA.md`.
 *
 * URL base:
 *   - Em desenvolvimento, derivamos o IP da maquina a partir do hostUri do
 *     Expo (funciona em emulador Android, iOS Simulator e celular fisico na
 *     mesma rede Wi-Fi, sem precisar de configuracao manual).
 *   - Em producao, troque por um dominio publico (ex: https://api.senac.com.br).
 *
 * Endpoints usados (paridade total com `web/src/core/api.ts`):
 *   - GET  /api/dados   -> baixa o banco completo (sincronizacao inicial)
 *   - POST /api/login   -> valida credenciais contra o servidor
 *   - POST /api/sinc    -> envia as alteracoes locais (merge por id)
 *   - POST /api/reset   -> recarrega os dados de exemplo no servidor
 *   - GET  /api/sessao  -> le a sessao global do servidor
 *   - POST /api/logout  -> encerra a sessao no servidor
 *
 * Todas as funcoes sao "best-effort": se o servidor estiver fora do ar, o
 * app continua funcionando com o cache local (AsyncStorage) e sincroniza
 * quando o servidor voltar.
 */

import Constants from 'expo-constants';
import { Usuario } from '@/types';

// Armazenamento seguro de token: tenta expo-secure-store, cai para AsyncStorage.
let SecureStore: { getItemAsync: (k: string) => Promise<string | null>; setItemAsync: (k: string, v: string) => Promise<void>; deleteItemAsync: (k: string) => Promise<void> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function obterToken(): Promise<string | null> {
  try {
    if (SecureStore) return await SecureStore.getItemAsync('conecta_token');
    return await AsyncStorage.getItem('conecta_token');
  } catch {
    return null;
  }
}

export async function salvarToken(token: string | null): Promise<void> {
  try {
    if (SecureStore) {
      if (token) await SecureStore.setItemAsync('conecta_token', token);
      else await SecureStore.deleteItemAsync('conecta_token');
    } else {
      if (token) await AsyncStorage.setItem('conecta_token', token);
      else await AsyncStorage.removeItem('conecta_token');
    }
  } catch {
    /* ignore */
  }
}

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

/**
 * Porta padrao da API.
 *
 * 8081 = Spring Boot (`backend/demo`), a FONTE DA VERDADE unica do projeto.
 * 3333 = servidor Node legado (`server/`, mock em `server/data/db.json`),
 * usado apenas com o perfil `mock` do compose.
 */
export const API_PORTA_PADRAO = 8081;

const apiPortaConfig = process.env.EXPO_PUBLIC_API_PORT;

export const API_URL =
  apiUrlConfig || `http://${descobrirHost()}:${apiPortaConfig || API_PORTA_PADRAO}`;

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
    const token = await obterToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opcoes?.headers as Record<string, string> || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const resp = await fetch(`${API_URL}${caminho}`, {
      ...opcoes,
      signal: controller.signal,
      headers,
    });
    const corpo = await resp.json().catch(() => ({}));
    if (resp.status === 401) {
      await salvarToken(null);
      throw new Error('Sessao expirada. Faca login novamente.');
    }
    if (resp.status === 403) {
      throw new Error('Sem permissao para esta operacao.');
    }
    if (resp.status === 429) {
      throw new Error('Muitas requisicoes. Tente novamente em instantes.');
    }
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
    const resp = await req<{ usuario: Usuario; token?: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
    if (resp.token) await salvarToken(resp.token);
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

/**
 * Le a sessao global mantida pelo servidor.
 *
 * Paridade com o web (`web/src/core/api.ts` -> `lerSessaoRemota`): as duas
 * APIs expõem `GET /api/sessao` com o mesmo corpo. Retorna `null` quando nao
 * ha sessao ou quando o servidor esta fora do ar.
 */
export async function lerSessaoRemota(): Promise<Usuario | null> {
  try {
    const resp = await req<{ usuario?: Usuario; sessao?: Usuario } | null>('/api/sessao');
    if (!resp) return null;
    return resp.usuario ?? resp.sessao ?? null;
  } catch {
    return null;
  }
}

/** Encerra a sessao no servidor. Espelha `logoutRemoto` do web. */
export async function logoutRemoto(): Promise<boolean> {
  try {
    await req<{ ok?: boolean }>('/api/logout', { method: 'POST', body: JSON.stringify({}) });
    return true;
  } catch {
    return false;
  }
}
