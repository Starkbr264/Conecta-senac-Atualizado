/**
 * Calendario de reservas — compartilhado por todos os paineis.
 *
 * Migrado de `_js_original/calendario_page.js` (que era uma IIFE que publicava
 * funcoes em `window`). Aqui as funcoes viram exports e a instalacao em
 * `window` passa a acontecer no entry da pagina, via `installGlobals`.
 *
 * Modos de visualizacao:
 *   mes    — grade 7 colunas (Seg a Dom) com eventos coloridos por turno
 *   semana — grade com linhas por turno (Matutino / Vespertino / Noturno)
 *
 * Cores dos eventos:
 *   Ambar  — Matutino
 *   Azul   — Vespertino
 *   Roxo   — Noturno
 *   Laranja — Sem turma (reserva pontual)
 *
 * Filtros por role:
 *   Admin       — todas as reservas do sistema
 *   Coordenador — reservas da propria unidade
 *   Recepcao    — reservas da propria unidade
 *   Instrutor   — apenas reservas das proprias turmas
 */

import {
  getReservas,
  getSalaById,
  getSalas,
  getSalasByUnidade,
  getTurmaById,
  getUserById,
} from '../../core/storage';
import { getSessao } from '../../core/theme';
import { esc } from '../../core/format';
import { qsa, tryById } from '../../core/dom';
import type { DiaSemana, Reserva, Turno } from '../../types';

type VistaCalendario = 'mes' | 'semana';

interface EstadoCalendario {
  ano: number;
  mes: number;
  vista: VistaCalendario;
  diaSel: Date;
  semBase: Date;
  filtSala: string;
  filtTurno: string;
}

// ---------------------------------------------------------------------------
// Estado interno
// ---------------------------------------------------------------------------

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

const estado: EstadoCalendario = {
  ano: hoje.getFullYear(),
  mes: hoje.getMonth(),
  vista: 'mes',
  diaSel: hoje,
  semBase: segundaFeira(hoje),
  filtSala: '',
  filtTurno: '',
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_LONGOS = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];
const DOW_SEG = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const TURNOS: Turno[] = ['Matutino', 'Vespertino', 'Noturno'];
const DOW_ABREV: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const ICONES_TURNO: Record<string, string> = {
  Matutino: 'ph-sun',
  Vespertino: 'ph-cloud-sun',
  Noturno: 'ph-moon',
};

// ---------------------------------------------------------------------------
// Helpers de data
// ---------------------------------------------------------------------------

/** Converte `Date` para string ISO `YYYY-MM-DD` (hora local, sem UTC). */
function paraIso(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Calcula a segunda-feira da semana de uma data. */
function segundaFeira(d: Date): Date {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const dow = dt.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setDate(dt.getDate() + diff);
  return dt;
}

function somarDias(d: Date, n: number): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}

function formatarDia(d: Date): string {
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear()
  );
}

function formatarDiaLongo(d: Date): string {
  return (
    DIAS_LONGOS[d.getDay()] +
    ', ' +
    d.getDate() +
    ' de ' +
    MESES[d.getMonth()].toLowerCase() +
    ' de ' +
    d.getFullYear()
  );
}

/** Classe CSS do evento conforme o turno (`mat` | `ves` | `not`). */
function classeTurno(turno: string | undefined): string {
  if (!turno) return 'mat';
  const t = turno.toLowerCase();
  if (t.indexOf('mat') > -1) return 'mat';
  if (t.indexOf('ves') > -1) return 'ves';
  if (t.indexOf('not') > -1) return 'not';
  return 'mat';
}

function diaDaSemana(dt: Date): DiaSemana {
  return DOW_ABREV[dt.getDay()];
}

/** Verifica se uma reserva ocorre em determinado dia. */
function ocorre(r: Reserva, dt: Date): boolean {
  const iso = paraIso(dt);
  const inicio = r.dataInicio ?? '';
  const fim = r.dataFim ?? '';
  if (inicio > iso || fim < iso) return false;
  const ds = diaDaSemana(dt);
  return (r.diasSemana ?? []).some((d) => String(d).toLowerCase() === ds);
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

/** Reservas visiveis para o perfil da sessao + filtros da toolbar. */
function reservasVisiveis(): Reserva[] {
  try {
    const sess = getSessao();
    if (!sess) return [];
    const todas = getReservas();
    let lista: Reserva[];
    if (sess.perfil === 'admin') {
      lista = todas;
    } else if (sess.perfil === 'instrutor') {
      lista = todas.filter((r) => {
        const t = r.turmaId ? getTurmaById(r.turmaId) : null;
        return (
          String(r.instrutorId) === String(sess.id) ||
          (t !== null && String(t.instrutorId) === String(sess.id))
        );
      });
    } else {
      lista = todas.filter((r) => String(r.unidadeId) === String(sess.unidadeId));
    }
    if (estado.filtSala) {
      const alvo = estado.filtSala;
      lista = lista.filter((r) => String(r.salaId) === alvo);
    }
    if (estado.filtTurno) {
      const alvo = estado.filtTurno;
      lista = lista.filter((r) => r.turno === alvo);
    }
    return lista;
  } catch (e) {
    console.error('[Cal] reservasVisiveis:', e);
    return [];
  }
}

/** Preenche o select de filtro com as salas da unidade. */
function popularSalas(): void {
  const sel = tryById<HTMLSelectElement>('calFiltSala');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Todas as salas</option>';
  try {
    const sess = getSessao();
    if (!sess) return;
    const lista = sess.perfil === 'admin' ? getSalas() : getSalasByUnidade(sess.unidadeId);
    (lista ?? []).forEach((s) => {
      const o = document.createElement('option');
      o.value = String(s.id);
      o.textContent = s.nome;
      if (o.value === String(prev)) o.selected = true;
      sel.appendChild(o);
    });
  } catch (e) {
    console.error('[Cal] popularSalas:', e);
  }
}

/** Atualiza o texto do periodo exibido na toolbar. */
function atualizarPeriodo(): void {
  const el = tryById('calPeriodo');
  if (!el) return;
  if (estado.vista === 'mes') {
    el.textContent = `${MESES[estado.mes]} ${estado.ano}`;
  } else {
    const fim = somarDias(estado.semBase, 6);
    el.textContent = `${formatarDia(estado.semBase)} – ${formatarDia(fim)}`;
  }
}

// ---------------------------------------------------------------------------
// Renderizacao
// ---------------------------------------------------------------------------

function renderMes(): void {
  const cont = tryById('calCorpo');
  if (!cont) return;
  try {
    const hojeIso = paraIso(hoje);
    const selIso = estado.diaSel ? paraIso(estado.diaSel) : '';
    const lista = reservasVisiveis();

    const primeiro = new Date(estado.ano, estado.mes, 1);
    const sdow = primeiro.getDay();
    const off = sdow === 0 ? 6 : sdow - 1;
    const dim = new Date(estado.ano, estado.mes + 1, 0).getDate();

    let h = '<div class="cal-grid-wrap"><div class="cal-grid">';

    DOW_SEG.forEach((d, i) => {
      h += `<div class="cal-dow-header${i === 6 ? ' weekend' : ''}">${d}</div>`;
    });

    const dimAnterior = new Date(estado.ano, estado.mes, 0).getDate();
    for (let p = off; p > 0; p--) {
      h += `<div class="cal-day outro-mes"><span class="cal-day-num">${dimAnterior - p + 1}</span></div>`;
    }

    for (let dia = 1; dia <= dim; dia++) {
      const dt = new Date(estado.ano, estado.mes, dia);
      const iso = paraIso(dt);
      let cls = 'cal-day';
      if (iso === hojeIso) cls += ' hoje';
      if (iso === selIso) cls += ' selecionado';
      if (dt.getDay() === 0 || dt.getDay() === 6) cls += ' weekend';

      const evs = lista.filter((r) => ocorre(r, dt));

      h += `<div class="${cls}" data-action="calDia" data-arg="${iso}">`;
      h += `<span class="cal-day-num">${dia}</span>`;
      evs.slice(0, 3).forEach((r) => {
        const sala = getSalaById(r.salaId);
        let nome = sala ? sala.nome : 'Sala';
        if (nome.length > 13) nome = nome.slice(0, 12) + '…';
        h += `<div class="cal-ev ${r.avulsa ? 'avul' : classeTurno(r.turno as string)}">${esc(nome)}</div>`;
      });
      if (evs.length > 3) h += `<div class="cal-ev-mais">+${evs.length - 3} mais</div>`;
      h += '</div>';
    }

    const total = off + dim;
    const resto = (7 - (total % 7)) % 7;
    for (let j = 1; j <= resto; j++) {
      h += `<div class="cal-day outro-mes"><span class="cal-day-num">${j}</span></div>`;
    }

    h += '</div></div>';
    cont.innerHTML = h;
  } catch (e) {
    console.error('[Cal] renderMes:', e);
    cont.innerHTML =
      '<div style="padding:24px;color:var(--red)"><i class="ph ph-warning"></i> ' +
      'Erro ao renderizar o calendário: ' +
      (e instanceof Error ? e.message : String(e)) +
      '</div>';
  }
}

function renderSemana(): void {
  const cont = tryById('calCorpo');
  if (!cont) return;
  try {
    const hojeIso = paraIso(hoje);
    const lista = reservasVisiveis();
    const dias: Date[] = [];
    for (let i = 0; i < 7; i++) dias.push(somarDias(estado.semBase, i));

    let h = '<div class="cal-grid-wrap"><div class="cal-semana-grid">';

    h += '<div class="cal-sem-col-header" style="background:var(--surface2)"></div>';
    dias.forEach((d) => {
      const isHj = paraIso(d) === hojeIso;
      const isWE = d.getDay() === 0 || d.getDay() === 6;
      const dowIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      h += `<div class="cal-sem-col-header${isHj ? ' hoje' : ''}${isWE ? ' weekend' : ''}">`;
      h += `<div class="cal-sem-dow">${DOW_SEG[dowIdx]}</div>`;
      if (isHj) {
        h +=
          '<div class="cal-sem-date" style="width:26px;height:26px;border-radius:50%;' +
          'background:var(--primary);color:#fff;display:flex;align-items:center;' +
          `justify-content:center;margin:2px auto 0;font-size:.8rem">${d.getDate()}</div>`;
      } else {
        h += `<div class="cal-sem-date">${d.getDate()}</div>`;
      }
      h += '</div>';
    });

    TURNOS.forEach((turno) => {
      const tc = classeTurno(turno);
      h += `<div class="cal-sem-turno-label"><i class="ph ${ICONES_TURNO[turno] ?? 'ph-clock'}"></i></div>`;
      dias.forEach((d) => {
        const iso = paraIso(d);
        const isHj = iso === hojeIso;
        const evs = lista.filter((r) => ocorre(r, d) && r.turno === turno);
        h += `<div class="cal-sem-cell${isHj ? ' hoje' : ''}" data-action="calDia" data-arg="${iso}">`;
        evs.forEach((r) => {
          const sala = getSalaById(r.salaId);
          let nome = sala ? sala.nome : 'Sala';
          if (nome.length > 11) nome = nome.slice(0, 10) + '…';
          h += `<div class="cal-ev ${r.avulsa ? 'avul' : tc}">${esc(nome)}</div>`;
        });
        if (!evs.length) {
          h += '<span style="font-size:.6rem;color:var(--border2)">—</span>';
        }
        h += '</div>';
      });
    });

    h += '</div></div>';
    cont.innerHTML = h;
  } catch (e) {
    console.error('[Cal] renderSemana:', e);
    cont.innerHTML =
      '<div style="padding:24px;color:var(--red)"><i class="ph ph-warning"></i> Erro: ' +
      (e instanceof Error ? e.message : String(e)) +
      '</div>';
  }
}

/** Renderiza o painel lateral com detalhes do dia selecionado. */
function renderDetalhe(dt: Date): void {
  const el = tryById('calDetalhe');
  if (!el) return;
  try {
    const iso = paraIso(dt);
    const isHj = iso === paraIso(hoje);
    const lista = reservasVisiveis().filter((r) => ocorre(r, dt));

    let h = `<div class="cal-det-header" style="background:${isHj ? 'var(--primary)' : '#1a3a5c'}">`;
    h += `<div class="cal-det-data">${esc(formatarDia(dt))}${isHj ? ' · Hoje' : ''}</div>`;
    h += `<div class="cal-det-titulo">${esc(formatarDiaLongo(dt))}</div></div>`;
    h += '<div class="cal-det-body">';

    if (!lista.length) {
      h +=
        '<div class="cal-det-vazio"><i class="ph ph-check-circle" ' +
        'style="font-size:1.4rem;opacity:.3;display:block;margin-bottom:6px"></i>' +
        'Nenhuma reserva neste dia.</div>';
    } else {
      TURNOS.forEach((turno) => {
        const grupo = lista.filter((r) => r.turno === turno);
        if (!grupo.length) return;
        const tc = classeTurno(turno);
        h += '<div class="cal-det-turno-grupo"><div class="cal-det-turno-titulo">';
        h += `<span class="cal-leg-dot ${tc}"></span>`;
        h += `<i class="ph ${ICONES_TURNO[turno] ?? 'ph-clock'}"></i> ${esc(turno)}</div>`;
        grupo.forEach((r) => {
          const sala = getSalaById(r.salaId);
          const turma = r.turmaId ? getTurmaById(r.turmaId) : null;
          const inst =
            turma && turma.instrutorId
              ? getUserById(turma.instrutorId)
              : r.instrutorId
                ? getUserById(r.instrutorId)
                : null;
          h += `<div class="cal-det-item ${r.avulsa ? 'avul' : tc}">`;
          h += `<div class="cal-det-sala">${esc(sala ? sala.nome : '—')}`;
          if (r.avulsa) h += '<span class="cal-det-avulsa-badge">Sem turma</span>';
          h += '</div>';
          if (turma) {
            h +=
              '<div class="cal-det-turma"><i class="ph ph-graduation-cap"></i> ' +
              esc(turma.codigo || turma.nome || '') +
              (turma.curso ? ` — ${esc(turma.curso)}` : '') +
              '</div>';
          }
          if (inst) {
            h += `<div class="cal-det-inst"><i class="ph ph-user"></i> ${esc(inst.nome)}</div>`;
          }
          h += '</div>';
        });
        h += '</div>';
      });

      lista
        .filter((r) => r.avulsa && !r.turno)
        .forEach((r) => {
          const sala = getSalaById(r.salaId);
          h +=
            '<div class="cal-det-item avul"><div class="cal-det-sala">' +
            esc(sala ? sala.nome : '—') +
            '<span class="cal-det-avulsa-badge">Sem turma</span></div></div>';
        });
    }
    h += '</div>';
    el.innerHTML = h;
  } catch (e) {
    console.error('[Cal] renderDetalhe:', e);
    el.innerHTML =
      '<div style="padding:16px;color:var(--red)">Erro: ' +
      (e instanceof Error ? e.message : String(e)) +
      '</div>';
  }
}

// ---------------------------------------------------------------------------
// API publica
// ---------------------------------------------------------------------------

/** Funcao principal — atualiza todo o calendario. */
export function rdCalendario(): void {
  try {
    popularSalas();
    estado.filtSala = tryById<HTMLSelectElement>('calFiltSala')?.value || '';
    estado.filtTurno = tryById<HTMLSelectElement>('calFiltTurno')?.value || '';
    atualizarPeriodo();
    if (estado.vista === 'mes') renderMes();
    else renderSemana();
    renderDetalhe(estado.diaSel || hoje);
  } catch (e) {
    console.error('[Cal] rdCalendario:', e);
    const c = tryById('calCorpo');
    if (c) {
      c.innerHTML =
        '<div style="padding:24px;color:var(--red)"><b>Erro ao carregar calendário:</b><br>' +
        (e instanceof Error ? e.message : String(e)) +
        '</div>';
    }
  }
}

/** Handler de clique em um dia do calendario. */
export function calDia(iso: string): void {
  try {
    const p = iso.split('-').map(Number);
    estado.diaSel = new Date(p[0], p[1] - 1, p[2]);
    renderDetalhe(estado.diaSel);

    qsa('.cal-day, .cal-sem-cell').forEach((el) => {
      el.classList.remove('selecionado');
    });
    qsa(`[data-action="calDia" data-arg="${iso}"]`).forEach((el) => {
      el.classList.add('selecionado');
    });
  } catch (e) {
    console.error('[Cal] calDia:', e);
  }
}

/** Navega para o mes ou semana anterior. */
export function calAnterior(): void {
  if (estado.vista === 'mes') {
    if (estado.mes === 0) {
      estado.mes = 11;
      estado.ano--;
    } else estado.mes--;
  } else {
    estado.semBase = somarDias(estado.semBase, -7);
  }
  rdCalendario();
}

/** Navega para o proximo mes ou semana. */
export function calProximo(): void {
  if (estado.vista === 'mes') {
    if (estado.mes === 11) {
      estado.mes = 0;
      estado.ano++;
    } else estado.mes++;
  } else {
    estado.semBase = somarDias(estado.semBase, 7);
  }
  rdCalendario();
}

/** Volta para o mes atual e seleciona hoje. */
export function calHoje(): void {
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);
  estado.ano = agora.getFullYear();
  estado.mes = agora.getMonth();
  estado.diaSel = agora;
  estado.semBase = segundaFeira(agora);
  rdCalendario();
}

/** Alterna entre vista mensal e semanal. */
export function calVista(v: string): void {
  estado.vista = v === 'semana' ? 'semana' : 'mes';
  qsa('.cal-view-btn').forEach((b) => {
    b.classList.toggle('ativo', (b as HTMLElement).dataset.vista === v);
  });
  rdCalendario();
}

/** Aplica os filtros de sala e turno. */
export function calFiltrar(): void {
  estado.filtSala = tryById<HTMLSelectElement>('calFiltSala')?.value || '';
  estado.filtTurno = tryById<HTMLSelectElement>('calFiltTurno')?.value || '';
  rdCalendario();
}

/** Alias legado mantido por compatibilidade. */
export const calMesAnterior = calAnterior;
/** Alias legado mantido por compatibilidade. */
export const calProximoMes = calProximo;
/** Alias legado mantido por compatibilidade. */
export const calSetVista = calVista;