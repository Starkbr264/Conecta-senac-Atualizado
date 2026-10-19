/**
 * Gestao de reservas do painel publico (`dashboard.html`).
 *
 * Migrado de `_js_original/reservas.js` (que comecava com um BOM UTF-8).
 *
 * Assim como em `salas.js` e `turmas.js`, o original sobrescrevia
 * `renderTabelaReservas` via `var` e a versao anterior (`_renderTabelaReservasOrig`)
 * nunca era chamada. Portamos somente a versao efetiva.
 */

import {
  addReserva,
  deleteReserva,
  getReservas,
  getSalas,
  getTurmas,
} from '../../core/storage';
import { showMsg, showToast } from '../../core/ui';
import { escapeHtml, fmtData } from '../../core/format';
import {
  filtrarLista,
  lerFiltros,
  montarBarraPesquisaFiltros,
  type ConfigBarraFiltros,
} from '../../core/filters';
import { byId, qsa, tryById } from '../../core/dom';
import type { DiaSemana, Reserva } from '../../types';

/** Dias uteis exibidos como chips de selecao (domingo e fora). */
const DIAS_SEMANA: Array<{ val: DiaSemana; label: string }> = [
  { val: 'seg', label: 'SEG' },
  { val: 'ter', label: 'TER' },
  { val: 'qua', label: 'QUA' },
  { val: 'qui', label: 'QUI' },
  { val: 'sex', label: 'SEX' },
  { val: 'sab', label: 'SÁB' },
];

/** Configuracao da barra de busca/filtros da secao "Reservas". */
const cfgResrDash: ConfigBarraFiltros = {
  busca: { id: 'buscarResrD', placeholder: 'Pesquisar sala, turma, turno…' },
  filtros: [
    {
      id: 'filtTurnoRD',
      label: 'Turno',
      campo: 'turno',
      opcoes: [
        { value: 'Matutino', label: 'Matutino' },
        { value: 'Vespertino', label: 'Vespertino' },
        { value: 'Noturno', label: 'Noturno' },
      ],
    },
    {
      id: 'filtStatusRD',
      label: 'Status',
      campo: 'status',
      opcoes: [
        { value: 'ATIVA', label: 'ATIVA' },
        { value: 'CANCELADA', label: 'CANCELADA' },
      ],
    },
  ],
};

/** Liga os listeners do formulario de reservas. */
export function initReservas(): void {
  montarDiasCheckboxes();
  popularSelectSalasReserva();
  popularSelectTurmasReserva();
  sincronizarTurnoComTurma();

  byId<HTMLSelectElement>('reservaTurma').addEventListener(
    'change',
    aoMudarTurma,
  );
  byId<HTMLFormElement>('formReserva').addEventListener('submit', (e) => {
    e.preventDefault();
    salvarReserva();
  });

  renderTabelaReservas();
}

/** Constroi os chips de selecao de dia da semana. */
function montarDiasCheckboxes(): void {
  const cont = byId('diasCheckboxes');
  cont.innerHTML = '';
  DIAS_SEMANA.forEach((d) => {
    const label = document.createElement('label');
    label.className = 'check-chip dia';
    label.dataset.val = d.val;
    label.innerHTML = `<input type="checkbox" value="${d.val}"> ${d.label}`;
    label.addEventListener('click', function (this: HTMLElement, e) {
      e.preventDefault();
      this.classList.toggle('checked');
    });
    cont.appendChild(label);
  });
}

/** Preenche o select de salas do formulario de reserva. */
export function popularSelectSalasReserva(): void {
  const sel = byId<HTMLSelectElement>('reservaSala');
  sel.innerHTML = '<option value="">— Selecione uma sala —</option>';
  getSalas().forEach((s) => {
    const o = document.createElement('option');
    o.value = String(s.id);
    o.textContent = `${s.nome} (${s.tipo})`;
    sel.appendChild(o);
  });
}

/** Preenche o select de turmas ainda nao encerradas. */
export function popularSelectTurmasReserva(): void {
  const sel = byId<HTMLSelectElement>('reservaTurma');
  const hoje = new Date().toISOString().split('T')[0];
  sel.innerHTML = '<option value="">— Selecione uma turma —</option>';
  getTurmas()
    .filter((t) => (t.dataFim ?? '') >= hoje)
    .forEach((t) => {
      const o = document.createElement('option');
      o.value = String(t.id);
      o.textContent = `${t.nome} — ${t.curso} (${t.turno})`;
      o.dataset.turno = String(t.turno ?? '');
      o.dataset.inicio = String(t.dataInicio ?? '');
      o.dataset.fim = String(t.dataFim ?? '');
      sel.appendChild(o);
    });
}

/** Ao trocar de turma, copia turno e intervalo de datas para o formulario. */
function aoMudarTurma(this: HTMLSelectElement): void {
  const opt = this.options[this.selectedIndex];
  if (!opt.value) return;
  byId<HTMLSelectElement>('reservaTurno').value = opt.dataset.turno ?? '';
  byId<HTMLInputElement>('reservaInicio').value = opt.dataset.inicio ?? '';
  byId<HTMLInputElement>('reservaInicio').min = opt.dataset.inicio ?? '';
  byId<HTMLInputElement>('reservaFim').value = opt.dataset.fim ?? '';
  byId<HTMLInputElement>('reservaFim').max = opt.dataset.fim ?? '';
}

/** Dispara o `change` do select de turma logo apos a montagem do formulario. */
function sincronizarTurnoComTurma(): void {
  byId<HTMLSelectElement>('reservaTurma').dispatchEvent(new Event('change'));
}

/** Dias marcados nos chips `#diasCheckboxes`. */
function lerDiasSelecionados(): DiaSemana[] {
  return qsa('#diasCheckboxes .check-chip.checked').map(
    (c) => (c as HTMLElement).dataset.val as DiaSemana,
  );
}

/** Reserva candidata usada na deteccao de conflito. */
export type ReservaCandidata = Pick<Reserva, 'salaId' | 'turno'> &
  Partial<Reserva> & { diasSemana?: DiaSemana[] };

/**
 * Detecta conflito de reserva.
 *
 * Regra (inalterada): mesma sala, mesmo turno, intervalos de datas
 * sobrepostos e pelo menos um dia da semana em comum. Reservas com status
 * diferente de `ATIVA` e a propria reserva em edicao sao ignoradas.
 *
 * @returns mensagem de conflito ou `null` quando a reserva pode ser criada
 */
export function verificarConflito(
  nova: ReservaCandidata,
  ignorarId: number | null = null,
): string | null {
  const reservas = getReservas().filter(
    (r) => r.status === 'ATIVA' && r.id !== ignorarId,
  );

  for (const r of reservas) {
    if (r.salaId !== nova.salaId) continue;
    if (r.turno !== nova.turno) continue;

    const semSobreposicao =
      (nova.dataFim ?? '') < (r.dataInicio ?? '') ||
      (r.dataFim ?? '') < (nova.dataInicio ?? '');
    if (semSobreposicao) continue;

    const diasComuns = (nova.diasSemana ?? []).filter((d) =>
      (r.diasSemana ?? []).includes(d),
    );
    if (diasComuns.length > 0) {
      const sala = getSalas().find((s) => s.id === r.salaId);
      const turma = r.turmaId
        ? getTurmas().find((t) => t.id === r.turmaId)
        : null;
      const diasStr = diasComuns.map((d) => String(d).toUpperCase()).join(', ');
      return `Conflito! "${sala?.nome}" já está ocupada no ${r.turno} (${diasStr}) por "${turma?.nome}".`;
    }
  }
  return null;
}

/** Valida e persiste uma nova reserva. */
export function salvarReserva(): void {
  const salaId = parseInt(byId<HTMLSelectElement>('reservaSala').value, 10);
  const turmaId = parseInt(byId<HTMLSelectElement>('reservaTurma').value, 10);
  const turno = byId<HTMLSelectElement>('reservaTurno').value;
  const inicio = byId<HTMLInputElement>('reservaInicio').value;
  const fim = byId<HTMLInputElement>('reservaFim').value;
  const dias = lerDiasSelecionados();

  const erros: string[] = [];
  if (!salaId) erros.push('Selecione uma sala.');
  if (!turmaId) erros.push('Selecione uma turma.');
  if (dias.length === 0) erros.push('Selecione ao menos um dia da semana.');
  if (!inicio) erros.push('Informe a data de início.');
  if (!fim) erros.push('Informe a data de fim.');

  if (erros.length > 0) {
    showMsg('msgReserva', 'error', erros.join(' '));
    return;
  }

  const turma = getTurmas().find((t) => t.id === turmaId);
  if (turma && fim > (turma.dataFim ?? '')) {
    showMsg(
      'msgReserva',
      'error',
      `Data fim (${fmtData(fim)}) ultrapassa o fim da turma (${fmtData(turma.dataFim)}).`,
    );
    return;
  }
  if (turma && inicio < (turma.dataInicio ?? '')) {
    showMsg(
      'msgReserva',
      'error',
      `Data de início (${fmtData(inicio)}) é anterior ao início da turma (${fmtData(turma.dataInicio)}).`,
    );
    return;
  }

  const sala = getSalas().find((s) => s.id === salaId);
  const turnosSala = sala?.turnosDisponiveis ?? sala?.turnos ?? [];
  if (sala && !turnosSala.includes(turno as never)) {
    showMsg(
      'msgReserva',
      'warning',
      `A sala "${sala.nome}" não tem o turno ${turno} disponível.`,
    );
    return;
  }

  const nova: ReservaCandidata = {
    salaId,
    turmaId,
    diasSemana: dias,
    turno,
    dataInicio: inicio,
    dataFim: fim,
    status: 'ATIVA',
  };

  const conflito = verificarConflito(nova);
  if (conflito) {
    showMsg('msgReserva', 'error', conflito);
    return;
  }

  addReserva(nova as Omit<Reserva, 'id'>);
  showToast('Reserva criada com sucesso!', 'success');
  byId<HTMLFormElement>('formReserva').reset();
  qsa('#diasCheckboxes .check-chip').forEach((c) =>
    c.classList.remove('checked'),
  );
  const msg = tryById('msgReserva');
  if (msg !== null) msg.style.display = 'none';
  renderTabelaReservas();
}

/** Exclui uma reserva apos confirmacao. */
export function excluirReserva(id: number): void {
  if (!confirm('Excluir esta reserva?')) return;
  deleteReserva(id);
  showToast('Reserva excluída.', 'warning');
  renderTabelaReservas();
}

/** Linha HTML de uma reserva. */
function linhaReserva(r: Reserva, salas: ReturnType<typeof getSalas>, turmas: ReturnType<typeof getTurmas>): string {
  const sala = salas.find((s) => s.id === r.salaId);
  const turma = r.turmaId ? turmas.find((t) => t.id === r.turmaId) : null;
  const diasStr = (r.diasSemana ?? []).map((d) => String(d).toUpperCase()).join(', ');
  const isAtiva = r.status === 'ATIVA';
  const turmaLabel = r.avulsa
    ? '<span class="badge badge-warning">Sem turma</span>'
    : turma
      ? escapeHtml(turma.nome)
      : '<em>Turma removida</em>';

  return `
      <tr>
        <td><strong>${sala ? escapeHtml(sala.nome) : '<em>Sala removida</em>'}</strong></td>
        <td class="code-text">${turmaLabel}</td>
        <td><span class="badge badge-primary">${r.turno}</span></td>
        <td style="font-size:.82rem;color:var(--text-muted)">${diasStr}</td>
        <td style="font-size:.87rem">${fmtData(r.dataInicio)} → ${fmtData(r.dataFim)}</td>
        <td><span class="badge ${isAtiva ? 'badge-success' : 'badge-danger'}">${r.status}</span></td>
        <td>
          ${isAtiva ? `<button class="btn btn-danger-sm" data-action="excluirReserva" data-arg="${r.id}">Excluir</button>` : '—'}
        </td>
      </tr>`;
}

/**
 * Renderiza a tabela de reservas aplicando os filtros da barra de busca.
 *
 * No legado esta era a funcao sobrescrita pelo "monkey-patch"; aqui e a
 * unica implementacao exported, porque a versao anterior ja era inalcancavel.
 */
export function renderTabelaReservas(): void {
  const cont = tryById('searchResrDash');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchResrDash', cfgResrDash, renderTabelaReservas);
  }

  const vals = lerFiltros(cfgResrDash);
  const salas = getSalas();
  const turmas = getTurmas();

  let reservas = getReservas();
  reservas = filtrarLista(reservas, vals['_busca'], [
    (r) => {
      const s = salas.find((x) => x.id === r.salaId);
      return s ? s.nome : '';
    },
    (r) => {
      const t = turmas.find((x) => x.id === r.turmaId);
      return t ? t.nome : '';
    },
    'turno',
  ]);
  if (vals['turno']) reservas = reservas.filter((r) => r.turno === vals['turno']);
  if (vals['status']) reservas = reservas.filter((r) => r.status === vals['status']);

  const cnt = tryById('countResrDash');
  if (cnt !== null) cnt.textContent = `${reservas.length} reserva(s)`;

  const tbody =
    tryById<HTMLTableSectionElement>('tabelaReservas')?.querySelector('tbody');
  if (tbody === null || tbody === undefined) return;

  if (reservas.length === 0) {
    tbody.innerHTML =
      '<tr class="empty-row"><td colspan="7">Nenhuma reserva encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = reservas.map((r) => linhaReserva(r, salas, turmas)).join('');
}