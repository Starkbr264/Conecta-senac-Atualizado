/**
 * Painel do Instrutor (`instrutor.html`).
 *
 * Migrado de `_js_original/instrutor_page.js`.
 *
 * Secoes:
 *   Turmas       — turmas em que o instrutor esta designado
 *   Salas        — disponibilidade de salas e solicitar reserva
 *   Notificacoes — respostas das solicitacoes e avisos
 *   Calendario   — reservas visiveis ao instrutor
 *
 * Solicitacao de sala (modal):
 *   - Data unica, Periodo (data inicio a fim) ou Datas avulsas
 *   - Selecao de turno(s) e horario opcional
 *   - Verificacao de disponibilidade em tempo real
 *   - Vinculacao opcional a uma turma
 *
 * Observacoes sobre o legado:
 *  1. `labelStatus` era redefinido localmente com um mapa reduzido (4 status de
 *     turma). Como `htmlStatus()` so recebe `calcStatus(turma)`, os dois mapas
 *     produzem exatamente a mesma saida — a redefinicao foi removida como
 *     codigo morto.
 *  2. `rdTurmas` era sobrescrito por um wrapper que montava a barra de
 *     filtros; a versao original ficava inalcancivel. Aqui so existe a versao
 *     filtrada (que e a efetivamente executada).
 *  3. O legacy nao possuia "reservas" nem "chaves" acessiveis ao instrutor no
 *     web, apesar de o caso de uso UC-11 descrever retirada/devolucao. Nao foi
 *     inventada funcionalidade nova.
 */

import {
  addNotif,
  addSolic,
  countNaoLidas,
  getNotifsPara,
  getReservas,
  getSalaById,
  getSalasByUnidade,
  getTurmaById,
  getTurmas,
  getUserById,
  initDados,
  marcarTodasLidas,
  unidadePadrao,
  type NovaSolicitacao,
} from '../../core/storage';
import { calcStatus, esc, fmtData, fmtDateTime, hojeISO, htmlStatus } from '../../core/format';
import { modalAbrir, modalFechar, toast } from '../../core/ui';
import { getSessao } from '../../core/theme';
import { initLogo, initSidebar, requirePerfil } from '../../core/auth';
import {
  filtrarLista,
  lerFiltros,
  montarBarraPesquisaFiltros,
  type ConfigBarraFiltros,
} from '../../core/filters';
import { byId, qsa, tryById } from '../../core/dom';
import { rdCalendario } from '../calendario/calendario';
import type { DiaSemana, Sessao, Turno } from '../../types';

const TODOS_OS_TURNOS: Turno[] = ['Matutino', 'Vespertino', 'Noturno'];
const DIAS_SEMANA: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

let sess: Sessao | null = null;

/** Unidade do instrutor logado (ou `null`). */
function uid(): number | null {
  return sess ? sess.unidadeId : null;
}

/** Inicializa o painel. Deve ser chamado uma vez pelo entry da pagina. */
export async function initInstrutor(): Promise<void> {
  await initDados();
  requirePerfil('instrutor');
  sess = getSessao();
  initSidebar();
  initLogo();
  ir('turmas');
  atualizarBadge();
}

// ---------------------------------------------------------------------------
// Helpers de data (sempre em horario LOCAL, nunca via toISOString)
// ---------------------------------------------------------------------------

function dateFromIsoLocal(iso: string): Date {
  const p = (iso || '').split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

function isoFromDateLocal(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diaSemanaIso(iso: string): DiaSemana {
  return DIAS_SEMANA[dateFromIsoLocal(iso).getDay()];
}

/** Todos os dias (ISO) entre `ini` e `fim`, inclusive. */
function datasNoPeriodo(ini: string, fim: string): string[] {
  const datas: string[] = [];
  const atual = dateFromIsoLocal(ini);
  const limite = dateFromIsoLocal(fim);
  while (atual <= limite) {
    datas.push(isoFromDateLocal(atual));
    atual.setDate(atual.getDate() + 1);
  }
  return datas;
}

function diasSemanaDatas(datas: string[]): DiaSemana[] {
  return [...new Set((datas || []).map(diaSemanaIso))];
}

/** Proximo dia livre (dataFim da reserva + 1) da sala, ou `''`. */
function dataLiberacao(salaId: number, hj: string): string {
  const rs = getReservas().filter((r) => r.salaId === salaId && r.dataFim >= hj);
  if (rs.length === 0) return '';

  const maxFim = rs.reduce((acc, r) => (r.dataFim > acc ? r.dataFim : acc), hj);
  const dtFim = dateFromIsoLocal(maxFim);
  dtFim.setDate(dtFim.getDate() + 1);
  const liberacao = dtFim.toISOString().split('T')[0];
  return (
    ' <span style="color:var(--amber);font-weight:600">&mdash; Livre a partir de ' +
    fmtData(liberacao) +
    '</span>'
  );
}

// ---------------------------------------------------------------------------
// Navegacao
// ---------------------------------------------------------------------------

const META: Record<string, { t: string; s: string }> = {
  turmas: { t: 'Minhas Turmas', s: 'Turmas atribuídas a você' },
  salas: { t: 'Solicitar Sala', s: 'Solicite uma sala disponível' },
  notifs: { t: 'Notificações', s: 'Avisos e respostas' },
  calendario: {
    t: 'Calendário de Reservas',
    s: 'Visualize suas reservas por data e turno',
  },
};

/** Navega entre as secoes do painel. */
export function ir(aba: string): void {
  qsa('.pg').forEach((p) => {
    p.classList.remove('ativa');
    p.style.display = 'none';
  });
  const pg = tryById(`pg-${aba}`);
  if (pg !== null) {
    pg.classList.add('ativa');
    pg.style.display = 'block';
  }
  qsa('.sb-btn').forEach((b) => b.classList.remove('ativo'));
  const btn = tryById(`nav-${aba}`);
  if (btn !== null) btn.classList.add('ativo');

  const m = META[aba] ?? {};
  const t = tryById('tbTitle');
  if (t !== null) t.textContent = m.t ?? aba;
  const s = tryById('tbSub');
  if (s !== null) s.textContent = m.s ?? '';

  switch (aba) {
    case 'turmas':
      rdTurmas();
      break;
    case 'salas':
      rdSalas();
      break;
    case 'notifs':
      rdNotifs();
      break;
    case 'calendario':
      rdCalendario();
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Minhas turmas
// ---------------------------------------------------------------------------

const cfgTurmasInst: ConfigBarraFiltros = {
  busca: { id: 'buscarTurmaInst', placeholder: 'Pesquisar por código ou curso…' },
  filtros: [
    {
      id: 'filtStatusTI',
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

type TurmaComStatus = ReturnType<typeof getTurmas>[number] & { _status: string };

/** Lista as turmas atribuidas ao instrutor, com busca e filtro de status. */
export function rdTurmas(): void {
  const cont = tryById('searchTurmasInst');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchTurmasInst', cfgTurmasInst, renderTurmasInst);
  }
  renderTurmasInst();
}

function renderTurmasInst(): void {
  const vals = lerFiltros(cfgTurmasInst);
  let list: TurmaComStatus[] = getTurmas()
    .filter((t) => t.instrutorId === sess?.id)
    .map((t) => ({ ...t, _status: calcStatus(t) }));
  list = filtrarLista(list, vals['_busca'], ['nome', 'curso']);
  if (vals['_status']) list = list.filter((t) => t._status === vals['_status']);

  const cnt = tryById('countTurmasInst');
  if (cnt !== null) cnt.textContent = `${list.length} turma(s)`;

  const tb = byId('tbTurmas');
  if (list.length === 0) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="6">Nenhuma turma encontrada.</td></tr>';
    return;
  }
  tb.innerHTML = list.map((t) => linhaTurma(t)).join('');
}

function linhaTurma(t: TurmaComStatus): string {
  const res = getReservas().filter((r) => r.turmaId === t.id);
  const sala = res.length ? getSalaById(res[0].salaId) : null;
  return (
    '<tr><td class="mono"><strong>' +
    esc(t.nome) +
    '</strong></td><td>' +
    esc(t.curso) +
    '</td>' +
    '<td><span class="bdg bdg-primary">' +
    esc(t.turno) +
    '</span></td>' +
    '<td>' +
    esc(sala ? sala.nome : 'Sem sala reservada') +
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
}

// ---------------------------------------------------------------------------
// Disponibilidade de salas
// ---------------------------------------------------------------------------

/** Cards de salas da unidade com status de ocupacao e botao de solicitar. */
export function rdSalas(): void {
  const salas = getSalasByUnidade(uid() as number);
  const cont = byId('listaSalas');
  const hj = hojeISO();

  if (salas.length === 0) {
    cont.innerHTML = '<p class="txt2">Nenhuma sala cadastrada na unidade.</p>';
    return;
  }

  const dia = diaSemanaIso(hj);

  cont.innerHTML = salas
    .map((s) => {
      let livre = true;
      const ocupacoes: string[] = [];
      let instNome = '';

      const rs = getReservas().filter(
        (r) => r.salaId === s.id && r.dataInicio <= hj && r.dataFim >= hj,
      );
      for (const r of rs) {
        if (!r.diasSemana || !r.diasSemana.includes(dia)) continue;
        if (r.avulsa || !r.turmaId) {
          livre = false;
          ocupacoes.push(`Reservada (${r.turno})`);
          break;
        }
        const t = getTurmaById(r.turmaId);
        if (!t || calcStatus(t) === 'encerrada') continue;
        livre = false;
        const inst = t.instrutorId ? getUserById(t.instrutorId) : null;
        instNome = inst ? inst.nome : '';
        ocupacoes.push(`${r.turno}: ${t.nome}`);
      }

      const infoHtml = livre
        ? '<span style="color:var(--green);font-weight:600"><span class="ic-dot ic-livre"></span> Disponível hoje</span>'
        : `<span style="color:var(--red);font-weight:600"><span class="ic-dot ic-ocupada"></span> ${esc(ocupacoes.join(' | '))}</span>`;

      const turnosHtml = (s.turnos ?? s.turnosDisponiveis ?? [])
        .map((t) => `<span class="mapa-turno">${t[0]}</span>`)
        .join('');

      return (
        `<div class="sala-card-v2 ${livre ? 'livre' : 'ocupada'}">` +
        `<div class="sc-header"><div class="sc-nome">${esc(s.nome)}</div>` +
        `<div class="sc-status-dot ${livre ? 'livre' : 'ocupada'}"></div></div>` +
        `<div class="sc-tipo">${esc(s.tipo)}</div>` +
        '<div class="sc-meta">' +
        (s.andar
          ? `<div class="sc-meta-item"><span class="sc-meta-icon"><i class="ph ph-buildings"></i></span>${esc(s.andar)}</div>`
          : '') +
        (s.bloco
          ? `<div class="sc-meta-item"><span class="sc-meta-icon"><i class="ph ph-map-pin"></i></span>${esc(s.bloco)}</div>`
          : '') +
        `<div class="sc-meta-item"><span class="sc-meta-icon"><i class="ph ph-users"></i></span>${s.capacidade}</div>` +
        '</div>' +
        `<div class="sc-turnos">${turnosHtml}</div>` +
        `<div style="margin-top:6px;font-size:.78rem">${infoHtml}</div>` +
        (instNome
          ? `<div style="font-size:.75rem;color:var(--text2);margin-top:3px"><i class="ph ph-user"></i> ${esc(instNome)}</div>`
          : '') +
        (livre
          ? `<button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" data-action="abrirSolic" data-arg="${s.id}"><i class="ph ph-clipboard-text"></i> Solicitar Sala</button>`
          : '<div style="margin-top:8px">' +
            `<div style="font-size:.78rem;color:var(--red);font-weight:600;margin-bottom:4px"><i class="ph ph-lock"></i> Sala ocupada hoje${dataLiberacao(s.id, hj)}</div>` +
            `<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:4px" data-action="abrirSolic" data-arg="${s.id}"><i class="ph ph-calendar-plus"></i> Solicitar para outra data</button>` +
            '</div>') +
        '</div>'
      );
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Modal de solicitacao
// ---------------------------------------------------------------------------

function turnosDaSalaSolic(salaId: number): Turno[] {
  const sala = salaId ? getSalaById(salaId) : null;
  const turnos = sala ? (sala.turnos ?? sala.turnosDisponiveis ?? []) : [];
  return turnos.length ? turnos : TODOS_OS_TURNOS;
}

function mostrarErroTurno(msg: string): void {
  const erEl = tryById('slTurnoErro');
  if (erEl === null) return;
  erEl.innerHTML = '<i class="ph ph-warning-circle"></i> ' + msg;
  erEl.style.cssText =
    'display:block;color:var(--red);font-size:.82rem;margin-top:2px;font-weight:600';
}

function atualizarTurnosSolic(salaId: number, preferidos: Turno[] = []): void {
  const permitidos = turnosDaSalaSolic(salaId);
  qsa('#slTurnosChips .chip').forEach((c) => {
    const v = (c as HTMLElement).dataset['v'] ?? '';
    const permitido = permitidos.indexOf(v as Turno) !== -1;
    c.classList.toggle(
      'ativo',
      permitido && (preferidos.length ? preferidos.indexOf(v as Turno) !== -1 : true),
    );
    c.classList.toggle('disabled', !permitido);
    c.setAttribute('aria-disabled', permitido ? 'false' : 'true');
    (c as HTMLElement).style.opacity = permitido ? '' : '.38';
    (c as HTMLElement).style.cursor = permitido ? 'pointer' : 'not-allowed';
    (c as HTMLElement).title = permitido
      ? ''
      : 'Esta sala nao atende o turno ' + v;
  });
}

/** Alterna um chip de turno do modal de solicitacao. */
export function slToggleTurno(el: HTMLElement | null): void {
  if (!el) return;
  if (
    el.classList.contains('disabled') ||
    el.getAttribute('aria-disabled') === 'true'
  ) {
    mostrarErroTurno(`Esta sala nao atende o turno ${el.dataset['v']}.`);
    return;
  }
  el.classList.toggle('ativo');
  verificarDisponibilidadeSolic();
}

/** Abre o modal de solicitacao para uma sala. */
export function abrirSolic(salaId: number): void {
  byId<HTMLInputElement>('slSalaId').value = String(salaId);
  const s = getSalaById(salaId);
  byId('slNome').textContent = s ? s.nome : '';
  byId<HTMLInputElement>('slData').value = '';
  byId<HTMLInputElement>('slDataIni').value = '';
  byId<HTMLInputElement>('slDataFim').value = '';
  byId<HTMLTextAreaElement>('slMotivo').value = '';
  byId<HTMLInputElement>('slHoraIni').value = '';
  byId<HTMLInputElement>('slHoraFim').value = '';
  byId('slListaDatas').innerHTML = '';
  datasEspecificas = [];

  const turnosSala = turnosDaSalaSolic(salaId);

  const selT = byId<HTMLSelectElement>('slTurma');
  selT.innerHTML = '<option value="">— Sem turma vinculada —</option>';
  getTurmas()
    .filter(
      (t) =>
        t.instrutorId === sess?.id &&
        calcStatus(t) !== 'encerrada' &&
        turnosSala.indexOf(t.turno as Turno) !== -1,
    )
    .forEach((t) => {
      const o = document.createElement('option');
      o.value = String(t.id);
      o.textContent = (t.codigo || t.nome) + (t.curso ? ' — ' + t.curso : '');
      o.dataset['turno'] = t.turno ?? '';
      selT.appendChild(o);
    });

  atualizarTurnosSolic(salaId);
  slModoData('unica');

  const erEl = tryById('slTurnoErro');
  if (erEl !== null) erEl.style.display = 'none';
  const divDisp = tryById('slDisponibilidade');
  if (divDisp !== null) divDisp.style.display = 'none';
  modalAbrir('modalSolic');
}

/** Alterna o modo de selecao de data (unica / periodo / especificas). */
export function slModoData(modo: 'unica' | 'periodo' | 'especificas'): void {
  modoData = modo;
  const s1 = tryById('slSecaoUnica');
  const s2 = tryById('slSeaoPeriodo');
  const s3 = tryById('slSecaoEspecificas');
  const b1 = tryById('slBtnUnica');
  const b2 = tryById('slBtnPeriodo');
  const b3 = tryById('slBtnEsp');

  if (s1 !== null) s1.style.display = modo === 'unica' ? '' : 'none';
  if (s2 !== null) s2.style.display = modo === 'periodo' ? '' : 'none';
  if (s3 !== null) s3.style.display = modo === 'especificas' ? '' : 'none';

  [b1, b2, b3].forEach((b) => {
    if (b !== null) b.classList.remove('sl-tipo-ativo');
  });
  const ativo = modo === 'unica' ? b1 : modo === 'periodo' ? b2 : b3;
  if (ativo !== null) ativo.classList.add('sl-tipo-ativo');
}

// Estado do modal (o legado guardava em `window._sl*`).
let modoData: 'unica' | 'periodo' | 'especificas' = 'unica';
let datasEspecificas: string[] = [];

/** Adiciona uma data avulsa a lista de datas especificas. */
export function slAdicionarData(): void {
  const inp = tryById<HTMLInputElement>('slDataAvulsa');
  const val = inp ? inp.value : '';
  if (!val) {
    toast('Selecione uma data para adicionar.', 'aviso');
    return;
  }
  if (datasEspecificas.includes(val)) {
    toast('Data já adicionada.', 'aviso');
    return;
  }
  datasEspecificas.push(val);
  datasEspecificas.sort();
  renderDatasEspecificas();
  if (inp !== null) inp.value = '';
}

function renderDatasEspecificas(): void {
  const cont = tryById('slListaDatas');
  if (cont === null) return;
  cont.innerHTML = datasEspecificas
    .map((d) => {
      const p = d.split('-');
      const label = `${p[2]}/${p[1]}/${p[0]}`;
      return (
        '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--primary-l);color:var(--primary);border:1px solid var(--primary-d);border-radius:6px;padding:3px 8px;font-size:.78rem;font-weight:600">' +
        label +
        `<button data-action="slRemoverData" data-arg="${d}" style="background:none;border:none;cursor:pointer;color:var(--primary);font-size:.9rem;padding:0;line-height:1">&times;</button></span>`
      );
    })
    .join('');
}

/** Remove uma data da lista de datas especificas. */
export function slRemoverData(iso: string): void {
  datasEspecificas = datasEspecificas.filter((d) => d !== iso);
  renderDatasEspecificas();
}

/** Pre-preenche turno (e, no modo periodo, as datas) ao escolher uma turma. */
export function slOnTurmaChange(): void {
  const sel = byId<HTMLSelectElement>('slTurma');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;
  const turma = getTurmaById(parseInt(opt.value, 10));
  if (!turma) return;
  const salaId = parseInt(byId<HTMLInputElement>('slSalaId').value, 10);
  const turnosSala = turnosDaSalaSolic(salaId);
  if (turnosSala.indexOf(turma.turno as Turno) === -1) {
    atualizarTurnosSolic(salaId);
    mostrarErroTurno(
      `A turma e ${turma.turno}, mas esta sala atende apenas: ${turnosSala.join(', ')}.`,
    );
  } else {
    atualizarTurnosSolic(salaId, [turma.turno as Turno]);
  }

  if (modoData === 'periodo') {
    const ini = tryById<HTMLInputElement>('slDataIni');
    const fim = tryById<HTMLInputElement>('slDataFim');
    if (ini !== null && !ini.value && turma.dataInicio) ini.value = turma.dataInicio;
    if (fim !== null && !fim.value && turma.dataFim) fim.value = turma.dataFim;
  }
  verificarDisponibilidadeSolic();
}

/** Verifica disponibilidade em tempo real ao alterar data ou turno. */
export function verificarDisponibilidadeSolic(): void {
  const salaId = parseInt(byId<HTMLInputElement>('slSalaId').value, 10);
  const divDisp = tryById('slDisponibilidade');
  const erEl = tryById('slTurnoErro');
  if (divDisp === null) return;

  let data = '';
  let dataFim = '';
  let diasVerif: DiaSemana[] = [];

  if (modoData === 'unica') {
    data = byId<HTMLInputElement>('slData').value;
    dataFim = data;
    if (data) diasVerif = [diaSemanaIso(data)];
  } else if (modoData === 'periodo') {
    data = byId<HTMLInputElement>('slDataIni').value;
    dataFim = byId<HTMLInputElement>('slDataFim').value || data;
    if (data && dataFim && dataFim >= data) {
      diasVerif = diasSemanaDatas(datasNoPeriodo(data, dataFim));
    }
  } else {
    divDisp.style.display = 'none';
    return;
  }

  if (!data || !salaId || !diasVerif.length) {
    divDisp.style.display = 'none';
    return;
  }

  let turnos = turnosAtivos();
  const turnosSala = turnosDaSalaSolic(salaId);
  turnos = turnos.filter((t) => turnosSala.indexOf(t) !== -1);

  const turnosVerif = turnos.length ? turnos : turnosSala;
  const conflitos: Array<{ turno: string; lib: string }> = [];
  const livres: Turno[] = [];

  turnosVerif.forEach((turno) => {
    const rs = getReservas().filter(
      (r) =>
        r.salaId === salaId &&
        r.turno === turno &&
        r.dataInicio <= dataFim &&
        r.dataFim >= data &&
        r.diasSemana &&
        r.diasSemana.some((dia) => diasVerif.indexOf(dia) !== -1),
    );
    const ocupado = rs.some((r) => {
      const t = r.turmaId ? getTurmaById(r.turmaId) : null;
      return r.avulsa || !!(t && calcStatus(t) !== 'encerrada');
    });
    if (!ocupado) {
      livres.push(turno);
      return;
    }
    let maxFim: string | null = null;
    getReservas()
      .filter((r) => r.salaId === salaId && r.turno === turno && r.dataFim >= data)
      .forEach((r) => {
        const t = r.turmaId ? getTurmaById(r.turmaId) : null;
        if (t && calcStatus(t) === 'encerrada') return;
        if (!maxFim || r.dataFim > maxFim) maxFim = r.dataFim;
      });
    let lib = '';
    if (maxFim) {
      const dtF = dateFromIsoLocal(maxFim);
      dtF.setDate(dtF.getDate() + 1);
      lib = ` — livre a partir de <strong>${fmtData(dtF.toISOString().split('T')[0])}</strong>`;
    }
    conflitos.push({ turno, lib });
  });

  if (conflitos.length === 0 && livres.length === 0) {
    divDisp.style.display = 'none';
    return;
  }

  let html = '';
  if (conflitos.length) {
    html +=
      '<div style="color:var(--red);font-weight:600;margin-bottom:4px"><i class="ph ph-warning-circle"></i> Turno(s) ocupado(s):</div>';
    conflitos.forEach((c) => {
      html += `<div style="margin-left:8px;color:var(--text2)"><i class="ph ph-lock"></i> <strong>${esc(c.turno)}</strong>${c.lib}</div>`;
    });
  }
  if (livres.length && turnos.length) {
    html += `<div style="color:var(--green);font-weight:600;margin-top:${conflitos.length ? '8px' : '0'}"><i class="ph ph-check-circle"></i> Disponível:</div>`;
    livres.forEach((t) => {
      html += `<div style="margin-left:8px;color:var(--text2)"><i class="ph ph-check"></i> <strong>${esc(t)}</strong></div>`;
    });
  }
  divDisp.style.cssText = conflitos.length
    ? 'display:block;padding:10px 14px;border-radius:8px;font-size:.83rem;line-height:1.7;background:var(--red-l);border:1px solid rgba(220,38,38,.25)'
    : 'display:block;padding:10px 14px;border-radius:8px;font-size:.83rem;line-height:1.7;background:var(--green-l);border:1px solid rgba(5,150,105,.25)';
  divDisp.innerHTML = html;
  if (erEl !== null) erEl.style.display = 'none';
}

function turnosAtivos(): Turno[] {
  return qsa('#slTurnosChips .chip.ativo').map(
    (c) => (c as HTMLElement).dataset['v'] as Turno,
  );
}

function getTurnosSolic(): Turno[] {
  const salaId = parseInt(byId<HTMLInputElement>('slSalaId').value, 10);
  const turnosSala = turnosDaSalaSolic(salaId);
  return turnosAtivos().filter((t) => turnosSala.indexOf(t) !== -1);
}

/** Valida e envia a solicitacao de sala. */
export function enviarSolic(): void {
  const salaId = parseInt(byId<HTMLInputElement>('slSalaId').value, 10);
  const turnos = [...new Set(getTurnosSolic())];
  const motivo = byId<HTMLTextAreaElement>('slMotivo').value.trim();
  const erEl = tryById('slTurnoErro');
  const horaIni = byId<HTMLInputElement>('slHoraIni').value.trim();
  const horaFim = byId<HTMLInputElement>('slHoraFim').value.trim();
  const turmaId =
    parseInt(byId<HTMLSelectElement>('slTurma').value, 10) || null;
  const turnosSala = turnosDaSalaSolic(salaId);
  const turmaSel = turmaId ? getTurmaById(turmaId) : null;

  let datasParaEnviar: string[];
  let dataIniGlobal = '';
  let dataFimGlobal = '';

  if (modoData === 'unica') {
    const d = byId<HTMLInputElement>('slData').value;
    if (!d) {
      toast('Selecione uma data.', 'aviso');
      return;
    }
    datasParaEnviar = [d];
    dataIniGlobal = d;
    dataFimGlobal = d;
  } else if (modoData === 'periodo') {
    dataIniGlobal = byId<HTMLInputElement>('slDataIni').value;
    dataFimGlobal = byId<HTMLInputElement>('slDataFim').value;
    if (!dataIniGlobal || !dataFimGlobal) {
      toast('Informe data de início e fim.', 'aviso');
      return;
    }
    if (dataFimGlobal < dataIniGlobal) {
      toast('A data fim deve ser após a data início.', 'aviso');
      return;
    }
    datasParaEnviar = datasNoPeriodo(dataIniGlobal, dataFimGlobal);
  } else {
    if (datasEspecificas.length === 0) {
      toast('Adicione ao menos uma data.', 'aviso');
      return;
    }
    datasParaEnviar = datasEspecificas;
    dataIniGlobal = datasParaEnviar[0];
    dataFimGlobal = datasParaEnviar[datasParaEnviar.length - 1];
  }

  const diasSel = diasSemanaDatas(datasParaEnviar);

  if (turnos.length === 0) {
    if (erEl !== null) {
      mostrarErroTurno('Selecione ao menos um turno disponivel para esta sala.');
    }
    return;
  }
  if (erEl !== null) erEl.style.display = 'none';

  const invalidos = turnos.filter((t) => turnosSala.indexOf(t) === -1);
  if (invalidos.length) {
    mostrarErroTurno('Esta sala atende apenas: ' + turnosSala.join(', ') + '.');
    return;
  }
  if (turmaSel && turnosSala.indexOf(turmaSel.turno as Turno) === -1) {
    mostrarErroTurno(
      `A turma selecionada e ${turmaSel.turno}, mas esta sala atende apenas: ${turnosSala.join(', ')}.`,
    );
    return;
  }
  if (turmaSel && turnos.indexOf(turmaSel.turno as Turno) === -1) {
    mostrarErroTurno('Selecione o turno da turma vinculada: ' + turmaSel.turno + '.');
    return;
  }

  // Deteccao de conflito: no modo periodo, um unico dia da semana em comum ja
  // bloqueia; nos demais modos, data a data.
  let conflitou = false;
  if (modoData === 'periodo') {
    turnos.forEach((turno) => {
      getReservas()
        .filter(
          (r) =>
            r.salaId === salaId &&
            r.turno === turno &&
            r.dataInicio <= dataFimGlobal &&
            r.dataFim >= dataIniGlobal &&
            r.diasSemana &&
            r.diasSemana.some((dia) => diasSel.indexOf(dia) !== -1),
        )
        .forEach((r) => {
          const t = r.turmaId ? getTurmaById(r.turmaId) : null;
          if (r.avulsa || (t && calcStatus(t) !== 'encerrada')) conflitou = true;
        });
    });
  } else {
    datasParaEnviar.forEach((data) => {
      const diaSem = diaSemanaIso(data);
      turnos.forEach((turno) => {
        getReservas()
          .filter(
            (r) =>
              r.salaId === salaId &&
              r.turno === turno &&
              r.dataInicio <= data &&
              r.dataFim >= data &&
              r.diasSemana &&
              r.diasSemana.includes(diaSem),
          )
          .forEach((r) => {
            const t = r.turmaId ? getTurmaById(r.turmaId) : null;
            if (r.avulsa || (t && calcStatus(t) !== 'encerrada')) conflitou = true;
          });
      });
    });
  }

  if (conflitou) {
    if (erEl !== null) {
      erEl.innerHTML =
        '<i class="ph ph-warning"></i> Sala já reservada em um dos períodos selecionados.';
      erEl.style.display = 'block';
    }
    return;
  }

  // O legado gravava `null` (e nao ausencia da chave) em `diasSemana` e
  // `datasEspecificas`; o cast preserva exatamente esse formato persistido.
  const payload = {
    salaId,
    instrutorId: sess?.id ?? null,
    turmaId,
    data: dataIniGlobal,
    dataInicio: dataIniGlobal,
    dataFim: dataFimGlobal,
    datasEspecificas: modoData === 'especificas' ? datasParaEnviar : null,
    diasSemana: diasSel.length ? diasSel : null,
    turnos,
    turno: turnos[0],
    horaInicio: horaIni,
    horaFim: horaFim,
    motivo,
    unidadeId: unidadePadrao(),
    modo: modoData,
  } as unknown as NovaSolicitacao;

  addSolic(payload);

  const sala = getSalaById(salaId);
  const horario = horaIni && horaFim ? ` das ${horaIni} às ${horaFim}` : '';
  addNotif({
    paraPerfil: 'coordenador',
    unidadeId: unidadePadrao(),
    tipo: 'solic',
    titulo: 'Nova Solicitação de Sala',
    msg:
      `${sess?.nome ?? ''} solicitou a sala "${sala ? sala.nome : '?'}"` +
      ` em ${fmtData(dataIniGlobal)}` +
      (modoData === 'periodo' ? ` até ${fmtData(dataFimGlobal)}` : '') +
      (modoData === 'especificas' ? ` (${datasParaEnviar.length} data(s))` : '') +
      `${horario}.`,
  });

  toast('Solicitação enviada! Aguarde aprovação.', 'ok');
  modalFechar('modalSolic');
}

// ---------------------------------------------------------------------------
// Notificacoes
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

/** Lista as notificacoes do instrutor e marca tudo como lida. */
export function rdNotifs(): void {
  const list = getNotifsPara('instrutor', uid()).filter(
    (n) => !n.paraId || n.paraId === sess?.id || n.paraId === uid(),
  );
  const cont = byId('listaNotifs');
  if (list.length === 0) {
    cont.innerHTML = '<p class="txt2">Sem notificações.</p>';
    return;
  }
  cont.innerHTML = list
    .map((n) => {
      const tipo = n.tipo ?? 'info';
      const titulo = n.titulo ?? 'Notificação';
      const msg = n.msg ?? n.mensagem ?? '';
      const icone = NOTIF_ICONS[tipo] ?? NOTIF_ICONS['info'] as string;
      return (
        `<div class="notif-item tipo-${tipo}${n.lida ? '' : ' nao-lida'}">` +
        '<div style="display:flex;align-items:flex-start;gap:10px">' +
        `<span style="font-size:1.2rem;flex-shrink:0;margin-top:1px">${icone}</span>` +
        '<div style="flex:1">' +
        `<div class="ni-title">${esc(titulo)}</div>` +
        `<div class="ni-msg">${esc(msg)}</div>` +
        `<div class="ni-time">${fmtDateTime(n.criadaEm)}</div>` +
        '</div></div></div>'
      );
    })
    .join('');
  marcarTodasLidas('instrutor', uid());
  atualizarBadge();
}

/** Atualiza o contador de notificacoes nao lidas da sidebar. */
export function atualizarBadge(): void {
  const n = countNaoLidas('instrutor', uid());
  const b = tryById('badgeNotif');
  if (b !== null) {
    b.textContent = String(n);
    b.style.display = n ? '' : 'none';
  }
}

/*
 * Nota: o legado tambem tinha `_dataLiberacaoPorTurnos()`, que nunca era
 * chamado por nenhuma pagina. Foi removido como codigo morto.
 */