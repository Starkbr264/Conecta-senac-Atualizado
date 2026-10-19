/**
 * Funcoes de formatacao, escape e status — extraidas de `storage.js` legado.
 *
 * Comportamento PRESERVADO byte-a-byte do original; a unica mudanca e a
 * tipagem dos parametros.
 */

import type { StatusTurma, Turma } from '../types';

/** Escapa HTML. Mesma ordem de substituicao do codigo legado. */
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Alias legado de {@link escapeHtml}. */
export const esc = escapeHtml;

/** Iniciais (ate 2) para avatares. Retorna `'SN'` quando nao ha nome. */
export function iniciais(nome: unknown): string {
  return (
    String(nome ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || 'SN'
  );
}

/** Id numerico unico para registros criados no cliente. */
export function newId(): number {
  return Date.now() + Math.floor(Math.random() * 9999);
}

/** Data de hoje em ISO curto (`YYYY-MM-DD`). */
export function hojeISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** `2025-01-31` -> `31/01/2025`. Devolve `—` para entrada vazia. */
export function fmtData(iso: unknown): string {
  if (!iso) return '—';
  const p = String(iso).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso);
}

/** Alias legado de {@link fmtData}. */
export const formatDate = fmtData;

/** `31/01/2025 14:30` a partir de qualquer data parseavel. */
export function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  if (Number.isNaN(d.getTime())) return String(v);
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear() +
    ' ' +
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
}

/** Rotulo amigavel dos status calculados/estocados. */
export function labelStatus(st: unknown): string {
  const mapa: Record<string, string> = {
    ativa: 'Ativa',
    iminente: 'Iminente',
    posterior: 'Posterior',
    encerrada: 'Encerrada',
    ocupada: 'Ocupada',
    livre: 'Livre',
  };
  return mapa[String(st ?? '')] || String(st ?? '');
}

/**
 * Status derivado de uma turma por data (NUNCA persistido no banco).
 * - encerrada: `hoje > dataFim`
 * - iminente:  comeca em ate 7 dias
 * - posterior: comeca depois de 7 dias
 * - ativa:     caso contrario
 */
export function calcStatus(turma: Partial<Turma> | null | undefined): StatusTurma {
  if (!turma) return 'encerrada';
  const hoje = hojeISO();

  if (turma.dataFim && hoje > turma.dataFim) {
    return 'encerrada';
  }

  if (turma.dataInicio && hoje < turma.dataInicio) {
    const diff = Math.ceil(
      (new Date(`${turma.dataInicio}T00:00:00`).getTime() -
        new Date(`${hoje}T00:00:00`).getTime()) /
        86400000,
    );
    if (diff >= 0 && diff <= 7) {
      return 'iminente';
    }
    return 'posterior';
  }

  return 'ativa';
}

/** Badge HTML do status calculado de uma turma. */
export function htmlStatus(turma: Partial<Turma> | null | undefined): string {
  const st = calcStatus(turma);
  return '<span class="st st-' + escapeHtml(st) + '">' + escapeHtml(labelStatus(st)) + '</span>';
}