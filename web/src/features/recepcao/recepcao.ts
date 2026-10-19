/**
 * Painel da Recepcao (`recepcao.html`).
 *
 * Migrado de `_js_original/recepcao_page.js`.
 *
 * Secoes:
 *   Mapa de Salas  — visualizacao somente leitura da ocupacao atual
 *   Chaves         — atribuicao e devolucao de chaves para instrutores
 *   Notificacoes   — avisos recebidos
 *   Calendario     — calendario de reservas da unidade
 *
 * A recepcao nao pode alterar o status das salas no mapa
 * (apenas visualiza). O controle de chaves e exclusivo da recepcao.
 */

import {
  addChave,
  addNotifAsync,
  countNaoLidas,
  delChave,
  devolverChaveAsync,
  getChaveById,
  getChaves,
  getNotifsPara,
  getOverride,
  getReservas,
  getSalaById,
  getSalasByUnidade,
  getTurmaById,
  getUserById,
  getUsersByPerfil,
  initDados,
  marcarTodasLidas,
  retirarChaveAsync,
  updChave,
  type NovaChave,
  type OverrideSala,
} from '../../core/storage';
import { calcStatus, esc, fmtData, fmtDateTime, hojeISO } from '../../core/format';
import { modalAbrir, modalFechar, toast } from '../../core/ui';
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
import type { Chave, DiaSemana, Sala, Sessao, Turno } from '../../types';

let sess: Sessao | null = null;

/** Inicializa o painel. Deve ser chamado uma vez pelo entry da pagina. */
export async function initRecepcao(): Promise<void> {
  await initDados();
  requirePerfil('recepcao');
  sess = getSessao();
  initSidebar();
  initLogo();
  ir('mapa');
  atualizarBadge();
}

function uid(): number | null {
  return sess ? sess.unidadeId : null;
}

// ---------------------------------------------------------------------------
// Navegacao
// ---------------------------------------------------------------------------

const META: Record<string, { t: string; s: string }> = {
  mapa: { t: 'Mapa de Salas', s: 'Visualizar ocupação e guiar instrutores' },
  chaves: { t: 'Chaves', s: 'Criar e controlar chaves das salas' },
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

  if (aba === 'mapa') rdMapa();
  if (aba === 'chaves') rdChaves();
  if (aba === 'notifs') rdNotifs();
  if (aba === 'calendario') rdCalendario();
}

function setText(id: string, valor: string): void {
  const el = tryById(id);
  if (el !== null) el.textContent = valor;
}

// ---------------------------------------------------------------------------
// Mapa de salas — visualizacao somente leitura
// ---------------------------------------------------------------------------

interface PeriodoMapa {
  turno: string;
  turmaNome: string;
  instNome: string;
  stat: string;
}

interface InfoSala {
  stat: string;
  override: OverrideSala | null;
  periodos: PeriodoMapa[];
  turnosOcupados: string[];
  turnoAtivo: string;
  turmaNome: string;
  instNome: string;
}

/**
 * Calcula a ocupacao de uma sala na data informada.
 * `statusManual` definido pelo coordenador tem precedencia sobre o calculo.
 */
function calcSalaStatus(s: Sala, hj: string): InfoSala {
  const ov = getOverride(s.id, s.unidadeId);
  if (ov) {
    const manual = ov.status !== 'livre';
    return {
      stat: ov.status,
      override: ov,
      periodos: manual
        ? [
            {
              turno: 'Manual',
              turmaNome: ov.motivo || 'Status manual',
              instNome: ov.por || '',
              stat: ov.status,
            },
          ]
        : [],
      turnosOcupados: manual ? ['Manual'] : [],
      turnoAtivo: manual ? 'Manual' : '',
      turmaNome: ov.motivo || '',
      instNome: ov.por || '',
    };
  }

  const rs = getReservas().filter(
    (r) => r.salaId === s.id && r.dataInicio <= hj && r.dataFim >= hj,
  );
  const p = hj.split('-').map(Number);
  const dia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][
    new Date(p[0], p[1] - 1, p[2]).getDay()
  ];

  const periodos: PeriodoMapa[] = [];
  const turnosOcupados: string[] = [];
  rs.forEach((r) => {
    if (!(r.diasSemana ?? []).includes(dia as DiaSemana)) return;
    let pStat: string;
    let pTurma: string;
    let pInst: string;
    if (r.avulsa || !r.turmaId) {
      pStat = 'ocupada';
      pTurma = 'Sem turma';
      const iA = r.instrutorId ? getUserById(r.instrutorId) : null;
      pInst = iA ? iA.nome : '—';
    } else {
      const t = getTurmaById(r.turmaId);
      const cst = t ? calcStatus(t) : 'encerrada';
      if (cst === 'encerrada') return;
      pStat = cst === 'ativa' ? 'ocupada' : 'iminente';
      pTurma = t ? t.nome : '—';
      const inst = t && t.instrutorId ? getUserById(t.instrutorId) : null;
      pInst = inst ? inst.nome : '';
    }
    periodos.push({ turno: r.turno, turmaNome: pTurma, instNome: pInst, stat: pStat });
    if (!turnosOcupados.includes(r.turno)) turnosOcupados.push(r.turno);
  });

  let stat = 'livre';
  if (periodos.some((x) => x.stat === 'ocupada')) stat = 'ocupada';
  else if (periodos.length > 0) stat = 'iminente';

  return {
    stat,
    periodos,
    turnosOcupados,
    override: null,
    turnoAtivo: periodos.length ? periodos[0].turno : '',
    turmaNome: periodos.length ? periodos[0].turmaNome : '',
    instNome: periodos.length ? periodos[0].instNome : '',
  };
}

const ICONE_STATUS: Record<string, string> = {
  livre: '<span class="ic-dot ic-livre"></span>',
  ocupada: '<span class="ic-dot ic-ocupada"></span>',
  iminente: '<span class="ic-dot ic-iminente"></span>',
};

function buildSalaCard(s: Sala, info: InfoSala): string {
  const statusIcon = ICONE_STATUS[info.stat] ?? ICONE_STATUS.livre;
  const turnos = s.turnos ?? s.turnosDisponiveis ?? [];

  const turnosHtml = turnos
    .map((t) => {
      const per = info.periodos
        ? info.periodos.find((x) => x.turno === t)
        : null;
      let cls = 'mapa-turno';
      if (per) cls += per.stat === 'ocupada' ? ' ocupado' : ' iminente-turno';
      return (
        '<span class="' +
        cls +
        '" title="' +
        (per ? esc(per.turmaNome) : 'Livre') +
        '">' +
        t.charAt(0) +
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
        '"><i class="ph ph-gear"></i>️ Manual</span>' +
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
          '<div class="sc-turma"><i class="ph ph-books"></i> ' +
          esc(per.turmaNome) +
          '</div>' +
          (per.instNome
            ? '<div class="sc-inst"><i class="ph ph-user"></i> ' +
              esc(per.instNome) +
              '</div>'
            : '') +
          '</div>';
      });
    }
    ocupHtml += '</div>';
  } else {
    ocupHtml = '<div class="sc-livre-label">' + statusIcon + ' Disponível</div>';
  }

  return (
    '<div class="sala-card-v2 ' +
    info.stat +
    '">' +
    '<div class="sc-header"><div class="sc-nome">' +
    esc(s.nome) +
    '</div>' +
    '<div class="sc-status-dot ' +
    info.stat +
    '"></div></div>' +
    '<div class="sc-tipo">' +
    esc(s.tipo) +
    '</div>' +
    '<div class="sc-meta">' +
    '<div class="sc-meta-item"><span class="sc-meta-icon"><i class="ph ph-buildings"></i></span>' +
    esc(s.andar || '—') +
    '</div>' +
    '<div class="sc-meta-item"><span class="sc-meta-icon"><i class="ph ph-map-pin"></i></span>' +
    esc(s.bloco || '—') +
    '</div>' +
    '<div class="sc-meta-item"><span class="sc-meta-icon"><i class="ph ph-users"></i></span>' +
    s.capacidade +
    '</div>' +
    '</div>' +
    '<div class="sc-turnos">' +
    turnosHtml +
    '</div>' +
    ocupHtml +
    '</div>'
  );
}

/** Recarrega os filtros de bloco/andar a partir das salas da unidade. */
function popularFiltrosMapa(): void {
  const salas = getSalasByUnidade(uid() as number);
  const blocos = [...new Set(salas.map((s) => s.bloco || '').filter(Boolean))].sort();
  const andares = [...new Set(salas.map((s) => s.andar || '').filter(Boolean))].sort();

  const selB = tryById<HTMLSelectElement>('mapaRecFiltBloco');
  if (selB !== null) {
    const curB = selB.value;
    selB.innerHTML =
      '<option value="">Todos os blocos</option>' +
      blocos
        .map(
          (b) =>
            '<option' +
            (b === curB ? ' selected' : '') + '">' +
            esc(b) +
            '</option>',
        )
        .join('');
  }
  const selA = tryById<HTMLSelectElement>('mapaRecFiltAndar');
  if (selA !== null) {
    const curA = selA.value;
    selA.innerHTML =
      '<option value="">Todos os andares</option>' +
      andares
        .map(
          (a) =>
            '<option' +
            (a === curA ? ' selected' : '') + '">' +
            esc(a) +
            '</option>',
        )
        .join('');
  }
}

/** Renderiza o mapa de salas (somente leitura) e as reservas futuras. */
export function rdMapa(): void {
  popularFiltrosMapa();
  const salas = getSalasByUnidade(uid() as number);
  const cont = byId('mapaRec');
  const hj = hojeISO();

  if (!salas.length) {
    cont.innerHTML = '<p class="txt2">Nenhuma sala cadastrada na unidade.</p>';
    return;
  }

  const filtTurno =
    tryById<HTMLSelectElement>('mapaRecFiltTurno')?.value ?? '';
  const filtBloco =
    tryById<HTMLSelectElement>('mapaRecFiltBloco')?.value ?? '';
  const filtAndar =
    tryById<HTMLSelectElement>('mapaRecFiltAndar')?.value ?? '';
  const filtStatus =
    tryById<HTMLSelectElement>('mapaRecFiltStatus')?.value ?? '';
  const buscaNome =
    tryById<HTMLInputElement>('mapaRecBusca')?.value.toLowerCase().trim() ?? '';

  let salasFiltradas = salas.filter((s) => {
    if (
      buscaNome &&
      !s.nome.toLowerCase().includes(buscaNome) &&
      !s.tipo.toLowerCase().includes(buscaNome)
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
    infoMap[s.id] = calcSalaStatus(s, hj);
  });
  if (filtStatus) {
    salasFiltradas = salasFiltradas.filter((s) => infoMap[s.id].stat === filtStatus);
  }

  const livres = salasFiltradas.filter((s) => infoMap[s.id].stat === 'livre').length;
  const ocupadas = salasFiltradas.filter(
    (s) => infoMap[s.id].stat === 'ocupada',
  ).length;
  const iminentes = salasFiltradas.filter(
    (s) => infoMap[s.id].stat === 'iminente',
  ).length;
  const legEl = tryById('mapaRecLegenda');
  if (legEl !== null) {
    legEl.innerHTML =
      '<span class="leg-item livre"><span class="ic-dot ic-livre"></span> Livre: ' +
      livres +
      '</span>' +
      '<span class="leg-item ocupada"><span class="ic-dot ic-ocupada"></span> Ocupada: ' +
      ocupadas +
      '</span>' +
      '<span class="leg-item iminente"><span class="ic-dot ic-iminente"></span> Em breve: ' +
      iminentes +
      '</span>' +
      '<span class="leg-total">Total: ' +
      salasFiltradas.length +
      '</span>';
  }

  if (!salasFiltradas.length) {
    cont.innerHTML =
      '<p class="txt2" style="padding:24px">Nenhuma sala com esses filtros.</p>';
    return;
  }

  const grupos: Record<string, Record<string, Sala[]>> = {};
  salasFiltradas.forEach((s) => {
    const bloco = s.bloco || 'Sem Bloco';
    const andar = s.andar || 'Sem Andar';
    if (!grupos[bloco]) grupos[bloco] = {};
    if (!grupos[bloco][andar]) grupos[bloco][andar] = [];
    grupos[bloco][andar].push(s);
  });

  let html = '';
  Object.keys(grupos)
    .sort()
    .forEach((bloco) => {
      html +=
        '<div class="mapa-bloco"><div class="mapa-bloco-titulo"><i class="ph ph-map-pin"></i> ' +
        esc(bloco) +
        '</div>';
      Object.keys(grupos[bloco])
        .sort()
        .forEach((andar) => {
          html +=
            '<div class="mapa-andar"><div class="mapa-andar-titulo"><i class="ph ph-buildings"></i> ' +
            esc(andar) +
            '</div>';
          html += '<div class="mapa-andar-grid">';
          grupos[bloco][andar].forEach((s) => {
            html += buildSalaCard(s, infoMap[s.id]);
          });
          html += '</div></div>';
        });
      html += '</div>';
    });
  cont.innerHTML = html;

  // Reservas futuras (proximos 14 dias)
  const tb = byId('tbFuturas');
  const hoje14 = new Date();
  hoje14.setDate(hoje14.getDate() + 14);
  const fim14 = hoje14.toISOString().split('T')[0];
  const fut = getReservas()
    .filter(
      (r) => r.unidadeId === uid() && r.dataFim >= hj && r.dataInicio <= fim14,
    )
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
    .slice(0, 20);
  if (!fut.length) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="5">Sem reservas futuras nos próximos 14 dias.</td></tr>';
    return;
  }
  tb.innerHTML = fut
    .map((r) => {
      const sala = getSalaById(r.salaId);
      const t = getTurmaById(r.turmaId);
      const inst = t && t.instrutorId ? getUserById(t.instrutorId) : null;
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
        '</td>' +
        '<td style="font-size:.82rem">' +
        (r.diasSemana ?? []).map((d) => d.toUpperCase()).join(', ') +
        ' · ' +
        esc(r.turno) +
        '</td></tr>'
      );
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Chaves
// ---------------------------------------------------------------------------

const cfgChavesRec: ConfigBarraFiltros = {
  busca: {
    id: 'buscarChavRec',
    placeholder: 'Pesquisar por código, sala, andar, responsável…',
  },
  filtros: [
    {
      id: 'filtStatusChavRec',
      label: 'Situação',
      campo: 'status',
      opcoes: [
        { value: 'disponivel', label: 'Na recepção' },
        { value: 'pega', label: 'Com responsável' },
      ],
    },
  ],
};

/**
 * Renderiza a lista de chaves da unidade.
 *
 * No legado esta funcao era reescrita por um monkey-patch que montava a barra
 * de busca/filtros; a versao original ficava inalcançavel e foi removida.
 */
export function rdChaves(): void {
  const cont = tryById('searchChavRec');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchChavRec', cfgChavesRec, renderChaves);
  }
  renderChaves();
}

function renderChaves(): void {
  const vals = lerFiltros(cfgChavesRec);
  let list = getChaves().filter((c) => c.unidadeId === uid());
  list = filtrarLista(list, vals['_busca'], [
    'codigo',
    'andar',
    (c) => {
      const s = getSalaById(c.salaId);
      return s ? s.nome : '';
    },
    (c) => {
      const u = c.instrutorId ? getUserById(c.instrutorId) : null;
      return u ? u.nome : '';
    },
  ]);
  if (vals['status']) list = list.filter((c) => c.status === vals['status']);

  setText('countChavRec', `${list.length} chave(s)`);

  const cont = byId('listaChaves');
  if (!list.length) {
    cont.innerHTML = '<p class="txt2">Nenhuma chave encontrada.</p>';
    return;
  }
  cont.innerHTML = list.map((c) => buildChaveCard(c)).join('');
}

const PERFIL_LABEL: Record<string, string> = {
  instrutor: 'Instrutor',
  coordenador: 'Coordenador',
  recepcao: 'Recepção',
  admin: 'Admin',
};

function buildChaveCard(chave: Chave): string {
  const sala = getSalaById(chave.salaId);
  const pega = chave.status === 'pega';
  const resp = pega && chave.instrutorId ? getUserById(chave.instrutorId) : null;
  const perfil = resp ? resp.perfil || 'instrutor' : '';
  const perfilLabel = PERFIL_LABEL[perfil] ?? perfil;

  const statusHtml = resp
    ? '<div class="ch-det ch-com"><i class="ph ph-user-check"></i> Com: <strong>' +
      esc(resp.nome) +
      '</strong>' +
      (perfilLabel ? ' <span class="ch-perfil-tag">' + esc(perfilLabel) + '</span>' : '') +
      (chave.pegaEm
        ? ' <span style="opacity:.7;font-size:.75rem">desde ' +
          fmtDateTime(chave.pegaEm) +
          '</span>'
        : '') +
      '</div>'
    : '<div class="ch-det ch-livre"><i class="ph ph-house-line"></i> Na recepção</div>';

  return (
    '<div class="chave-card ' +
    (pega ? 'pega' : 'disponivel') +
    '">' +
    '<div class="ch-icon"><i class="ph ph-key"></i></div>' +
    '<div class="ch-info">' +
    '<div class="ch-nome">' +
    esc(sala ? sala.nome : '—') +
    ' — ' +
    esc(chave.codigo || 'Chave') +
    '</div>' +
    '<div class="ch-det">Andar: ' +
    esc(chave.andar || '—') +
    '</div>' +
    statusHtml +
    '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
    '<button class="btn btn-primary btn-sm" data-action="abrirAtribuir" data-arg="' +
    chave.id + '">' +
    '<i class="ph ph-user-switch"></i> ' +
    (pega ? 'Reatribuir' : 'Atribuir') +
    '</button>' +
    (pega
      ? '<button class="btn btn-ghost btn-sm" data-action="liberarChaveRapido" data-arg="' +
        chave.id + '"><i class="ph ph-arrow-u-up-left"></i> Liberar</button>'
      : '') +
    '<button class="btn btn-ghost btn-sm" data-action="abrirChave" data-arg="' +
    chave.id + '">Editar</button>' +
    '<button class="btn btn-danger btn-sm" data-action="excluirChave" data-arg="' +
    chave.id + '">Excluir</button>' +
    '</div></div>'
  );
}

/** Devolve a chave a recepcao e notifica o responsavel anterior. */
export async function liberarChaveRapido(chaveId: number): Promise<void> {
  const c = getChaveById(chaveId);
  const respId = c ? c.instrutorId : null;
  if (!confirm('Registrar chave como devolvida à recepção?')) return;
  try {
    await devolverChaveAsync(chaveId);
    if (respId) {
      const resp = getUserById(respId);
      const sala = getSalaById(c ? c.salaId : null);
      const perfil = resp ? resp.perfil || 'instrutor' : 'instrutor';
      await addNotifAsync({
        para: perfil,
        paraId: respId,
        tipo: 'chave',
        titulo: 'Chave devolvida — ' + (sala ? sala.nome : 'sala'),
        msg:
          'A chave ' +
          (c ? '"' + c.codigo + '"' : '') +
          ' foi registrada como devolvida na recepção.',
      });
    }
    toast('Chave registrada como devolvida!', 'ok');
  } catch {
    toast('Erro ao devolver chave.', 'erro');
  }
  rdChaves();
}

/** Abre o modal de criacao/edicao de chave. */
export function abrirChave(id: number | null = null): void {
  const c = id ? getChaveById(id) : null;
  byId<HTMLInputElement>('mCId').value = id ? String(id) : '';
  setText('mCTit', id ? 'Editar Chave' : 'Nova Chave');

  const sel = byId<HTMLSelectElement>('mCSala');
  sel.innerHTML = '<option value="">— Selecione a sala —</option>';
  getSalasByUnidade(uid() as number).forEach((s) => {
    const o = document.createElement('option');
    o.value = String(s.id);
    o.textContent = `${s.nome} (${s.tipo})`;
    if (c && c.salaId === s.id) o.selected = true;
    sel.appendChild(o);
  });

  byId<HTMLInputElement>('mCCod').value = c ? c.codigo || '' : '';
  byId<HTMLInputElement>('mCAndar').value = c ? c.andar || '' : '';
  modalAbrir('modalChave');
}

/** Persiste a chave criada/editada. */
export function salvarChave(): void {
  const id = parseInt(byId<HTMLInputElement>('mCId').value, 10) || null;
  const salaId = parseInt(byId<HTMLSelectElement>('mCSala').value, 10) || null;
  const codigo = byId<HTMLInputElement>('mCCod').value.trim();
  const andar = byId<HTMLInputElement>('mCAndar').value.trim();

  if (!salaId || !codigo) {
    toast('Preencha sala e código.', 'aviso');
    return;
  }
  const dados: NovaChave = {
    salaId,
    codigo,
    andar,
    unidadeId: uid() as number,
  };
  if (id) {
    updChave(id, dados);
    toast('Chave atualizada!', 'ok');
  } else {
    addChave(dados);
    toast('Chave criada!', 'ok');
  }
  modalFechar('modalChave');
  rdChaves();
}

/** Exclui uma chave apos confirmacao. */
export function excluirChave(id: number): void {
  if (!confirm('Excluir esta chave?')) return;
  delChave(id);
  toast('Chave excluída.', 'aviso');
  rdChaves();
}

// ---------------------------------------------------------------------------
// Atribuicao / devolucao
// ---------------------------------------------------------------------------

/** Abre o modal para atribuir uma chave a um instrutor ou coordenador. */
export function abrirAtribuir(chaveId: number): void {
  const c = getChaveById(chaveId);
  const sala = getSalaById(c ? c.salaId : null);
  const pega = c && c.status === 'pega';
  const quemId = pega && c ? c.instrutorId : null;

  byId<HTMLInputElement>('mAChaveId').value = String(chaveId);
  byId<HTMLInputElement>('mAChaveNome').value =
    (sala ? sala.nome : '—') + ' — ' + (c ? c.codigo || 'Chave' : '');

  const sel = byId<HTMLSelectElement>('mAInstrutorSel');
  sel.innerHTML = '<option value="">— Selecione o responsável —</option>';

  const grupos = [
    { perfil: 'instrutor', label: 'Instrutores' },
    { perfil: 'coordenador', label: 'Coordenadores' },
  ];
  grupos.forEach((g) => {
    const users = getUsersByPerfil(g.perfil).filter((u) => u.unidadeId === uid());
    if (!users.length) return;
    const grp = document.createElement('optgroup');
    grp.label = g.label;
    users.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = u.nome;
      if (quemId && quemId === u.id) opt.selected = true;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });

  const btnDev = tryById<HTMLButtonElement>('mABtnDevolver');
  if (btnDev !== null) btnDev.style.display = pega ? '' : 'none';

  modalAbrir('modalAtribuir');
}

/** Confirma a atribuicao e notifica o responsavel. */
export async function confirmarAtribuir(): Promise<void> {
  const chaveId = parseInt(byId<HTMLInputElement>('mAChaveId').value, 10);
  const respId = parseInt(byId<HTMLSelectElement>('mAInstrutorSel').value, 10);
  if (!respId) {
    toast('Selecione o responsável.', 'aviso');
    return;
  }
  const c = getChaveById(chaveId);
  const sala = getSalaById(c ? c.salaId : null);
  const resp = getUserById(respId);
  const perfil = resp ? resp.perfil || 'instrutor' : 'instrutor';
  try {
    await retirarChaveAsync(chaveId, respId);
    await addNotifAsync({
      para: perfil,
      paraId: respId,
      tipo: 'chave',
      titulo: 'Chave atribuída a você — ' + (sala ? sala.nome : 'sala'),
      msg:
        'A chave ' +
        (c ? '"' + c.codigo + '"' : '') +
        ' foi registrada em seu nome pela recepção. Lembre-se de devolvê-la ao sair.',
    });
    toast('Chave atribuída a ' + (resp ? resp.nome : 'responsável') + '!', 'ok');
  } catch {
    toast('Erro ao atribuir chave.', 'erro');
  }
  modalFechar('modalAtribuir');
  rdChaves();
}

/** Devolve a chave aberta no modal e notifica o responsavel. */
export async function devolverChaveRec(): Promise<void> {
  const chaveId = parseInt(byId<HTMLInputElement>('mAChaveId').value, 10);
  const c = getChaveById(chaveId);
  const respId = c ? c.instrutorId : null;
  try {
    await devolverChaveAsync(chaveId);
    if (respId) {
      const resp = getUserById(respId);
      const perfil = resp ? resp.perfil || 'instrutor' : 'instrutor';
      const sala = getSalaById(c ? c.salaId : null);
      await addNotifAsync({
        para: perfil,
        paraId: respId,
        tipo: 'chave',
        titulo: 'Chave devolvida — ' + (sala ? sala.nome : 'sala'),
        msg:
          'A chave ' +
          (c ? '"' + c.codigo + '"' : '') +
          ' foi registrada como devolvida. Obrigado!',
      });
    }
    toast('Chave registrada como devolvida!', 'ok');
  } catch {
    toast('Erro ao devolver chave.', 'erro');
  }
  modalFechar('modalAtribuir');
  rdChaves();
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

/** Lista as notificacoes da recepcao e marca todas como lidas. */
export function rdNotifs(): void {
  const list = getNotifsPara('recepcao', uid());
  const cont = byId('listaNotifs');
  if (!list.length) {
    cont.innerHTML = '<p class="txt2">Sem notificações.</p>';
    return;
  }
  cont.innerHTML = list
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
  marcarTodasLidas('recepcao', uid());
  atualizarBadge();
}

/** Atualiza o contador de notificacoes nao lidas da barra lateral. */
export function atualizarBadge(): void {
  const n = countNaoLidas('recepcao', uid());
  const b = tryById('badgeNotif');
  if (b !== null) {
    b.textContent = String(n);
    b.style.display = n ? '' : 'none';
  }
}