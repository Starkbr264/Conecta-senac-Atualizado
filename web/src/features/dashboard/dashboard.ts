/**
 * Painel publico de disponibilidade de salas (`dashboard.html`).
 *
 * Migrado de `_js_original/dashboard_page.js`. O arquivo original envolvia tudo
 * em `DOMContentLoaded` e mantinha `escapeHtml`, `formatDate`, `showMsg` e
 * `showToast` como functions locais **nunca chamadas** — por isso foram
 * removidas aqui (os equivalentes globais ja existem em `core/format.ts` e
 * `core/ui.ts`).
 */

import { initDados } from '../../core/storage';
import { byId, qsa, setText } from '../../core/dom';
import { initSalas, renderTabelaSalas } from './salas';
import { initTurmas, renderTabelaTurmas } from './turmas';
import {
  initReservas,
  popularSelectSalasReserva,
  popularSelectTurmasReserva,
  renderTabelaReservas,
} from './reservas';
import { initDisponibilidade, refreshDisponibilidade } from './disponibilidade';

/** Metadados da topbar exibidos conforme a secao ativa. */
const TOPBAR_META: Record<string, { title: string; sub: string }> = {
  salas: { title: 'Salas', sub: 'Gerencie as salas disponíveis' },
  turmas: { title: 'Turmas', sub: 'Gerencie as turmas e cursos' },
  reservas: { title: 'Reservas', sub: 'Crie e gerencie reservas recorrentes' },
  disponibilidade: {
    title: 'Disponibilidade',
    sub: 'Verifique a ocupação das salas',
  },
};

type SecaoDashboard = keyof typeof TOPBAR_META;

/** Exibe apenas a secao informada e dispara o render correspondente. */
export function mostrarSecao(secao: string): void {
  qsa<HTMLElement>('[id^="section-"]').forEach((el) => {
    el.style.display = 'none';
  });
  qsa('.nav-item').forEach((b) => b.classList.remove('active'));

  byId(`section-${secao}`).style.display = 'block';
  byId(`nav-${secao}`).classList.add('active');

  const meta = TOPBAR_META[secao] ?? {};
  setText('topbarTitle', meta.title ?? secao);
  setText('topbarSubtitle', meta.sub ?? '');

  switch (secao as SecaoDashboard) {
    case 'reservas':
      popularSelectSalasReserva();
      popularSelectTurmasReserva();
      renderTabelaReservas();
      break;
    case 'disponibilidade':
      refreshDisponibilidade();
      break;
    case 'salas':
      renderTabelaSalas();
      break;
    case 'turmas':
      renderTabelaTurmas();
      break;
    default:
      break;
  }
}

/**
 * Exibe a imagem do logo se o `src` estiver preenchido no HTML,
 * caso contrario mostra o texto "SENAC.".
 */
export function initLogo(): void {
  const logoImg = byId<HTMLImageElement>('logoImg');
  const logoText = byId('logoText');
  if (logoImg.src && logoImg.getAttribute('src') !== '') {
    logoText.style.display = 'none';
  } else {
    logoImg.style.display = 'none';
  }
}

/** Ponto de entrada da pagina. */
export function initDashboard(): void {
  void initDados();
  initSalas();
  initTurmas();
  initReservas();
  initDisponibilidade();
  initLogo();
  mostrarSecao('salas');
}