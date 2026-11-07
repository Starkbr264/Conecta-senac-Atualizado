/**
 * Sessao e tema — extraidos de `storage.js` legado.
 *
 * A sessao vive em `localStorage` (mesmo escopo do JWT em `conecta_token`),
 * para que a identidade visual de TODAS as abas corresponda sempre ao token
 * efetivamente usado nas chamadas de API. A migracao a partir do antigo
 * `sessionStorage` (por aba) e aplicada na leitura; a partir do `localStorage`
 * legado tambem. O tema vive em `localStorage` e e refletido em
 * `<html data-theme="...">`.
 *
 * Este modulo nao importa nada de `storage.ts`, evitando ciclo.
 */

import type { Sessao, Tema } from '../types';

/** Chave de armazenamento da sessao (prefixo de versao mantido do legado). */
export const K_SESSAO = 'sn_v6_sessao';
/** Chave de armazenamento do tema. */
export const K_TEMA = 'sn_v6_tema';
/** Chave do JWT compartilhado entre abas (mantida em `api.ts`). */
export const K_TOKEN = 'conecta_token';

/**
 * `sessionStorage` quando disponivel — usado apenas para migrar sessoes
 * antigas por-aba para o escopo compartilhado.
 */
function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Le a sessao persistida.
 *
 * Ordem: `localStorage` (compartilhado) → migracao do `sessionStorage` legado
 * por-aba → migracao do `localStorage` legado.
 */
export function lerSessaoLocal(): Sessao | null {
  try {
    let v = localStorage.getItem(K_SESSAO);
    if (!v) {
      const store = sessionStore();
      const porAba = store ? store.getItem(K_SESSAO) : null;
      if (porAba) {
        // Sessao antiga por-aba: promove ao escopo compartilhado para que o
        // token (que ja vivia em localStorage) e a identidade fiquem coerentes.
        localStorage.setItem(K_SESSAO, porAba);
        store?.removeItem(K_SESSAO);
        v = porAba;
      }
    }
    return v ? (JSON.parse(v) as Sessao) : null;
  } catch {
    return null;
  }
}

/** Grava a sessao no escopo compartilhado entre abas. */
export function gravarSessaoLocal(sessao: Sessao): void {
  const txt = JSON.stringify(sessao);
  try {
    localStorage.setItem(K_SESSAO, txt);
    // Remove o espelho por-aba legado: duas fontes de verdade divergentes e
    // exatamente o bug de sessao encontrada na auditoria.
    sessionStore()?.removeItem(K_SESSAO);
  } catch {
    /* contexto restrito: melhor esforco */
  }
}

/** Remove a sessao de ambos os stores. */
export function limparSessaoLocal(): void {
  try {
    localStorage.removeItem(K_SESSAO);
  } catch {
    /* ignore */
  }
  try {
    sessionStore()?.removeItem(K_SESSAO);
  } catch {
    /* ignore */
  }
}

/** Sessao ativa, ou `null`. */
export function getSessao(): Sessao | null {
  return lerSessaoLocal();
}

/** Persiste a sessao. */
export function setSessao(u: Sessao): void {
  gravarSessaoLocal(u);
}

/** Encerra a sessao. */
export function clearSessao(): void {
  limparSessaoLocal();
}

/** Observa mudancas de sessao/token feitas em OUTRAS abas. */
export type OuvinteSessao = (sessao: Sessao | null) => void;

let ouvintes: OuvinteSessao[] = [];
let listenerInstalado = false;

function aoMudarStorage(ev: StorageEvent): void {
  // `ev.key === null` significa `storage.clear()` em outra aba.
  if (ev.key !== null && ev.key !== K_SESSAO && ev.key !== K_TOKEN) return;
  const sessao = lerSessaoLocal();
  ouvintes.forEach((fn) => {
    try {
      fn(sessao);
    } catch {
      /* um ouvinte com erro nao pode derrubar os demais */
    }
  });
}

/**
 * Registra um ouvinte de mudancas de sessao/token vindas de outras abas.
 * Retorna a funcao de cancelamento. A instalacao do listener e unica.
 */
export function observarSessao(fn: OuvinteSessao): () => void {
  ouvintes.push(fn);
  if (!listenerInstalado && typeof window !== 'undefined') {
    listenerInstalado = true;
    window.addEventListener('storage', aoMudarStorage);
  }
  return () => {
    ouvintes = ouvintes.filter((f) => f !== fn);
  };
}

/** Tema ativo (`light` por padrao). */
export function getTema(): Tema {
  return (localStorage.getItem(K_TEMA) as Tema | null) || 'light';
}

/** Aplica o tema salvo em `<html data-theme>`. */
export function initTema(): Tema {
  const t = getTema();
  document.documentElement.setAttribute('data-theme', t);
  return t;
}

/** Alterna entre `light` e `dark`, persistindo a escolha. */
export function toggleTema(): Tema {
  const curr = (document.documentElement.getAttribute('data-theme') ||
    getTema()) as Tema;
  const next: Tema = curr === 'dark' ? 'light' : 'dark';
  localStorage.setItem(K_TEMA, next);
  document.documentElement.setAttribute('data-theme', next);
  return next;
}
