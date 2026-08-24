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
 * Para apontar para outro servidor (produção ou IP fixo), configure o campo
 * "extra.apiUrl" no app.json. Exemplo:
 *   "extra": { "apiUrl": "http://192.168.0.20:3333" }
 * Se não houver, usamos a descoberta automática pelo IP do Metro/Expo.
 */
const apiUrlConfig =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.apiUrl;

export const API_URL = apiUrlConfig || `http://${descobrirHost()}:3333`;

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
