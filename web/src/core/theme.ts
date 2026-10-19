/**
 * Sessao e tema — extraidos de `storage.js` legado.
 *
 * A sessao vive em `sessionStorage` (migracao automatica a partir do
 * `localStorage` legado, aplicada na leitura). O tema vive em
 * `localStorage` e e refletido em `<html data-theme="...">`.
 *
 * Este modulo nao importa nada de `storage.ts`, evitando ciclo.
 */

import type { Sessao, Tema } from '../types';

/** Chave de armazenamento da sessao (prefixo de versao mantido do legado). */
export const K_SESSAO = 'sn_v6_sessao';
/** Chave de armazenamento do tema. */
export const K_TEMA = 'sn_v6_tema';

/** `sessionStorage` quando disponivel; `null` em contexto restrito. */
function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Le a sessao persistida, migrando do `localStorage` legado. */
export function lerSessaoLocal(): Sessao | null {
  try {
    const store = sessionStore();
    let v = store ? store.getItem(K_SESSAO) : localStorage.getItem(K_SESSAO);
    if (!v) {
      const legacy = localStorage.getItem(K_SESSAO);
      if (legacy && store) {
        store.setItem(K_SESSAO, legacy);
        localStorage.removeItem(K_SESSAO);
        v = legacy;
      }
    }
    return v ? (JSON.parse(v) as Sessao) : null;
  } catch {
    return null;
  }
}

/** Grava a sessao em `sessionStorage` (ou `localStorage` como reserva). */
export function gravarSessaoLocal(sessao: Sessao): void {
  const txt = JSON.stringify(sessao);
  const store = sessionStore();
  if (store) {
    store.setItem(K_SESSAO, txt);
    localStorage.removeItem(K_SESSAO);
  } else {
    localStorage.setItem(K_SESSAO, txt);
  }
}

/** Remove a sessao de ambos os stores. */
export function limparSessaoLocal(): void {
  const store = sessionStore();
  if (store) store.removeItem(K_SESSAO);
  localStorage.removeItem(K_SESSAO);
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