/**
 * Helpers de UI extraidos de `storage.js` legado.
 *
 * Este modulo NAO importa `storage.ts` de proposito — assim `storage.ts`
 * pode usar os toasts sem criar ciclo de importacao.
 */

import { tryById } from './dom';
import type { TipoToast } from '../types';

/** Cria (ou reaproveita) o container `#toasts` e devolve o elemento do aviso. */
export function toast(msg: unknown, tipo: TipoToast | string = 'info'): HTMLDivElement {
  let box = tryById<HTMLDivElement>('toasts');
  if (box === null) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }

  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.textContent = String(msg ?? '');
  box.appendChild(el);
  setTimeout(() => el.remove(), 3200);
  return el;
}

/** Alias legado de {@link toast}, com normalizacao de `success` -> `ok`. */
export function showToast(msg: unknown, tipo: TipoToast | string = 'info'): HTMLDivElement {
  return toast(msg, tipo === 'success' ? 'ok' : tipo);
}

const CLASSES_MSG = /\b(erro|ok|aviso|error|warning|success)\b/g;

/** Mensagem inline de formulario (`.fmsg`), reaproveitando o mesmo elemento. */
export function fmsg(id: string, tipo: TipoToast | string, msg: unknown): void {
  const el = tryById(id);
  if (el === null) return;

  const css =
    tipo === 'success' ? 'ok' : tipo === 'warning' ? 'aviso' : (tipo || 'erro');

  el.className = (el.className || '').replace(CLASSES_MSG, '').trim();
  el.classList.add('fmsg', css);
  el.textContent = String(msg ?? '');
  el.style.display = 'block';
}

/** Oculta a mensagem inline de formulario. */
export function fmsgHide(id: string): void {
  const el = tryById(id);
  if (el === null) return;

  el.textContent = '';
  el.style.display = 'none';
  el.className = (el.className || '').replace(CLASSES_MSG, '').trim();
  if (!el.classList.contains('fmsg')) {
    el.classList.add('fmsg');
  }
}

/** Mensagem de formulario no formato `.form-msg` (variante mais nova). */
export function showMsg(id: string, tipo: string, msg: unknown): void {
  const el = tryById(id);
  if (el === null) return;

  const map: Record<string, string> = {
    erro: 'error',
    ok: 'success',
    aviso: 'warning',
    warning: 'warning',
    success: 'success',
    error: 'error',
  };

  el.className = 'form-msg ' + (map[tipo] || 'error');
  el.textContent = String(msg ?? '');
  el.style.display = 'block';
}

/** Oculta a mensagem `.form-msg`. */
export function hideMsg(id: string): void {
  const el = tryById(id);
  if (el === null) return;

  el.className = 'form-msg';
  el.textContent = '';
  el.style.display = 'none';
}

/** Abre um modal pela classe `.on` + `display:flex`. */
export function modalAbrir(id: string): void {
  const el = tryById(id);
  if (el !== null) {
    el.style.display = 'flex';
    el.classList.add('on');
  }
}

/** Fecha um modal. */
export function modalFechar(id: string): void {
  const el = tryById(id);
  if (el !== null) {
    el.style.display = 'none';
    el.classList.remove('on');
  }
}