/**
 * Landing page (`index.html`).
 *
 * Migrado de `_js_original/index_page.js`.
 *
 * O legado fazia um "monkey-patch" de `toggleTema` para redesenhar o icone
 * depois de cada alternancia. Aqui o efeito e explicito: `alternarTema`
 * chama o toggle real e depois atualiza o icone.
 */

import { getTema, initTema, toggleTema } from '../../core/theme';
import { byId } from '../../core/dom';

/** Redesenha o icone do botao de tema conforme o tema atual. */
export function atualizarIconeTema(): void {
  const t = getTema();
  byId('btnTema').innerHTML =
    t === 'dark' ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon"></i>';
}

/**
 * Alterna o tema e atualiza o icone.
 *
 * Substitui o wrapper que o legado registrava sobre `toggleTema`.
 */
export function alternarTema(): void {
  toggleTema();
  atualizarIconeTema();
}

/** Bootstrap da landing page. */
export function initHome(): void {
  initTema();
  atualizarIconeTema();
}