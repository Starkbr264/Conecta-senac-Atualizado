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
 *
 * Todas as funcoes sao "best-effort": se o servidor estiver fora do ar, o
 * app continua funcionando com o cache local (AsyncStorage) e sincroniza
 * quando o servidor voltar.
 */

import Constants from 'expo-constants';
import { Usuario } from '@/types';

import AsyncStorage from '@react-native-async-storage/async-storage';

// Armazenamento de token: AsyncStorage (compativel com Expo Go).
// TODO: migrar para expo-secure-store em producao para armazenamento criptografado.
// O expo-secure-store requer build nativo (EAS Build) e nao funciona no Expo Go.

export async function obterToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('conecta_token');
  } catch {
    return null;
  }
}

export async function salvarToken(token: string | null): Promise<void> {
  try {
    if (token) await AsyncStorage.setItem('conecta_token', token);
    else await AsyncStorage.removeItem('conecta_token');
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
