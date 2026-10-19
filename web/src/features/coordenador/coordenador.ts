/**
 * Painel do Coordenador (`coordenador.html`).
 *
 * Migrado de `_js_original/coordenador_page.js`.
 *
 * Secoes:
 *   Dashboard    — resumo da unidade (salas, turmas ativas, reservas, solicitacoes)
 *   Salas        — CRUD de salas da unidade
 *   Turmas       — CRUD de turmas com instrutor vinculado
 *   Reservas     — CRUD de reservas recorrentes e pontuais
 *   Instrutores  — listagem e atribuicao de turmas a instrutores
 *   Mapa         — ocupacao em tempo real + override manual de status
 *   Solicitacoes — aprovacao/recusa dos pedidos dos instrutores
 *   Notificacoes — avisos do sistema
 *   Calendario   — calendario mensal/semanal das reservas da unidade
 *
 * Aprovacao de solicitacoes cria as reservas automaticamente.
 *
 * Codigo morto removido na conversao (documentado no relatorio):
 *  - `abrirAtrib`/`salvarAtrib`/`rdSalas`/`rdTurmas`/`rdReservas`/`rdInstrutores`
 *    originais, todas reescritas depois por monkey-patch; as versoes originais
 *    ficavam inalcancaveis.
 *  - `rdMapaDebounced` + `_mapaTimer`: nunca chamados por nenhum handler.
 *  - `labelStatus` local: duplicava `core/format`.
 */

import {
  addNotifAsync,
  addReservaAsync,
  addSala,
  addTurma,
  countNaoLidas,
  delReserva,
  delSala,
  delTurma,
  getNotifsPara,
  getOverride,
  getReservaById,
  getReservas,
  getSalaById,
  getSalasByUnidade,
  getSolics,
  getTurmaById,
  getTurmas,
  getUserById,
  getUsersByPerfil,
  initDados,
  marcarTodasLidas,
  setOverride,
  updReserva,
  updSala,
  updSolicAsync,
  updTurma,
  type NovoSala,
  type OverrideSala,
} from '../../core/storage';
import {
  calcStatus,
  esc,
  fmtData,
  fmtDateTime,
  hojeISO,
  htmlStatus,
  labelStatus,
} from '../../core/format';
import { fmsg, fmsgHide, modalAbrir, modalFechar, toast } from '../../core/ui';
import { getSessao } from '../../core/theme';
import { initLogo, initSidebar, requirePerfil } from '../../core/auth';
import {
  filtrarLista,
  lerFiltros,
  montarBarraPesquisaFiltros,
  type ConfigBarraFiltros,
} from '../../core/filters';
import { byId, tryById } from '../../core/dom';
import { rdCalendario } from '../calendario/calendario';
import { verificarConflito, type ReservaCandidata } from '../dashboard/reservas';
import type {
  DiaSemana,
  Sessao,
  Solicitacao,
  StatusManualSala,
  StatusSolicitacao,
  Turno,
} from '../../types';

const DIAS: Array<{ v: DiaSemana; l: string }> = [
  { v: 'seg', l: 'SEG' },
  { v: 'ter', l: 'TER' },
  { v: 'qua', l: 'QUA' },
  { v: 'qui', l: 'QUI' },
  { v: 'sex', l: 'SEX' },
  { v: 'sab', l: 'SÁB' },
];

const TURNOS: Turno[] = ['Matutino', 'Vespertino', 'Noturno'];

let sess: Sessao | null = null;
let editSalaId: number | null = null;
let editTurmaId: number | null = null;
let editReservaId: number | null = null;

/** Inicializa o painel. Deve ser chamado uma vez pelo entry da pagina. */
export async function initCoordenador(): Promise<void> {
  await initDados();
  requirePerfil('coordenador');
  sess = getSessao();
  initSidebar();
  initLogo();
  ir('dashboard');
  atualizarBadges();
}

function uid(): number | null {
  return sess ? sess.unidadeId : null;
}

function refreshMapaCoord(): void {
  if (tryById('mapaSalas') !== null) rdMapa();
}

// ---------------------------------------------------------------------------
// Navegacao
// ---------------------------------------------------------------------------

const META: Record<string, { t: string; s: string }> = {
  dashboard: { t: 'Dashboard', s: 'Visão geral da unidade' },
  salas: { t: 'Salas', s: 'Cadastre e gerencie as salas' },
  turmas: { t: 'Turmas', s: 'Cadastre e gerencie turmas' },
  reservas: { t: 'Reservas', s: 'Reservas recorrentes de salas' },
  instrutores: { t: 'Instrutores', s: 'Instrutores desta unidade' },
  mapa: { t: 'Mapa de Salas', s: 'Ocupação atual das salas' },
  solicitacoes: { t: 'Solicitações', s: 'Pedidos de sala dos instrutores' },
  notifs: { t: 'Notificações', s: 'Avisos recebidos' },
  calendario: {
    t: 'Calendário de Reservas',
    s: 'Visualize reservas por data e turno',
  },
};

/** Navega entre as secoes do painel. */
export function ir(aba: string): void {
  document.querySelectorAll<HTMLElement>('.pg').forEach((p) => {
    p.classList.remove('ativa');
    p.style.display = 'none';
  });
  const pg = tryById(`pg-${aba}`);
  if (pg !== null) {
    pg.classList.add('ativa');
    pg.style.display = 'block';
  }
  document.querySelectorAll<HTMLElement>('.sb-btn').forEach((b) => b.classList.remove('ativo'));
  const btn = tryById(`nav-${aba}`);
  if (btn !== null) btn.classList.add('ativo');

  const m = META[aba] ?? {};
  setText('tbTitle', m.t ?? aba);
  setText('tbSub', m.s ?? '');

  if (aba === 'dashboard') rdDash();
  if (aba === 'salas') rdSalas();
  if (aba === 'turmas') rdTurmas();
  if (aba === 'reservas') rdReservas();
  if (aba === 'instrutores') rdInstrutores();
  if (aba === 'mapa') {
    popularFiltrosMapa();
    rdMapa();
  }
  if (aba === 'solicitacoes') rdSolics();
  if (aba === 'notifs') rdNotifs();
  if (aba === 'calendario') rdCalendario();
}

function setText(id: string, valor: string | number): void {
  const el = tryById(id);
  if (el !== null) el.textContent = String(valor);
}

/** Turnos disponiveis de uma sala; cai para os 3 turnos quando vazio. */
function turnosSalaReserva(salaId: number | string | null): Turno[] {
  const sala = salaId ? getSalaById(parseInt(String(salaId), 10)) : null;
  const turnos = (sala ? (sala.turnos ?? sala.turnosDisponiveis ?? []) : []) as Turno[];
  return turnos.length ? turnos : TURNOS.slice();
}

/** Popula o `<select>` de turno conforme os turnos da sala escolhida. */
function popularTurnosReserva(salaId: number | string | null, preferido: string): void {
  const sel = tryById<HTMLSelectElement>('mRTurno');
  if (sel === null) return;
  const turnos = turnosSalaReserva(salaId);
  sel.innerHTML = '';
  turnos.forEach((t) => {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t;
    sel.appendChild(o);
  });
  byId<HTMLSelectElement>('mRTurno').value = turnos.includes(preferido as Turno)
    ? preferido
    : turnos[0];
}

/** Converte uma lista de datas ISO nos dias da semana correspondentes. */
function diasSemanaDeDatas(datas: string[] | null | undefined): DiaSemana[] {
  const dias: DiaSemana[] = [];
  (datas || []).forEach((data) => {
    const p = String(data || '')
      .split('-')
      .map(Number);
    if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return;
    const d = (['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as DiaSemana[])[
      new Date(p[0], p[1] - 1, p[2]).getDay()
    ];
    if (!dias.includes(d)) dias.push(d);
  });
  return dias;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function rdDash(): void {
  const salas = getSalasByUnidade(uid() as number);
  const turmas = getTurmas().filter((t) => t.unidadeId === uid());
  const res = getReservas().filter((r) => r.unidadeId === uid());
  const solic = getSolics().filter(
    (s) => s.unidadeId === uid() && s.status === 'pendente',
  );
  setText('stSalas', salas.length);
  setText('stTurmas', turmas.filter((t) => calcStatus(t) === 'ativa').length);
  setText('stRes', res.length);
  setText('stSol', solic.length);

  const tb = byId('tbDash');
  const rec = turmas
    .slice()
    .sort((a, b) => b.id - a.id)
    .slice(0, 6);
  if (!rec.length) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="5">Nenhuma turma cadastrada.</td></tr>';
    return;
  }
  tb.innerHTML = rec
    .map((t) => {
      const inst = t.instrutorId ? getUserById(t.instrutorId) : null;
      return (
        '<tr><td class="mono"><strong>' +
        esc(t.nome) +
        '</strong></td>' +
        '<td>' +
        esc(t.curso) +
        '</td>' +
        '<td>' +
        esc(inst ? inst.nome : '—') +
        '</td>' +
        '<td>' +
        htmlStatus(t) +
        '</td>' +
        '<td style="font-size:.82rem">' +
        fmtData(t.dataInicio) +
        ' → ' +
        fmtData(t.dataFim) +
        '</td></tr>'
      );
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------

const cfgSalasCoord: ConfigBarraFiltros = {
  busca: { id: 'buscarSalaCoord', placeholder: 'Pesquisar sala por nome ou tipo…' },
  filtros: [
    {
      id: 'filtTipoSalaC',
      label: 'Tipo',
      campo: 'tipo',
      opcoes: [
        { value: 'Laboratório de Informática', label: 'Lab. Informática' },
        { value: 'Laboratório de Gastronomia', label: 'Lab. Gastronomia' },
        { value: 'Laboratório de Enfermagem', label: 'Lab. Enfermagem' },
        { value: 'Laboratório de Estética', label: 'Lab. Estética' },
        { value: 'Laboratório de Ciências', label: 'Lab. Ciências' },
        { value: 'Sala de Aula comum', label: 'Sala Comum' },
        { value: 'Auditório', label: 'Auditório' },
        { value: 'Sala de Reunião', label: 'Sala Reunião' },
        { value: 'Sala de Videoconferência', label: 'Videoconf.' },
      ],
    },
  ],
};

export function rdSalas(): void {
  const cont = tryById('searchSalasCoord');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchSalasCoord', cfgSalasCoord, renderSalasCoord);
  }
  renderSalasCoord();
}

function renderSalasCoord(): void {
  const vals = lerFiltros(cfgSalasCoord);
  let list = getSalasByUnidade(uid() as number);
  list = filtrarLista(list, vals['_busca'], ['nome', 'tipo', 'andar', 'bloco']);
  if (vals['tipo']) list = list.filter((s) => s.tipo === vals['tipo']);

  setText('countSalasCoord', `${list.length} sala(s)`);
  const tb = byId('tbSalas');
  if (!list.length) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="7">Nenhuma sala encontrada.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((s) => {
      const turnos = (s.turnos ?? s.turnosDisponiveis ?? [])
        .map((t) => `<span class="bdg bdg-primary">${esc(t)}</span>`)
        .join(' ');
      return (
        '<tr><td><strong>' +
        esc(s.nome) +
        '</strong></td>' +
        '<td>' +
        esc(s.andar || '—') +
        '</td>' +
        '<td>' +
        esc(s.bloco || '—') +
        '</td>' +
        '<td>' +
        s.capacidade +
        ' pess.</td>' +
        '<td>' +
        esc(s.tipo) +
        '</td>' +
        '<td>' +
        turnos +
        '</td>' +
        '<td><div class="td-actions">' +
        '<button class="btn btn-ghost btn-sm" data-action="abrirSala" data-arg="' +
        s.id + '">Editar</button>' +
        '<button class="btn btn-danger btn-sm" data-action="excluirSala" data-arg="' +
        s.id + '">Excluir</button>' +
        '</div></td></tr>'
      );
    })
    .join('');
}

/** Abre o modal de criacao/edicao de sala. */
export function abrirSala(id: number | null = null): void {
  editSalaId = id || null;
  const s = id ? getSalaById(id) : null;
  setText('mSTit', id ? 'Editar Sala' : 'Nova Sala');
  byId<HTMLInputElement>('mSNome').value = s ? s.nome : '';
  byId<HTMLInputElement>('mSCap').value = s ? String(s.capacidade ?? '') : '';
  byId<HTMLInputElement>('mSTipo').value = s ? s.tipo : '';
  byId<HTMLInputElement>('mSAndar').value = s ? s.andar || '' : '';
  byId<HTMLInputElement>('mSBloco').value = s ? s.bloco || '' : '';

  const cont = byId('mSTurnos');
  cont.innerHTML = '';
  TURNOS.forEach((t) => {
    const c = document.createElement('div');
    c.className = 'chip' + (s && (s.turnos ?? []).includes(t) ? ' ativo' : '');
    c.dataset['v'] = t;
    c.textContent = t;
    c.onclick = () => c.classList.toggle('ativo');
    cont.appendChild(c);
  });
  fmsgHide('mSMsg');
  modalAbrir('modalSala');
}

/** Persiste a sala criada/editada. */
export function salvarSala(): void {
  const nome = byId<HTMLInputElement>('mSNome').value.trim();
  const cap = parseInt(byId<HTMLInputElement>('mSCap').value, 10);
  const tipo = byId<HTMLInputElement>('mSTipo').value.trim();
  const andar = byId<HTMLInputElement>('mSAndar').value.trim();
  const bloco = byId<HTMLInputElement>('mSBloco').value.trim();
  const turnos = Array.from(
    document.querySelectorAll<HTMLElement>('#mSTurnos .chip.ativo'),
  ).map((c) => c.dataset['v'] as Turno);

  if (!nome || !cap || !tipo) {
    fmsg('mSMsg', 'erro', 'Preencha nome, capacidade e tipo.');
    return;
  }
  const dados: NovoSala = {
    nome,
    capacidade: cap,
    tipo,
    andar,
    bloco,
    turnos,
    turnosDisponiveis: turnos,
    unidadeId: uid() as number,
  };
  if (editSalaId) {
    updSala(editSalaId, dados);
    toast('Sala atualizada!', 'ok');
  } else {
    addSala(dados);
    toast('Sala cadastrada!', 'ok');
  }
  modalFechar('modalSala');
  rdSalas();
  rdMapa();
}

/** Exclui uma sala, bloqueando quando existem reservas vinculadas. */
export function excluirSala(id: number): void {
  const s = getSalaById(id);
  if (!s) return;
  if (getReservas().filter((r) => r.salaId === id).length > 0) {
    toast('Sala tem reservas. Remova-as primeiro.', 'erro');
    return;
  }
  if (!confirm(`Excluir "${s.nome}"?`)) return;
  delSala(id);
  toast('Sala excluída.', 'aviso');
  rdSalas();
}

// ---------------------------------------------------------------------------
// Turmas
// ---------------------------------------------------------------------------

const cfgTurmasCoord: ConfigBarraFiltros = {
  busca: { id: 'buscarTurmaCoord', placeholder: 'Pesquisar por código, curso ou instrutor…' },
  filtros: [
    {
      id: 'filtTurnoTC',
      label: 'Turno',
      campo: 'turno',
      opcoes: [
        { value: 'Matutino', label: 'Matutino' },
        { value: 'Vespertino', label: 'Vespertino' },
        { value: 'Noturno', label: 'Noturno' },
      ],
    },
    {
      id: 'filtStatusTC',
      label: 'Status',
      campo: '_status',
      opcoes: [
        { value: 'ativa', label: 'Ativa' },
        { value: 'iminente', label: 'Iminente' },
        { value: 'posterior', label: 'Posterior' },
        { value: 'encerrada', label: 'Encerrada' },
      ],
    },
  ],
};

type TurmaCoord = ReturnType<typeof getTurmas>[number] & { _status: string };

export function rdTurmas(): void {
  const cont = tryById('searchTurmasCoord');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchTurmasCoord', cfgTurmasCoord, renderTurmasCoord);
  }
  renderTurmasCoord();
}

function renderTurmasCoord(): void {
  const vals = lerFiltros(cfgTurmasCoord);
  let list: TurmaCoord[] = getTurmas()
    .filter((t) => t.unidadeId === uid())
    .map((t) => ({ ...t, _status: calcStatus(t) }));
  list = filtrarLista(list, vals['_busca'], [
    'nome',
    'curso',
    (t) => {
      const i = t.instrutorId ? getUserById(t.instrutorId) : null;
      return i ? i.nome : '';
    },
  ]);
  if (vals['turno']) list = list.filter((t) => t.turno === vals['turno']);
  if (vals['_status']) list = list.filter((t) => t._status === vals['_status']);
  list.sort((a, b) => String(a.dataInicio).localeCompare(String(b.dataInicio)));

  setText('countTurmasCoord', `${list.length} turma(s)`);
  const tb = byId('tbTurmas');
  if (!list.length) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="8">Nenhuma turma encontrada.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((t) => {
      const inst = t.instrutorId ? getUserById(t.instrutorId) : null;
      return (
        '<tr><td class="mono"><strong>' +
        esc(t.nome) +
        '</strong></td>' +
        '<td>' +
        esc(t.curso) +
        '</td>' +
        '<td><span class="bdg bdg-primary">' +
        esc(t.turno) +
        '</span></td>' +
        '<td>' +
        esc(inst ? inst.nome : '—') +
        '</td>' +
        '<td>' +
        fmtData(t.dataInicio) +
        '</td><td>' +
        fmtData(t.dataFim) +
        '</td>' +
        '<td>' +
        htmlStatus(t) +
        '</td>' +
        '<td><div class="td-actions">' +
        '<button class="btn btn-ghost btn-sm" data-action="abrirTurma" data-arg="' +
        t.id + '">Editar</button>' +
        '<button class="btn btn-danger btn-sm" data-action="excluirTurma" data-arg="' +
        t.id + '">Excluir</button>' +
        '</div></td></tr>'
      );
    })
    .join('');
}

/** Abre o modal de criacao/edicao de turma. */
export function abrirTurma(id: number | null = null): void {
  editTurmaId = id || null;
  const t = id ? getTurmaById(id) : null;
  setText('mTTit', id ? 'Editar Turma' : 'Nova Turma');
  byId<HTMLInputElement>('mTCod').value = t ? t.nome : '';
  byId<HTMLInputElement>('mTCurso').value = t ? t.curso : '';
  byId<HTMLSelectElement>('mTTurno').value = t ? t.turno : 'Matutino';
  byId<HTMLInputElement>('mTIni').value = t ? t.dataInicio || '' : '';
  byId<HTMLInputElement>('mTFim').value = t ? t.dataFim || '' : '';

  const sel = byId<HTMLSelectElement>('mTInst');
  sel.innerHTML = '<option value="">— Sem instrutor —</option>';
  getUsersByPerfil('instrutor')
    .filter((u) => u.unidadeId === uid())
    .forEach((u) => {
      const o = document.createElement('option');
      o.value = String(u.id);
      o.textContent = u.nome;
      if (t && t.instrutorId === u.id) o.selected = true;
      sel.appendChild(o);
    });
  fmsgHide('mTMsg');
  modalAbrir('modalTurma');
}

/** Persiste a turma criada/editada. */
export function salvarTurma(): void {
  const nome = byId<HTMLInputElement>('mTCod').value.trim();
  const curso = byId<HTMLInputElement>('mTCurso').value.trim();
  const turno = byId<HTMLSelectElement>('mTTurno').value;
  const ini = byId<HTMLInputElement>('mTIni').value;
  const fim = byId<HTMLInputElement>('mTFim').value;
  const instId = parseInt(byId<HTMLSelectElement>('mTInst').value, 10) || null;

  if (!nome || !curso || !ini || !fim) {
    fmsg('mTMsg', 'erro', 'Preencha todos os campos obrigatórios.');
    return;
  }
  if (fim < ini) {
    fmsg('mTMsg', 'erro', 'Data fim deve ser posterior ao início.');
    return;
  }
  const dados = {
    nome,
    curso,
    turno,
    dataInicio: ini,
    dataFim: fim,
    instrutorId: instId,
    unidadeId: uid() as number,
  };
  if (editTurmaId) {
    updTurma(editTurmaId, dados);
    toast('Turma atualizada!', 'ok');
  } else {
    addTurma(dados);
    toast('Turma cadastrada!', 'ok');
  }
  modalFechar('modalTurma');
  rdTurmas();
}

/** Exclui uma turma e, em cascata no cliente, as reservas vinculadas. */
export function excluirTurma(id: number): void {
  const t = getTurmaById(id);
  if (!t) return;
  if (!confirm(`Excluir turma "${t.nome}"?`)) return;
  delTurma(id);
  getReservas()
    .filter((r) => r.turmaId === id)
    .forEach((r) => delReserva(r.id));
  toast('Turma excluída.', 'aviso');
  rdTurmas();
}

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------

const cfgResCoord: ConfigBarraFiltros = {
  busca: { id: 'buscarResCoord', placeholder: 'Pesquisar por sala, turma…' },
  filtros: [
    {
      id: 'filtTurnoRC',
      label: 'Turno',
      campo: 'turno',
      opcoes: [
        { value: 'Matutino', label: 'Matutino' },
        { value: 'Vespertino', label: 'Vespertino' },
        { value: 'Noturno', label: 'Noturno' },
      ],
    },
  ],
};

export function rdReservas(): void {
  const cont = tryById('searchResCoord');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchResCoord', cfgResCoord, renderResCoord);
  }
  renderResCoord();
}

function renderResCoord(): void {
  const vals = lerFiltros(cfgResCoord);
  let list = getReservas().filter((r) => r.unidadeId === uid());
  list = filtrarLista(list, vals['_busca'], [
    (r) => {
      const s = getSalaById(r.salaId);
      return s ? s.nome : '';
    },
    (r) => {
      const t = getTurmaById(r.turmaId);
      return t ? t.nome : '';
    },
    'turno',
  ]);
  if (vals['turno']) list = list.filter((r) => r.turno === vals['turno']);
  list.sort((a, b) => String(a.dataInicio).localeCompare(String(b.dataInicio)));

  setText('countResCoord', `${list.length} reserva(s)`);
  const tb = byId('tbReservas');
  if (!list.length) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="8">Nenhuma reserva encontrada.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((r) => {
      const sala = getSalaById(r.salaId);
      const turma = r.turmaId ? getTurmaById(r.turmaId) : null;
      const st = r.avulsa ? 'ativa' : turma ? calcStatus(turma) : 'encerrada';
      const horario =
        r.horaInicio && r.horaFim
          ? '<div style="font-size:.72rem;color:var(--text3)"><i class="ph ph-clock"></i> ' +
            r.horaInicio +
            ' - ' +
            r.horaFim +
            '</div>'
          : '';
      const turmaLabel = r.avulsa
        ? '<span class="bdg bdg-amber">Sem turma</span>'
        : esc(turma ? turma.nome : '—');
      return (
        '<tr><td><strong>' +
        esc(sala ? sala.nome : '—') +
        '</strong></td>' +
        '<td class="mono">' +
        turmaLabel +
        '</td>' +
        '<td><span class="bdg bdg-primary">' +
        esc(r.turno) +
        '</span></td>' +
        '<td style="font-size:.78rem">' +
        (r.diasSemana ?? []).map((d) => d.toUpperCase()).join(', ') +
        '</td>' +
        '<td style="font-size:.82rem">' +
        fmtData(r.dataInicio) +
        ' → ' +
        fmtData(r.dataFim) +
        horario +
        '</td>' +
        '<td><span class="st st-' +
        esc(st) +
        '">' +
        esc(labelStatus(st)) +
        '</span></td>' +
        '<td><div class="td-actions">' +
        '<button class="btn btn-ghost btn-sm" data-action="abrirReserva" data-arg="' +
        r.id + '">Editar</button>' +
        '<button class="btn btn-danger btn-sm" data-action="excluirReserva" data-arg="' +
        r.id + '">Excluir</button>' +
        '</div></td></tr>'
      );
    })
    .join('');
}

/** Abre o modal de criacao/edicao de reserva. */
export function abrirReserva(id: number | null = null): void {
  editReservaId = id || null;
  const reserva = id ? getReservaById(id) : null;

  const titulo = tryById('mrTitulo');
  if (titulo !== null) titulo.textContent = id ? 'Editar Reserva' : 'Nova Reserva';

  const btnSalvar = document.querySelector('#modalRes .btn-primary');
  if (btnSalvar !== null) btnSalvar.textContent = id ? 'Salvar Alterações' : 'Criar Reserva';

  const selS = byId<HTMLSelectElement>('mRSala');
  selS.innerHTML = '<option value="">— Selecione a sala —</option>';
  getSalasByUnidade(uid() as number).forEach((s) => {
    const o = document.createElement('option');
    o.value = String(s.id);
    o.textContent = `${s.nome} (${s.tipo})`;
    if (reserva && reserva.salaId === s.id) o.selected = true;
    selS.appendChild(o);
  });
  selS.onchange = () => {
    popularTurnosReserva(selS.value, byId<HTMLSelectElement>('mRTurno').value);
  };

  const selT = byId<HTMLSelectElement>('mRTurma');
  const isAvulsa = !!(reserva && reserva.avulsa);
  selT.innerHTML =
    '<option value="">' +
    (isAvulsa ? '— Sem turma vinculada —' : '— Selecione a turma —') +
    '</option>';
  selT.disabled = isAvulsa;
  selT.style.opacity = isAvulsa ? '.5' : '';
  if (!isAvulsa) {
    getTurmas()
      .filter(
        (t) =>
          t.unidadeId === uid() &&
          (calcStatus(t) !== 'encerrada' || (!!reserva && reserva.turmaId === t.id)),
      )
      .forEach((t) => {
        const o = document.createElement('option');
        o.value = String(t.id);
        o.textContent = `${t.nome} — ${t.curso}`;
        o.dataset['ini'] = t.dataInicio || '';
        o.dataset['fim'] = t.dataFim || '';
        o.dataset['turno'] = String(t.turno);
        if (reserva && reserva.turmaId === t.id) o.selected = true;
        selT.appendChild(o);
      });
    selT.onchange = () => {
      const o = selT.options[selT.selectedIndex];
      const ini = o ? o.dataset['ini'] : undefined;
      const fim = o ? o.dataset['fim'] : undefined;
      const turnoOpt = o ? o.dataset['turno'] : undefined;
      if (o && ini) {
        byId<HTMLInputElement>('mRIni').value = ini;
        byId<HTMLInputElement>('mRFim').value = String(fim ?? '');
        popularTurnosReserva(byId<HTMLSelectElement>('mRSala').value, String(turnoOpt ?? ''));
      }
    };
  }

  const cont = byId('mRDias');
  cont.innerHTML = '';
  DIAS.forEach((d) => {
    const c = document.createElement('div');
    c.className =
      'chip' +
      (reserva && Array.isArray(reserva.diasSemana) && reserva.diasSemana.includes(d.v)
        ? ' ativo'
        : '');
    c.dataset['v'] = d.v;
    c.textContent = d.l;
    c.onclick = () => c.classList.toggle('ativo');
    cont.appendChild(c);
  });

  if (reserva) {
    popularTurnosReserva(reserva.salaId, String(reserva.turno));
    byId<HTMLInputElement>('mRIni').value = reserva.dataInicio || '';
    byId<HTMLInputElement>('mRFim').value = reserva.dataFim || '';
  } else {
    popularTurnosReserva(byId<HTMLSelectElement>('mRSala').value, 'Matutino');
    byId<HTMLInputElement>('mRIni').value = '';
    byId<HTMLInputElement>('mRFim').value = '';
  }

  fmsgHide('mRMsg');
  modalAbrir('modalRes');
}

/** Persiste a reserva criada/editada, validando turno, turma e conflitos. */
export function salvarReserva(): void {
  const salaId = parseInt(byId<HTMLSelectElement>('mRSala').value, 10);
  const turmaId = parseInt(byId<HTMLSelectElement>('mRTurma').value, 10);
  const turno = byId<HTMLSelectElement>('mRTurno').value;
  const ini = byId<HTMLInputElement>('mRIni').value;
  const fim = byId<HTMLInputElement>('mRFim').value;
  const dias = Array.from(
    document.querySelectorAll<HTMLElement>('#mRDias .chip.ativo'),
  ).map((c) => c.dataset['v'] as DiaSemana);

  const editando = !!editReservaId;
  const reservaAtual = editando ? getReservaById(editReservaId as number) : null;
  const isAvulsaEdit = !!(reservaAtual && reservaAtual.avulsa);

  if (!salaId || !ini || !fim || !dias.length || (!turmaId && !isAvulsaEdit)) {
    fmsg('mRMsg', 'erro', 'Preencha todos os campos e selecione ao menos um dia.');
    return;
  }
  const turnosSala = turnosSalaReserva(salaId);
  if (!turnosSala.includes(turno as Turno)) {
    fmsg(
      'mRMsg',
      'erro',
      `A sala selecionada nao atende o turno ${turno}.`,
    );
    return;
  }
  if (turmaId) {
    const turma = getTurmaById(turmaId);
    if (turma) {
      if (fim > String(turma.dataFim)) {
        fmsg(
          'mRMsg',
          'erro',
          `Data fim (${fmtData(fim)}) ultrapassa o fim da turma (${fmtData(turma.dataFim)}).`,
        );
        return;
      }
      if (ini < String(turma.dataInicio)) {
        fmsg(
          'mRMsg',
          'erro',
          `Data início (${fmtData(ini)}) é anterior ao início da turma (${fmtData(turma.dataInicio)}).`,
        );
        return;
      }
    }
  }

  const cf = checarConflito(salaId, turno, dias, ini, fim, editReservaId);
  if (cf) {
    fmsg('mRMsg', 'erro', cf);
    return;
  }

  const reservadoPorId = sess ? sess.id : null;
  if (editReservaId) {
    const updDados: Parameters<typeof updReserva>[1] = {
      salaId,
      turno,
      diasSemana: dias,
      dataInicio: ini,
      dataFim: fim,
      reservadoPorId,
      unidadeId: uid() as number,
    };
    if (!isAvulsaEdit) updDados.turmaId = turmaId;
    updReserva(editReservaId, updDados);
    toast('Reserva atualizada!', 'ok');
  } else {
    addReservaAsync({
      salaId,
      turmaId,
      turno,
      diasSemana: dias,
      dataInicio: ini,
      dataFim: fim,
      reservadoPorId,
      unidadeId: uid() as number,
    });
    toast('Reserva criada!', 'ok');
  }
  editReservaId = null;
  modalFechar('modalRes');
  rdReservas();
  refreshMapaCoord();
}

/** Exclui uma reserva; reservas originadas por solicitacao recusam a solicitacao. */
export function excluirReserva(id: number): void {
  if (!confirm('Excluir esta reserva?')) return;
  const r = getReservaById(id);
  if (r && r.avulsa && r.solicId) {
    updSolicAsync(r.solicId, { status: 'recusada' });
  }
  delReserva(id);
  toast('Reserva excluída.', 'aviso');
  rdReservas();
  refreshMapaCoord();
}

// ---------------------------------------------------------------------------
// Instrutores e atribuicao de turmas
// ---------------------------------------------------------------------------

const cfgInstCoord: ConfigBarraFiltros = {
  busca: { id: 'buscarInstCoord', placeholder: 'Pesquisar instrutor por nome ou e-mail…' },
  filtros: [],
};

export function rdInstrutores(): void {
  const cont = tryById('searchInstCoord');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchInstCoord', cfgInstCoord, renderInstCoord);
  }
  renderInstCoord();
}

function renderInstCoord(): void {
  const vals = lerFiltros(cfgInstCoord);
  let list = getUsersByPerfil('instrutor').filter((u) => u.unidadeId === uid());
  list = filtrarLista(list, vals['_busca'], ['nome', 'email']);

  setText('countInstCoord', `${list.length} instrutor(es)`);
  const tb = byId('tbInst');
  if (!list.length) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="4">Nenhum instrutor encontrado.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((u) => {
      const turmas = getTurmas().filter(
        (t) => t.instrutorId === u.id && t.unidadeId === uid(),
      );
      const tHtml = turmas.length
        ? turmas
            .map(
              (t) =>
                '<span class="st st-' +
                calcStatus(t) +
                '" style="margin-right:4px">' +
                esc(t.nome) +
                '</span>',
            )
            .join('')
        : '<span class="txt3">Nenhuma</span>';
      return (
        '<tr><td><strong>' +
        esc(u.nome) +
        '</strong></td><td class="mono">' +
        esc(u.email) +
        '</td>' +
        '<td>' +
        tHtml +
        '</td>' +
        '<td><button class="btn btn-ghost btn-sm" data-action="abrirAtrib" data-arg="' +
        u.id + '">Atribuir Turmas</button></td></tr>'
      );
    })
    .join('');
}

/** Abre o modal de atribuicao de turmas (multi-selecao). */
export function abrirAtrib(instId: number): void {
  byId<HTMLInputElement>('mAInstId').value = String(instId);
  const inst = getUserById(instId);
  setText('mATit', 'Atribuir turmas a ' + (inst ? inst.nome : 'instrutor'));

  const cont = tryById('mATurmas');
  if (cont === null) return;
  const turmas = getTurmas()
    .filter((t) => t.unidadeId === uid())
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

  if (!turmas.length) {
    cont.innerHTML = '<div class="txt2">Nenhuma turma cadastrada nesta unidade.</div>';
  } else {
    cont.innerHTML = turmas
      .map((t) => {
        const atual = t.instrutorId ? getUserById(t.instrutorId) : null;
        const checked = t.instrutorId === instId ? ' checked' : '';
        const atualTxt = atual
          ? t.instrutorId === instId
            ? 'Ja atribuida a este instrutor'
            : 'Atual: ' + esc(atual.nome)
          : 'Sem instrutor';
        return (
          '<label style="display:flex;align-items:flex-start;gap:10px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;background:var(--surface)">' +
          '<input type="checkbox" value="' +
          t.id +
          '"' +
          checked +
          ' style="margin-top:3px">' +
          '<span style="flex:1">' +
          '<strong>' +
          esc(t.nome) +
          '</strong>' +
          '<span style="display:block;font-size:.78rem;color:var(--text2);margin-top:2px">' +
          esc(t.curso || '') +
          ' - ' +
          esc(t.turno || '') +
          '</span>' +
          '<span style="display:block;font-size:.72rem;color:var(--text3);margin-top:2px">' +
          esc(atualTxt) +
          ' - ' +
          esc(labelStatus(calcStatus(t))) +
          '</span>' +
          '</span>' +
          '</label>'
        );
      })
      .join('');
  }
  fmsgHide('mAMsg');
  modalAbrir('modalAtrib');
}

/** Aplica as turmas marcadas no modal de atribuicao. */
export function salvarAtrib(): void {
  const instId = parseInt(byId<HTMLInputElement>('mAInstId').value, 10);
  const ids = Array.from(
    document.querySelectorAll<HTMLInputElement>('#mATurmas input[type="checkbox"]:checked'),
  )
    .map((i) => parseInt(i.value, 10))
    .filter(Boolean);
  if (!ids.length) {
    fmsg('mAMsg', 'erro', 'Selecione ao menos uma turma.');
    return;
  }
  ids.forEach((turmaId) => updTurma(turmaId, { instrutorId: instId }));
  toast(ids.length === 1 ? 'Turma atribuida!' : 'Turmas atribuidas!', 'ok');
  modalFechar('modalAtrib');
  rdInstrutores();
  rdTurmas();
}

// ---------------------------------------------------------------------------
// Mapa de salas
// ---------------------------------------------------------------------------

interface PeriodoMapa {
  turno: string;
  turmaNome: string;
  instNome: string;
  stat: string;
  hora: string;
}

interface InfoSala {
  stat: string;
  periodos: PeriodoMapa[];
  turnosOcupados: string[];
  turnoAtivo: string;
  turmaNome: string;
  instNome: string;
  override: OverrideSala | null;
}

/** Occupacao de uma sala; o override manual definido tem precedencia. */
function calcSalaStatus(s: ReturnType<typeof getSalaById>, hj: string, turnoFiltro: string): InfoSala {
  if (!s) {
    return {
      stat: 'livre',
      periodos: [],
      turnosOcupados: [],
      turnoAtivo: '',
      turmaNome: '',
      instNome: '',
      override: null,
    };
  }
  const ov = getOverride(s.id, s.unidadeId);
  if (ov) {
    return {
      stat: ov.status,
      periodos:
        ov.status !== 'livre'
          ? [
              {
                turno: 'Manual',
                turmaNome: ov.motivo || 'Status manual',
                instNome: ov.por || '',
                stat: ov.status,
                hora: '',
              },
            ]
          : [],
      turnosOcupados: ov.status !== 'livre' ? ['Manual'] : [],
      turnoAtivo: ov.status !== 'livre' ? 'Manual' : '',
      turmaNome: ov.motivo || '',
      instNome: ov.por || '',
      override: ov,
    };
  }

  const rs = getReservas().filter(
    (r) =>
      r.salaId === s.id &&
      r.unidadeId === s.unidadeId &&
      r.dataInicio !== undefined &&
      r.dataFim !== undefined &&
      r.dataInicio <= hj &&
      r.dataFim >= hj &&
      r.status !== 'CANCELADA',
  );
  const p = hj.split('-').map(Number);
  const diaSem = (['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as DiaSemana[])[
    new Date(p[0], p[1] - 1, p[2]).getDay()
  ];

  const periodos: PeriodoMapa[] = [];
  const turnosOcupados: string[] = [];
  rs.forEach((r) => {
    if (turnoFiltro && r.turno !== turnoFiltro) return;
    const temDatasEspecificas =
      Array.isArray(r.datasEspecificas) && r.datasEspecificas.length > 0;
    if (temDatasEspecificas) {
      if ((r.datasEspecificas as string[]).indexOf(hj) === -1) return;
    } else if (!Array.isArray(r.diasSemana) || !r.diasSemana.includes(diaSem)) {
      return;
    }

    let pStat: string;
    let pTurma: string;
    let pInst: string;
    if (r.avulsa || !r.turmaId) {
      pStat = 'ocupada';
      pTurma = 'Sem turma';
      const iA = r.instrutorId ? getUserById(r.instrutorId) : null;
      pInst = iA ? iA.nome : '—';
    } else {
      const turma = getTurmaById(r.turmaId);
      const cst = turma ? calcStatus(turma) : 'encerrada';
      if (cst === 'encerrada') return;
      pStat = cst === 'ativa' ? 'ocupada' : 'iminente';
      pTurma = turma ? turma.nome : '—';
      const iT = r.instrutorId
        ? getUserById(r.instrutorId)
        : turma && turma.instrutorId
          ? getUserById(turma.instrutorId)
          : null;
      pInst = iT ? iT.nome : '';
    }
    const pHora = r.horaInicio && r.horaFim ? r.horaInicio + ' – ' + r.horaFim : '';

    const jaExiste = periodos.some(
      (x) => x.turno === r.turno && x.turmaNome === pTurma && x.instNome === pInst,
    );
    if (!jaExiste) {
      periodos.push({ turno: r.turno, turmaNome: pTurma, instNome: pInst, stat: pStat, hora: pHora });
    }
    if (!turnosOcupados.includes(String(r.turno))) turnosOcupados.push(String(r.turno));
  });

  let stat = 'livre';
  if (periodos.some((x) => x.stat === 'ocupada')) stat = 'ocupada';
  else if (periodos.length > 0) stat = 'iminente';

  return {
    stat,
    periodos,
    turnosOcupados,
    turnoAtivo: periodos.length ? periodos[0].turno : '',
    turmaNome: periodos.length ? periodos[0].turmaNome : '',
    instNome: periodos.length ? periodos[0].instNome : '',
    override: null,
  };
}

const ICONE_STATUS: Record<string, string> = {
  livre: '<span class="ic-dot ic-livre"></span>',
  ocupada: '<span class="ic-dot ic-ocupada"></span>',
  iminente: '<span class="ic-dot ic-iminente"></span>',
};

/** Card visual de uma sala no mapa, com a barra de override manual. */
function buildSalaCard(s: NonNullable<ReturnType<typeof getSalaById>>, info: InfoSala): string {
  const statusIcon = ICONE_STATUS[info.stat] ?? ICONE_STATUS.livre;
  const turnos = (s.turnos ?? s.turnosDisponiveis ?? []) as Turno[];

  const turnosHtml = turnos
    .map((t) => {
      const per = info.periodos ? info.periodos.find((p) => p.turno === t) : null;
      const cls = 'mapa-turno' + (per ? (per.stat === 'ocupada' ? ' ocupado' : ' iminente-turno') : '');
      return (
        '<span class="' +
        cls +
        '" title="' +
        (per ? esc(per.turmaNome) : 'Livre') +
        '">' +
        String(t).charAt(0) +
        '</span>'
      );
    })
    .join('');

  let ocupHtml = '';
  if (info.periodos && info.periodos.length) {
    ocupHtml = '<div class="sc-ocupacao">';
    if (info.override) {
      ocupHtml +=
        '<div class="sc-periodo sc-override">' +
        '<span class="sc-periodo-turno ' +
        (info.stat === 'ocupada' ? 'ocp' : 'imi') +
        '"><i class="ph ph-gear"></i> Manual</span>' +
        '<div class="sc-turma">' +
        esc(info.override.motivo || 'Status manual') +
        '</div>' +
        '<div class="sc-inst">por ' +
        esc(info.override.por) +
        '</div>' +
        '</div>';
    } else {
      info.periodos.forEach((per) => {
        const ic =
          per.stat === 'ocupada'
            ? '<span class="ic-dot ic-ocupada"></span>'
            : '<span class="ic-dot ic-iminente"></span>';
        ocupHtml +=
          '<div class="sc-periodo">' +
          '<span class="sc-periodo-turno ' +
          (per.stat === 'ocupada' ? 'ocp' : 'imi') +
          '">' +
          ic +
          ' ' +
          esc(per.turno) +
          '</span>' +
          '<div class="sc-turma">' +
          (per.turmaNome && per.turmaNome !== 'Sem turma'
            ? '<i class="ph ph-books"></i> ' + esc(per.turmaNome)
            : '<span class="bdg bdg-amber" style="font-size:.65rem">Sem turma</span>') +
          '</div>' +
          (per.instNome
            ? '<div class="sc-inst"><i class="ph ph-user"></i> ' + esc(per.instNome) + '</div>'
            : '') +
          (per.hora ? '<div class="sc-inst"><i class="ph ph-clock"></i> ' + esc(per.hora) + '</div>' : '') +
          '</div>';
      });
    }
    ocupHtml += '</div>';
  } else {
    ocupHtml = `<div class="sc-livre-label">${statusIcon} Disponível</div>`;
  }

  const sid = s.id;
  const ovU = s.unidadeId || uid();
  const ovOcup = info.stat === 'ocupada' ? 'ov-active' : '';
  const ovIminn = info.stat === 'iminente' ? 'ov-active' : '';
  const ovLivre = info.stat === 'livre' && !info.override ? 'ov-active' : '';
  const ovBtn =
    '<div class="sc-override-bar">' +
    '<button class="sc-ov-btn ' +
    ovOcup +
    '"  data-sid="' +
    sid +
    '" data-uid="' +
    ovU +
    '" data-st="ocupada"   data-action="ovClick" title="Marcar como Ocupada"><span class="ic-dot ic-ocupada"></span></button>' +
    '<button class="sc-ov-btn ' +
    ovIminn +
    '" data-sid="' +
    sid +
    '" data-uid="' +
    ovU +
    '" data-st="iminente" data-action="ovClick" title="Marcar como Em Breve"><span class="ic-dot ic-iminente"></span></button>' +
    '<button class="sc-ov-btn ' +
    ovLivre +
    '" data-sid="' +
    sid +
    '" data-uid="' +
    ovU +
    '" data-st="livre"     data-action="ovClick" title="Marcar como Livre"><span class="ic-dot ic-livre"></span></button>' +
    (info.override
      ? '<button class="sc-ov-btn sc-ov-auto" data-sid="' +
        sid +
        '" data-uid="' +
        ovU +
        '" data-st="auto" data-action="ovClick" title="Voltar ao automático"><i class="ph ph-arrows-clockwise"></i> Auto</button>'
      : '') +
    '</div>';

  return (
    '<div class="sala-card-v2 ' +
    info.stat +
    (info.override ? ' has-override' : '') +
    '">' +
    '<div class="sc-header">' +
    '<div class="sc-nome">' +
    esc(s.nome) +
    (info.override ? '<span class="sc-ov-tag"><i class="ph ph-gear"></i></span>' : '') +
    '</div>' +
    '<div class="sc-status-dot ' +
    info.stat +
    '"></div>' +
    '</div>' +
    '<div class="sc-tipo">' +
    esc(s.tipo) +
    '</div>' +
    '<div class="sc-meta">' +
    '<div class="sc-meta-item" title="Andar"><span class="sc-meta-icon"><i class="ph ph-buildings"></i></span>' +
    esc(s.andar || '—') +
    '</div>' +
    '<div class="sc-meta-item" title="Bloco"><span class="sc-meta-icon"><i class="ph ph-map-pin"></i></span>' +
    esc(s.bloco || '—') +
    '</div>' +
    '<div class="sc-meta-item" title="Capacidade"><span class="sc-meta-icon"><i class="ph ph-users"></i></span>' +
    s.capacidade +
    ' pess.</div>' +
    '</div>' +
    '<div class="sc-turnos">' +
    turnosHtml +
    '</div>' +
    ocupHtml +
    ovBtn +
    '</div>'
  );
}

/** Handler dos botoes de override manual do mapa. */
export function ovClick(btn: HTMLElement): void {
  const salaId = parseInt(btn.getAttribute('data-sid') || '', 10);
  const unidadeId = parseInt(btn.getAttribute('data-uid') || '', 10);
  const status = btn.getAttribute('data-st') || '';
  aplicarOverride(salaId, unidadeId, status as StatusManualSala | 'auto');
}

function aplicarOverride(salaId: number, unidadeId: number, status: StatusManualSala | 'auto'): void {
  let motivo = '';
  if (status === 'ocupada' || status === 'iminente') {
    const resposta = prompt(
      status === 'ocupada' ? 'Motivo da ocupação manual:' : 'Motivo para "Em Breve":',
      status === 'ocupada' ? 'Em uso — fora do horário regular' : 'Preparação de evento',
    );
    if (resposta === null) return;
    motivo = resposta;
  }
  const s = getSessao();
  setOverride(
    salaId,
    unidadeId,
    status === 'auto' ? null : status,
    motivo,
    s ? s.nome : '—',
  );
  rdMapa();
}

/**
 * Detecta conflito de reserva reaproveitando a regra unica do dashboard.
 *
 * Correcao: no legado esta funcao delegava para `verificarConflito`, definida
 * em `reservas.js`, arquivo que **nao** era carregado por `coordenador.html`.
 * O `typeof verificarConflito === 'function'` era portanto sempre falso e a
 * verificacao de conflito estava silenciosamente desativada nesta pagina.
 */
function checarConflito(
  salaId: number,
  turno: string,
  dias: DiaSemana[],
  dataInicio: string,
  dataFim: string,
  ignorarId: number | null,
): string | null {
  const nova: ReservaCandidata = { salaId, turno, diasSemana: dias, dataInicio, dataFim };
  return verificarConflito(nova, ignorarId || null);
}

/** Renderiza os cards do mapa de salas agrupados por bloco e andar. */
export function rdMapa(): void {
  const salas = getSalasByUnidade(uid() as number);
  const cont = tryById('mapaSalas');
  if (cont === null) return;
  if (!salas.length) {
    cont.innerHTML =
      '<p class="txt2">Nenhuma sala cadastrada. Vá em Salas para cadastrar.</p>';
    return;
  }
  const hj = hojeISO();

  const filtTurno = tryById<HTMLSelectElement>('mapaFiltTurno')?.value ?? '';
  const filtBloco = tryById<HTMLSelectElement>('mapaFiltBloco')?.value ?? '';
  const filtAndar = tryById<HTMLSelectElement>('mapaFiltAndar')?.value ?? '';
  const filtStatus = tryById<HTMLSelectElement>('mapaFiltStatus')?.value ?? '';
  const buscaNome =
    tryById<HTMLInputElement>('mapaBusca')?.value.toLowerCase().trim() ?? '';

  let salasFiltradas = salas.filter((s) => {
    if (
      buscaNome &&
      !String(s.nome).toLowerCase().includes(buscaNome) &&
      !String(s.tipo).toLowerCase().includes(buscaNome)
    ) {
      return false;
    }
    if (filtBloco && (s.bloco || '') !== filtBloco) return false;
    if (filtAndar && (s.andar || '') !== filtAndar) return false;
    if (filtTurno && !(s.turnos ?? s.turnosDisponiveis ?? []).includes(filtTurno as Turno)) {
      return false;
    }
    return true;
  });

  const infoMap: Record<number, InfoSala> = {};
  salasFiltradas.forEach((s) => {
    infoMap[s.id] = calcSalaStatus(s, hj, filtTurno);
  });
  if (filtStatus) {
    salasFiltradas = salasFiltradas.filter((s) => infoMap[s.id].stat === filtStatus);
  }

  const total = salasFiltradas.length;
  const livres = salasFiltradas.filter((s) => infoMap[s.id].stat === 'livre').length;
  const ocupadas = salasFiltradas.filter((s) => infoMap[s.id].stat === 'ocupada').length;
  const iminentes = salasFiltradas.filter((s) => infoMap[s.id].stat === 'iminente').length;
  const legEl = tryById('mapaLegenda');
  if (legEl !== null) {
    legEl.innerHTML =
      `<span class="leg-item livre"><span class="ic-dot ic-livre"></span> Livre: ${livres}</span>` +
      `<span class="leg-item ocupada"><span class="ic-dot ic-ocupada"></span> Ocupada: ${ocupadas}</span>` +
      `<span class="leg-item iminente"><span class="ic-dot ic-iminente"></span> Em breve: ${iminentes}</span>` +
      `<span class="leg-total">Total: ${total} sala(s)</span>`;
  }

  if (!salasFiltradas.length) {
    cont.innerHTML =
      '<p class="txt2" style="padding:24px">Nenhuma sala encontrada com esses filtros.</p>';
    rdMapaFuturas();
    return;
  }

  const grupos: Record<string, Record<string, typeof salas>> = {};
  salasFiltradas.forEach((s) => {
    const bloco = s.bloco || 'Sem Bloco';
    const andar = s.andar || 'Sem Andar';
    if (!grupos[bloco]) grupos[bloco] = {};
    if (!grupos[bloco][andar]) grupos[bloco][andar] = [];
    grupos[bloco][andar].push(s);
  });

  const html: string[] = [];
  Object.keys(grupos)
    .sort()
    .forEach((bloco) => {
      html.push('<div class="mapa-bloco">');
      html.push(
        '<div class="mapa-bloco-titulo"><i class="ph ph-map-pin"></i> ' + esc(bloco) + '</div>',
      );
      Object.keys(grupos[bloco])
        .sort()
        .forEach((andar) => {
          html.push('<div class="mapa-andar">');
          html.push(
            '<div class="mapa-andar-titulo"><i class="ph ph-buildings"></i> ' +
              esc(andar) +
              '</div>',
          );
          html.push('<div class="mapa-andar-grid">');
          grupos[bloco][andar].forEach((s) => {
            html.push(buildSalaCard(s, infoMap[s.id]));
          });
          html.push('</div></div>');
        });
      html.push('</div>');
    });

  cont.innerHTML = html.join('');
  rdMapaFuturas();
}

/** Tabela de reservas futuras (14 dias) + solicitacoes aprovadas. */
function rdMapaFuturas(): void {
  const tb = tryById('tbFuturasCoord');
  if (tb === null) return;
  const hj = hojeISO();
  const hoje14 = new Date();
  hoje14.setDate(hoje14.getDate() + 14);
  const fim14 = hoje14.toISOString().split('T')[0];

  const fut = getReservas()
    .filter((r) => r.unidadeId === uid() && String(r.dataFim) >= hj && String(r.dataInicio) <= fim14)
    .sort((a, b) => String(a.dataInicio).localeCompare(String(b.dataInicio)))
    .slice(0, 20);
  const sAprov = getSolics().filter(
    (s) =>
      s.unidadeId === uid() && s.status === 'aprovada' && String(s.data) >= hj && String(s.data) <= fim14,
  );

  if (!fut.length && !sAprov.length) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="5">Sem reservas nos próximos 14 dias.</td></tr>';
    return;
  }

  const rows: string[] = fut.map((r) => {
    const sala = getSalaById(r.salaId);
    const t = getTurmaById(r.turmaId);
    const inst = t && t.instrutorId ? getUserById(t.instrutorId) : null;
    const horario =
      r.horaInicio && r.horaFim
        ? '<div style="font-size:.72rem;color:var(--text3)"><i class="ph ph-clock"></i> ' +
          r.horaInicio +
          ' - ' +
          r.horaFim +
          '</div>'
        : '';
    return (
      '<tr><td><strong>' +
      esc(sala ? sala.nome : '—') +
      '</strong>' +
      (sala && sala.bloco
        ? '<div style="font-size:.75rem;color:var(--text3)">' +
          esc(sala.bloco) +
          ' · ' +
          esc(sala.andar || '') +
          '</div>'
        : '') +
      '</td><td class="mono">' +
      esc(t ? t.nome : '—') +
      '</td>' +
      '<td>' +
      esc(inst ? inst.nome : '—') +
      '</td>' +
      '<td style="font-size:.82rem">' +
      fmtData(r.dataInicio) +
      ' → ' +
      fmtData(r.dataFim) +
      horario +
      '</td>' +
      '<td style="font-size:.82rem">' +
      (r.diasSemana ?? []).map((d) => d.toUpperCase()).join(', ') +
      ' · ' +
      esc(r.turno) +
      '</td></tr>'
    );
  });

  sAprov.forEach((s) => {
    const sala = getSalaById(s.salaId);
    const inst = getUserById(s.instrutorId);
    const base = Array.isArray(s.turnos) && s.turnos.length
      ? s.turnos
      : s.turno
        ? [s.turno]
        : [];
    const turnos = [...new Set(base as string[])].join(', ') || '—';
    rows.push(
      '<tr style="background:var(--green-l)"><td><strong>' +
        esc(sala ? sala.nome : '—') +
        '</strong>' +
        (sala && sala.bloco
          ? '<div style="font-size:.75rem;color:var(--text3)">' +
            esc(sala.bloco) +
            ' · ' +
            esc(sala.andar || '') +
            '</div>'
          : '') +
        '</td><td class="mono"><span class="bdg bdg-green">Solicitação</span></td>' +
        '<td>' +
        esc(inst ? inst.nome : '—') +
        '</td>' +
        '<td style="font-size:.82rem">' +
        fmtData(s.data) +
        '</td>' +
        '<td style="font-size:.82rem">' +
        esc(turnos) +
        '</td></tr>',
    );
  });

  tb.innerHTML = rows.join('');
}

/** Recarrega os filtros de bloco/andar do mapa. */
function popularFiltrosMapa(): void {
  const salas = getSalasByUnidade(uid() as number);
  const blocos = [...new Set(salas.map((s) => s.bloco || '').filter(Boolean))].sort();
  const andares = [...new Set(salas.map((s) => s.andar || '').filter(Boolean))].sort();

  const selB = tryById<HTMLSelectElement>('mapaFiltBloco');
  if (selB !== null) {
    const curB = selB.value;
    selB.innerHTML =
      '<option value="">Todos os blocos</option>' +
      blocos
        .map((b) => `<option${b === curB ? ' selected' : ''}>${esc(b)}</option>`)
        .join('');
  }
  const selA = tryById<HTMLSelectElement>('mapaFiltAndar');
  if (selA !== null) {
    const curA = selA.value;
    selA.innerHTML =
      '<option value="">Todos os andares</option>' +
      andares
        .map((a) => `<option${a === curA ? ' selected' : ''}>${esc(a)}</option>`)
        .join('');
  }
}

// ---------------------------------------------------------------------------
// Solicitacoes
// ---------------------------------------------------------------------------

/** Lista as solicitacoes da unidade (pendentes primeiro). */
export function rdSolics(): void {
  const list = getSolics()
    .filter((s) => s.unidadeId === uid())
    .slice()
    .sort((a, b) => {
      if (a.status === 'pendente' && b.status !== 'pendente') return -1;
      if (a.status !== 'pendente' && b.status === 'pendente') return 1;
      return String(b.criadaEm || '').localeCompare(String(a.criadaEm || ''));
    });

  const cont = byId('listaSolics');
  if (!list.length) {
    cont.innerHTML = '<p class="txt2">Nenhuma solicitação recebida.</p>';
    return;
  }

  cont.innerHTML = list.map((s) => cardSolic(s)).join('');
}

function cardSolic(s: Solicitacao): string {
  const sala = getSalaById(s.salaId);
  const inst = getUserById(s.instrutorId);
  const turma = s.turmaId ? getTurmaById(s.turmaId) : null;
  const base = Array.isArray(s.turnos) && s.turnos.length
    ? s.turnos
    : s.turno
      ? [s.turno]
      : [];
  const turnosStr = [...new Set(base as string[])].join(', ') || '—';
  const isPendente = s.status === 'pendente';
  const statusBadge = isPendente
    ? '<span class="bdg" style="background:var(--amber-l);color:var(--amber);border:1px solid var(--amber-d)">PENDENTE</span>'
    : `<span class="bdg ${s.status === 'aprovada' ? 'bdg-green' : 'bdg-red'}">${String(s.status).toUpperCase()}</span>`;

  let dataLabel: string;
  if (s.modo === 'periodo' || s.dataInicio !== s.dataFim) {
    dataLabel = fmtData(s.dataInicio || s.data) + ' → ' + fmtData(s.dataFim || s.data);
  } else if (s.datasEspecificas && s.datasEspecificas.length > 1) {
    dataLabel = `${s.datasEspecificas.length} data(s) específica(s)`;
  } else {
    dataLabel = fmtData(s.data || s.dataInicio);
  }

  const diasLabel =
    Array.isArray(s.diasSemana) && s.diasSemana.length
      ? s.diasSemana.map((d: string) => String(d).charAt(0).toUpperCase() + String(d).slice(1)).join(', ')
      : '';

  const horLabel = s.horaInicio && s.horaFim ? s.horaInicio + ' às ' + s.horaFim : '';
  const borda = isPendente
    ? 'var(--amber)'
    : s.status === 'aprovada'
      ? 'var(--green)'
      : 'var(--red)';

  return (
    '<div class="notif-item tipo-solicit" style="border-left:3px solid ' +
    borda +
    ';">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">' +
    '<div>' +
    '<div class="ni-title">' +
    esc(inst ? inst.nome : 'Instrutor') +
    '</div>' +
    '<div style="font-size:.75rem;color:var(--text3)">' +
    fmtDateTime(s.criadaEm) +
    '</div>' +
    '</div>' +
    statusBadge +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.82rem;margin-bottom:6px">' +
    '<div><span style="color:var(--text3)">Sala</span><br><strong>' +
    esc(sala ? sala.nome : '—') +
    '</strong>' +
    (sala
      ? '<span style="font-size:.72rem;color:var(--text3)"> · ' +
        esc(sala.bloco || '') +
        (sala.andar ? ' · ' + esc(sala.andar) : '') +
        '</span>'
      : '') +
    '</div>' +
    '<div><span style="color:var(--text3)">Data</span><br><strong>' +
    dataLabel +
    '</strong>' +
    (diasLabel
      ? '<div style="font-size:.72rem;color:var(--text3)">' + diasLabel + '</div>'
      : '') +
    '</div>' +
    '<div><span style="color:var(--text3)">Turno(s)</span><br><strong>' +
    esc(turnosStr) +
    '</strong>' +
    (horLabel
      ? '<div style="font-size:.72rem;color:var(--text3)">' + horLabel + '</div>'
      : '') +
    '</div>' +
    '<div><span style="color:var(--text3)">Turma</span><br>' +
    (turma
      ? '<strong>' +
        esc(turma.nome) +
        '</strong><div style="font-size:.72rem;color:var(--text3)">' +
        esc(turma.curso || '') +
        '</div>'
      : '<span style="color:var(--text3)">—</span>') +
    '</div>' +
    '</div>' +
    (s.motivo
      ? '<div style="font-size:.78rem;color:var(--text2);background:var(--surface2);padding:6px 10px;border-radius:6px;margin-bottom:8px"><i class="ph ph-chat-text"></i> ' +
        esc(s.motivo) +
        '</div>'
      : '') +
    (isPendente
      ? '<div style="display:flex;gap:8px;margin-top:4px">' +
        `<button class="btn btn-success btn-sm" data-action="responderSolic" data-arg="${s.id}" data-arg2="aprovada"><i class="ph ph-check"></i> Aprovar</button>` +
        `<button class="btn btn-danger btn-sm"  data-action="responderSolic" data-arg="${s.id}" data-arg2="recusada"><i class="ph ph-x"></i> Recusar</button>` +
        '</div>'
      : s.resposta
        ? '<div style="margin-top:8px;border-left:3px solid ' +
          (s.status === 'aprovada' ? 'var(--green)' : 'var(--red)') +
          ';background:var(--surface2);padding:6px 10px;border-radius:6px">' +
          '<div style="font-size:.72rem;font-weight:700;color:' +
          (s.status === 'aprovada' ? 'var(--green)' : 'var(--red)') +
          '"><i class="ph ph-chat-circle-dots"></i> Resposta do coordenador' +
          (s.respondidaEm ? ' · ' + fmtDateTime(s.respondidaEm) : '') +
          '</div>' +
          '<div style="font-size:.78rem;color:var(--text2);margin-top:2px">' +
          esc(s.resposta) +
          '</div>' +
          '</div>'
        : '') +
    '</div>'
  );
}

/** Aprova ou recusa uma solicitacao; ao aprovar cria a reserva por turno. */
export async function responderSolic(
  id: number,
  status: StatusSolicitacao,
): Promise<void> {
  const bruto = prompt(
    status === 'aprovada'
      ? 'Comentario para o instrutor (opcional):'
      : 'Motivo da recusa (opcional):',
    status === 'recusada' ? 'Sala bloqueada para manutencao.' : '',
  );
  if (bruto === null) return;
  const comentario = bruto.trim();

  document.querySelectorAll<HTMLButtonElement>(`[onclick*="responderSolic(${id}"]`).forEach((b) => {
    b.disabled = true;
    b.style.opacity = '0.5';
  });

  try {
    await updSolicAsync(id, {
      status,
      resposta: comentario || undefined,
      respondidaEm: new Date().toISOString(),
    });

    const s = getSolics().find((x) => x.id === id) ?? null;
    const inst = s ? getUserById(s.instrutorId) : null;
    const sala = s ? getSalaById(s.salaId) : null;

    if (status === 'aprovada' && s) {
      const turnos =
        Array.isArray(s.turnos) && s.turnos.length
          ? s.turnos
          : [s.turno || 'Matutino'];
      const turnosDaSala = (
        sala ? (sala.turnos ?? sala.turnosDisponiveis ?? []) : []
      ) as string[];
      const finalTurnos = turnos.filter((t) => turnosDaSala.length === 0 || turnosDaSala.includes(String(t)));
      const usarTurnos = finalTurnos.length ? finalTurnos : turnos;

      const dataIni = String(s.dataInicio || s.data);
      const dataFim = String(s.dataFim || s.data);

      let diasSemana: DiaSemana[] | null =
        Array.isArray(s.diasSemana) && s.diasSemana.length ? s.diasSemana : null;
      if (!diasSemana) {
        const p = dataIni.split('-').map(Number);
        diasSemana = [
          (['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as DiaSemana[])[
            new Date(p[0], p[1] - 1, p[2]).getDay()
          ],
        ];
      }

      const datasEsp =
        Array.isArray(s.datasEspecificas) && s.datasEspecificas.length
          ? s.datasEspecificas
          : null;
      if (datasEsp && (!Array.isArray(s.diasSemana) || !s.diasSemana.length)) {
        diasSemana = diasSemanaDeDatas(datasEsp);
      }

      for (const turno of usarTurnos) {
        const conflito = checarConflito(s.salaId, String(turno), diasSemana, dataIni, dataFim, null);
        if (!conflito) {
          await addReservaAsync({
            salaId: s.salaId,
            turmaId: s.turmaId || null,
            turno,
            diasSemana,
            dataInicio: dataIni,
            dataFim,
            datasEspecificas: datasEsp ?? undefined,
            horaInicio: s.horaInicio || null,
            horaFim: s.horaFim || null,
            instrutorId: s.instrutorId,
            reservadoPorId: sess ? sess.id : null,
            unidadeId: uid() as number,
            avulsa: !s.turmaId,
            solicId: id,
          });
        }
      }
    }

    const salaNome = sala ? sala.nome : 'a sala solicitada';
    const base = s
      ? Array.isArray(s.turnos) && s.turnos.length
        ? s.turnos
        : s.turno
          ? [s.turno]
          : []
      : [];
    const turnoStr = [...new Set(base as string[])].join(', ');
    const dataIniS = s ? String(s.dataInicio || s.data) : '';
    const dataFimS = s ? String(s.dataFim || s.data) : '';
    const dataStr =
      dataIniS === dataFimS ? fmtData(dataIniS) : `${fmtData(dataIniS)} a ${fmtData(dataFimS)}`;
    const horStr = s && s.horaInicio && s.horaFim ? ` das ${s.horaInicio} às ${s.horaFim}` : '';
    const comentarioTxt = comentario ? ` Comentário: "${comentario}"` : '';

    const [tipo, titulo, msgCorpo] =
      status === 'aprovada'
        ? [
            'aprovada',
            'Solicitação aprovada',
            `Sua solicitação de "${salaNome}" foi aprovada para ${dataStr}${horStr} (${turnoStr}). A reserva foi criada automaticamente.${comentarioTxt}`,
          ]
        : [
            'recusada',
            'Solicitação recusada',
            `Sua solicitação de "${salaNome}" para ${dataStr} (${turnoStr}) foi recusada pelo coordenador.${comentarioTxt}`,
          ];

    await addNotifAsync({
      tipo,
      titulo,
      msg: msgCorpo,
      para: 'instrutor',
      paraId: s ? s.instrutorId : null,
      unidadeId: uid(),
    });

    toast(`Solicitação ${status}!`, 'ok');
  } catch (err) {
    console.error('Erro ao responder solicitação:', err);
    toast('Erro ao processar. Tente novamente.', 'erro');
  }

  rdSolics();
  atualizarBadges();
  popularFiltrosMapa();
  rdMapa();
}

// ---------------------------------------------------------------------------
// Notificacoes e badges
// ---------------------------------------------------------------------------

const NOTIF_ICONS: Record<string, string> = {
  info: '<i class="ph ph-info"></i>',
  aviso: '<i class="ph ph-warning"></i>',
  chave: '<i class="ph ph-key"></i>',
  solicit: '<i class="ph ph-clipboard-text"></i>',
  reserva: '<i class="ph ph-calendar"></i>',
  aprovada: '<i class="ph ph-check-circle"></i>',
  recusada: '<i class="ph ph-x-circle"></i>',
  erro: '<i class="ph ph-warning-circle"></i>',
};

/** Lista as notificacoes do coordenador. */
export function rdNotifs(): void {
  const list = getNotifsPara('coordenador', uid());
  const cont = byId('listaNotifs');
  if (!list.length) {
    cont.innerHTML = '<p class="txt2">Sem notificações.</p>';
    return;
  }

  const naoLidas = list.filter((n) => !n.lida).length;
  const header =
    naoLidas > 0
      ? '<div style="display:flex;justify-content:flex-end;margin-bottom:12px">' +
        '<button class="btn btn-ghost btn-sm" data-action="marcarTodasLidasLocal">Marcar todas como lidas</button>' +
        '</div>'
      : '';

  cont.innerHTML =
    header +
    list
      .map((n) => {
        const tipo = n.tipo || 'info';
        const titulo = n.titulo || 'Notificação';
        const msg = n.msg || n.mensagem || '';
        const icone = NOTIF_ICONS[tipo] ?? NOTIF_ICONS.info;
        return (
          '<div class="notif-item tipo-' +
          tipo +
          (n.lida ? '' : ' nao-lida') +
          '">' +
          '<div style="display:flex;align-items:flex-start;gap:10px">' +
          '<span style="font-size:1.2rem;flex-shrink:0;margin-top:1px">' +
          icone +
          '</span>' +
          '<div style="flex:1">' +
          '<div class="ni-title">' +
          esc(titulo) +
          '</div>' +
          '<div class="ni-msg">' +
          esc(msg) +
          '</div>' +
          '<div class="ni-time">' +
          fmtDateTime(n.criadaEm) +
          '</div>' +
          '</div>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');

  marcarTodasLidas('coordenador', uid());
  atualizarBadges();
}

/** Marca todas as notificacoes do coordenador como lidas e re-renderiza. */
export function marcarTodasLidasLocal(): void {
  marcarTodasLidas('coordenador', uid());
  rdNotifs();
}

/** Atualiza os badges de notificacoes e solicitacoes pendentes. */
export function atualizarBadges(): void {
  const nc = countNaoLidas('coordenador', uid());
  const bn = tryById('badgeNotif');
  if (bn !== null) {
    bn.textContent = String(nc);
    bn.style.display = nc ? '' : 'none';
  }
  const sp = getSolics().filter(
    (s) => s.unidadeId === uid() && s.status === 'pendente',
  ).length;
  const bs = tryById('badgeSolic');
  if (bs !== null) {
    bs.textContent = String(sp);
    bs.style.display = sp ? '' : 'none';
  }
}
/**
 * Cancela a edicao de uma reserva e fecha o modal.
 *
 * No HTML legado isto era um `onclick` com duas sentencas encadeadas
 * (`_editReservaId=null;modalFechar('modalRes')`). O padrao `data-action` aceita
 * um nome de acao por atributo, entao as duas operacoes viraram esta funcao.
 */
export function cancelarEdicaoReserva(): void {
  editReservaId = null;
  modalFechar('modalRes');
}