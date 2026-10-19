/**
 * Painel do Administrador (`admin.html`).
 *
 * Migrado de `_js_original/admin_page.js`.
 *
 * Secoes:
 *   Dashboard  — totais de usuarios, unidades, salas, turmas, reservas, chaves
 *   Usuarios   — CRUD com filtro por perfil/unidade e busca textual
 *   Unidades   — CRUD de unidades/CPS com CEP
 *   Salas      — visao global (somente leitura)
 *   Turmas     — visao global (somente leitura)
 *   Reservas   — visao global (somente leitura)
 *   Chaves     — visao global (somente leitura)
 *   Calendario — reservas de todas as unidades
 *
 * O admin e o unico perfil com escrita; as demais secoes sao leitura.
 */

import {
  addUnidade,
  addUser,
  delUnidade,
  delUser,
  getChaves,
  getReservas,
  getSalas,
  getSalaById,
  getTurmas,
  getTurmaById,
  getUnidades,
  getUnidadeById,
  getUserById,
  getUsersByPerfil,
  getUsuarios,
  initDados,
  updUnidade,
  updUser,
} from '../../core/storage';
import { calcStatus, esc, fmtData, htmlStatus } from '../../core/format';
import {
  filtrarLista,
  lerFiltros,
  montarBarraPesquisaFiltros,
  type ConfigBarraFiltros,
} from '../../core/filters';
import { fmsg, fmsgHide, modalAbrir, modalFechar, toast } from '../../core/ui';
import { initLogo, initSidebar, requirePerfil } from '../../core/auth';
import { byId, tryById } from '../../core/dom';
import { rdCalendario } from '../calendario/calendario';
import type { Usuario } from '../../types';

let editUserId: number | null = null;
let editUnidId: number | null = null;

/** Inicializa o painel. Deve ser chamado uma vez pelo entry da pagina. */
export async function initAdmin(): Promise<void> {
  await initDados();
  requirePerfil('admin');
  initSidebar();
  initLogo();
  ir('dashboard');
}

const META: Record<string, { t: string; s: string }> = {
  dashboard: { t: 'Dashboard', s: 'Visão geral do sistema' },
  usuarios: { t: 'Usuários', s: 'Gerenciar coordenadores, instrutores e recepção' },
  unidades: { t: 'Unidades / CPS', s: 'Unidades e centros do SENAC no GDF' },
  salas: { t: 'Salas', s: 'Todas as salas do sistema' },
  turmas: { t: 'Turmas', s: 'Todas as turmas do sistema' },
  reservas: { t: 'Reservas', s: 'Todas as reservas do sistema' },
  chaves: { t: 'Chaves', s: 'Todas as chaves do sistema' },
  calendario: {
    t: 'Calendário de Reservas',
    s: 'Visualize todas as reservas por data e turno',
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
  setTextSafe('tbTitle', m.t ?? aba);
  setTextSafe('tbSub', m.s ?? '');

  switch (aba) {
    case 'dashboard':
      rdDash();
      break;
    case 'usuarios':
      rdUsuarios();
      break;
    case 'unidades':
      rdUnidades();
      break;
    case 'salas':
      rdTodasSalas();
      break;
    case 'turmas':
      rdTodasTurmas();
      break;
    case 'reservas':
      rdTodasReservas();
      break;
    case 'chaves':
      rdTodasChaves();
      break;
    case 'calendario':
      rdCalendario();
      break;
    default:
      break;
  }
}

function setTextSafe(id: string, texto: string): void {
  const el = tryById(id);
  if (el !== null) el.textContent = texto;
}

/**
 * Badge colorida por perfil.
 *
 * As chaves sao os valores reais de `Usuario.perfil` (ver `types/index.ts` e
 * `server/seed.js`): 'admin' | 'coordenador' | 'instrutor' | 'recepcao'.
 * Qualquer chave nao encontrada cai em 'bdg-muted'.
 */
const BADGE_PERFIL: Record<string, string> = {
  coordenador: 'bdg-blue',
  instrutor: 'bdg-green',
  recepcao: 'bdg-amber',
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function rdDash(): void {
  const us = getUsuarios();
  setTextSafe('stTotal', String(us.length));
  setTextSafe('stCoord', String(getUsersByPerfil('coordenador').length));
  setTextSafe('stInst', String(getUsersByPerfil('instrutor').length));
  setTextSafe('stUnid', String(getUnidades().length));
  setTextSafe('stSalas', String(getSalas().length));
  setTextSafe('stTurmas', String(getTurmas().length));
  setTextSafe('stResv', String(getReservas().length));
  setTextSafe('stChav', String(getChaves().length));

  const tb = byId('tbDash');
  if (us.length === 0) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="4">Nenhum usuário.</td></tr>';
    return;
  }
  tb.innerHTML = us
    .slice(0, 10)
    .map((u) => {
      const unid = u.unidadeId ? getUnidadeById(u.unidadeId) : null;
      return (
        '<tr><td><strong>' +
        esc(u.nome) +
        '</strong></td><td class="mono">' +
        esc(u.email) +
        '</td>' +
        '<td><span class="bdg ' +
        (BADGE_PERFIL[u.perfil] ?? 'bdg-muted') +
        '">' +
        esc(u.perfil) +
        '</span></td>' +
        '<td>' +
        esc(unid ? unid.nome : '—') +
        '</td></tr>'
      );
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

const cfgUsuarios: ConfigBarraFiltros = {
  busca: { id: 'buscarUsuario', placeholder: 'Pesquisar por nome, e-mail…' },
  filtros: [
    {
      id: 'filtPerfilUser',
      label: 'Perfil',
      campo: 'perfil',
      opcoes: [
        { value: 'coordenador', label: 'Coordenador' },
        { value: 'instrutor', label: 'Instrutor' },
        { value: 'recepcao', label: 'Recepção' },
      ],
    },
    { id: 'filtUnidUser', label: 'Unidade', campo: 'unidadeId', opcoes: [] },
  ],
};

export function rdUsuarios(): void {
  cfgUsuarios.filtros![1].opcoes = getUnidades().map((u) => ({
    value: u.id,
    label: u.nome,
  }));
  const cont = tryById('searchUsuarios');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchUsuarios', cfgUsuarios, renderTbUsuarios);
  } else {
    atualizarFiltroUnidades('filtUnidUser');
  }
  renderTbUsuarios();
}

/** Recarrega as opcoes de um filtro de unidade preservando a selecao. */
function atualizarFiltroUnidades(selId: string): void {
  const sel = tryById<HTMLSelectElement>(selId);
  if (sel === null) return;
  const cur = sel.value;
  sel.innerHTML =
    '<option value="">Todos</option>' +
    getUnidades()
      .map(
        (u) =>
          '<option value="' +
          u.id +
          '"' +
          (String(u.id) === String(cur) ? ' selected' : '') + '">' +
          esc(u.nome) +
          '</option>',
      )
      .join('');
}

function renderTbUsuarios(): void {
  const vals = lerFiltros(cfgUsuarios);
  let list = getUsuarios();
  list = filtrarLista(list, vals['_busca'], ['nome', 'email']);
  if (vals['perfil']) list = list.filter((u) => u.perfil === vals['perfil']);
  if (vals['unidadeId']) {
    list = list.filter((u) => String(u.unidadeId) === String(vals['unidadeId']));
  }

  setTextSafe('countUsuarios', `${list.length} usuário(s)`);
  const tb = byId('tbUsuarios');
  if (list.length === 0) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="5">Nenhum usuário encontrado.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((u) => {
      const unid = u.unidadeId ? getUnidadeById(u.unidadeId) : null;
      return (
        '<tr><td><strong>' +
        esc(u.nome) +
        '</strong></td><td class="mono">' +
        esc(u.email) +
        '</td>' +
        '<td><span class="bdg ' +
        (BADGE_PERFIL[u.perfil] ?? 'bdg-muted') +
        '">' +
        esc(u.perfil) +
        '</span></td>' +
        '<td>' +
        esc(unid ? unid.nome : '—') +
        '</td>' +
        '<td><div class="td-actions">' +
        '<button class="btn btn-ghost btn-sm" data-action="abrirUser" data-arg="' +
        u.id + '">Editar</button>' +
        '<button class="btn btn-warning btn-sm" data-action="resetSenha" data-arg="' +
        u.id + '">Reset Senha</button>' +
        '<button class="btn btn-danger btn-sm" data-action="excluirUser" data-arg="' +
        u.id + '">Excluir</button>' +
        '</div></td></tr>'
      );
    })
    .join('');
}

/** Abre o modal de criar/editar usuario. */
export function abrirUser(id: number | null = null): void {
  editUserId = id ?? null;
  const u = id ? getUserById(id) : null;
  setTextSafe('mUTitulo', id ? 'Editar Usuário' : 'Novo Usuário');
  byId<HTMLInputElement>('mUNome').value = u ? u.nome : '';
  byId<HTMLInputElement>('mUEmail').value = u ? u.email : '';
  byId<HTMLInputElement>('mUSenha').value = '';
  if (u) byId<HTMLSelectElement>('mUPerfil').value = u.perfil;

  const sel = byId<HTMLSelectElement>('mUUnidade');
  sel.innerHTML = '<option value="">— Selecione a unidade —</option>';
  getUnidades().forEach((un) => {
    const o = document.createElement('option');
    o.value = String(un.id);
    o.textContent = un.nome;
    if (u && u.unidadeId === un.id) o.selected = true;
    sel.appendChild(o);
  });

  fmsgHide('mUMsg');
  modalAbrir('modalUser');
}

/** Fecha o modal de usuario. */
export function fecharUser(): void {
  modalFechar('modalUser');
  editUserId = null;
}

/** Persiste o usuario editado/criado. */
export function salvarUser(): void {
  const nome = byId<HTMLInputElement>('mUNome').value.trim();
  const email = byId<HTMLInputElement>('mUEmail').value.trim();
  const senha = byId<HTMLInputElement>('mUSenha').value.trim();
  const perfil = byId<HTMLSelectElement>('mUPerfil').value;
  const unidadeId = parseInt(byId<HTMLSelectElement>('mUUnidade').value, 10) || null;

  if (!nome) return fmsg('mUMsg', 'erro', 'Informe o nome.');
  if (!email) return fmsg('mUMsg', 'erro', 'Informe o e-mail.');
  if (!perfil) return fmsg('mUMsg', 'erro', 'Selecione o perfil.');
  if (!unidadeId) return fmsg('mUMsg', 'erro', 'Selecione a unidade.');
  if (!editUserId && !senha) return fmsg('mUMsg', 'erro', 'Defina uma senha.');

  const existe = getUsuarios().find(
    (u: Usuario) =>
      u.email.toLowerCase() === email.toLowerCase() && u.id !== editUserId,
  );
  if (existe) return fmsg('mUMsg', 'erro', 'Este e-mail já está em uso.');

  const dados: Partial<Usuario> = {
    nome,
    email,
    perfil: perfil as Usuario['perfil'],
    unidadeId,
  };
  if (senha) dados.senha = senha;

  if (editUserId) {
    void updUser(editUserId, dados);
    toast('Usuário atualizado!', 'ok');
  } else {
    void addUser(dados as Omit<Usuario, 'id'>);
    toast('Usuário criado!', 'ok');
  }
  fecharUser();
  rdUsuarios();
  rdDash();
}

/** Redefine a senha de um usuario via `prompt`. */
export function resetSenha(id: number): void {
  const u = getUserById(id);
  if (!u) return;
  const nova = prompt(`Nova senha para "${u.nome}":`);
  if (!nova || !nova.trim()) return;
  void updUser(id, { senha: nova.trim() });
  toast(`Senha de "${u.nome}" redefinida!`, 'ok');
}

/** Exclui um usuario apos confirmacao. */
export function excluirUser(id: number): void {
  const u = getUserById(id);
  if (!u) return;
  if (!confirm(`Excluir "${u.nome}"?\nEsta ação não pode ser desfeita.`)) return;
  void delUser(id);
  toast('Usuário excluído.', 'aviso');
  rdUsuarios();
  rdDash();
}

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------

const cfgUnidades: ConfigBarraFiltros = {
  busca: { id: 'buscarUnidade', placeholder: 'Pesquisar por nome, cidade, CEP…' },
  filtros: [],
};

export function rdUnidades(): void {
  const cont = tryById('searchUnidades');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchUnidades', cfgUnidades, renderTbUnidades);
  }
  renderTbUnidades();
}

function renderTbUnidades(): void {
  const vals = lerFiltros(cfgUnidades);
  let list = getUnidades();
  list = filtrarLista(list, vals['_busca'], ['nome', 'cidade', 'cep', 'endereco']);

  setTextSafe('countUnidades', `${list.length} unidade(s)`);
  const tb = byId('tbUnidades');
  if (list.length === 0) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="4">Nenhuma unidade encontrada.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((u) => {
      return (
        '<tr><td><strong>' +
        esc(u.nome) +
        '</strong><div style="font-size:.78rem;color:var(--text3)">' +
        esc(u.cidade ?? '') +
        '</div></td>' +
        '<td class="txt2">' +
        esc(u.endereco ?? '—') +
        '</td><td class="mono">' +
        esc(u.cep ?? '—') +
        '</td>' +
        '<td><div class="td-actions">' +
        '<button class="btn btn-ghost btn-sm" data-action="abrirUnid" data-arg="' +
        u.id + '">Editar</button>' +
        '<button class="btn btn-danger btn-sm" data-action="excluirUnid" data-arg="' +
        u.id + '">Excluir</button>' +
        '</div></td></tr>'
      );
    })
    .join('');
}

/** Abre o modal de criar/editar unidade. */
export function abrirUnid(id: number | null = null): void {
  editUnidId = id ?? null;
  const u = id ? getUnidadeById(id) : null;
  setTextSafe('mNTitulo', id ? 'Editar Unidade' : 'Nova Unidade');
  byId<HTMLInputElement>('mNNome').value = u ? u.nome : '';
  byId<HTMLInputElement>('mNEndereco').value = u ? (u.endereco ?? '') : '';
  byId<HTMLInputElement>('mNCep').value = u ? (u.cep ?? '') : '';
  fmsgHide('mNMsg');
  modalAbrir('modalUnid');
}

/** Fecha o modal de unidade. */
export function fecharUnid(): void {
  modalFechar('modalUnid');
  editUnidId = null;
}

/** Persiste a unidade editada/criada. */
export function salvarUnid(): void {
  const nome = byId<HTMLInputElement>('mNNome').value.trim();
  const endereco = byId<HTMLInputElement>('mNEndereco').value.trim();
  const cep = byId<HTMLInputElement>('mNCep').value.trim();
  if (!nome) return fmsg('mNMsg', 'erro', 'Informe o nome da unidade.');

  if (editUnidId) {
    updUnidade(editUnidId, { nome, endereco, cep });
    toast('Unidade atualizada!', 'ok');
  } else {
    addUnidade({ nome, endereco, cep });
    toast('Unidade criada!', 'ok');
  }
  fecharUnid();
  rdUnidades();
  rdDash();
}

/** Exclui uma unidade, bloqueando quando ha usuarios vinculados. */
export function excluirUnid(id: number): void {
  const u = getUnidadeById(id);
  if (!u) return;
  const vincul = getUsuarios().filter((x) => x.unidadeId === id).length;
  if (vincul > 0) {
    toast(
      `Não é possível excluir: ${vincul} usuário(s) vinculado(s).`,
      'erro',
    );
    return;
  }
  if (!confirm(`Excluir "${u.nome}"?`)) return;
  delUnidade(id);
  toast('Unidade excluída.', 'aviso');
  rdUnidades();
  rdDash();
}

// ---------------------------------------------------------------------------
// Visao global — salas
// ---------------------------------------------------------------------------

const cfgSalasAdmin: ConfigBarraFiltros = {
  busca: { id: 'buscarSalaAdmin', placeholder: 'Pesquisar sala por nome, tipo…' },
  filtros: [
    { id: 'filtUnidSala', label: 'Unidade', campo: 'unidadeId', opcoes: [] },
    {
      id: 'filtTipoSala',
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

export function rdTodasSalas(): void {
  cfgSalasAdmin.filtros![0].opcoes = getUnidades().map((u) => ({
    value: u.id,
    label: u.nome,
  }));
  const cont = tryById('searchSalasAdmin');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchSalasAdmin', cfgSalasAdmin, renderTbSalasAdmin);
  } else {
    atualizarFiltroUnidades('filtUnidSala');
  }
  renderTbSalasAdmin();
}

function renderTbSalasAdmin(): void {
  const vals = lerFiltros(cfgSalasAdmin);
  let list = getSalas();
  list = filtrarLista(list, vals['_busca'], ['nome', 'tipo']);
  if (vals['unidadeId']) {
    list = list.filter((s) => String(s.unidadeId) === String(vals['unidadeId']));
  }
  if (vals['tipo']) list = list.filter((s) => s.tipo === vals['tipo']);

  setTextSafe('countSalasAdmin', `${list.length} sala(s)`);
  const tb = byId('tbSalasAdmin');
  if (list.length === 0) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="5">Nenhuma sala encontrada.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((s) => {
      const unid = getUnidadeById(s.unidadeId);
      const turnos = (s.turnos ?? s.turnosDisponiveis ?? [])
        .map((t) => `<span class="bdg bdg-primary">${t}</span>`)
        .join(' ');
      return (
        '<tr><td><strong>' +
        esc(s.nome) +
        '</strong></td>' +
        '<td>' +
        esc(unid ? unid.nome : '—') +
        '</td>' +
        '<td>' +
        esc(s.tipo) +
        '</td>' +
        '<td>' +
        s.capacidade +
        ' pess.</td>' +
        '<td>' +
        turnos +
        '</td></tr>'
      );
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Visao global — turmas
// ---------------------------------------------------------------------------

const cfgTurmasAdmin: ConfigBarraFiltros = {
  busca: { id: 'buscarTurmaAdmin', placeholder: 'Pesquisar turma, curso, instrutor…' },
  filtros: [
    { id: 'filtUnidTurma', label: 'Unidade', campo: 'unidadeId', opcoes: [] },
    {
      id: 'filtTurnoTurma',
      label: 'Turno',
      campo: 'turno',
      opcoes: [
        { value: 'Matutino', label: 'Matutino' },
        { value: 'Vespertino', label: 'Vespertino' },
        { value: 'Noturno', label: 'Noturno' },
      ],
    },
    {
      id: 'filtStatusTurma',
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

export function rdTodasTurmas(): void {
  cfgTurmasAdmin.filtros![0].opcoes = getUnidades().map((u) => ({
    value: u.id,
    label: u.nome,
  }));
  const cont = tryById('searchTurmasAdmin');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchTurmasAdmin', cfgTurmasAdmin, renderTbTurmasAdmin);
  } else {
    atualizarFiltroUnidades('filtUnidTurma');
  }
  renderTbTurmasAdmin();
}

function renderTbTurmasAdmin(): void {
  const vals = lerFiltros(cfgTurmasAdmin);
  let list: TurmaComStatus[] = getTurmas().map((t) => ({
    ...t,
    _status: calcStatus(t),
  }));
  list = filtrarLista(list, vals['_busca'], [
    'nome',
    'curso',
    (t) => {
      const i = t.instrutorId ? getUserById(t.instrutorId) : null;
      return i ? i.nome : '';
    },
  ]);
  if (vals['unidadeId']) {
    list = list.filter((t) => String(t.unidadeId) === String(vals['unidadeId']));
  }
  if (vals['turno']) list = list.filter((t) => t.turno === vals['turno']);
  if (vals['_status']) list = list.filter((t) => t._status === vals['_status']);

  setTextSafe('countTurmasAdmin', `${list.length} turma(s)`);
  const tb = byId('tbTurmasAdmin');
  if (list.length === 0) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="6">Nenhuma turma encontrada.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((t) => {
      const unid = getUnidadeById(t.unidadeId);
      const inst = t.instrutorId ? getUserById(t.instrutorId) : null;
      return (
        '<tr><td class="mono"><strong>' +
        esc(t.nome) +
        '</strong></td>' +
        '<td>' +
        esc(t.curso) +
        '</td>' +
        '<td>' +
        esc(unid ? unid.nome : '—') +
        '</td>' +
        '<td>' +
        esc(inst ? inst.nome : '—') +
        '</td>' +
        '<td><span class="bdg bdg-primary">' +
        esc(t.turno) +
        '</span></td>' +
        '<td>' +
        htmlStatus(t) +
        '</td></tr>'
      );
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Visao global — reservas
// ---------------------------------------------------------------------------

const cfgResAdmin: ConfigBarraFiltros = {
  busca: { id: 'buscarResAdmin', placeholder: 'Pesquisar sala, turma, turno…' },
  filtros: [
    { id: 'filtUnidRes', label: 'Unidade', campo: 'unidadeId', opcoes: [] },
    {
      id: 'filtTurnoRes',
      label: 'Turno',
      campo: 'turno',
      opcoes: [
        { value: 'Matutino', label: 'Matutino' },
        { value: 'Vespertino', label: 'Vespertino' },
        { value: 'Noturno', label: 'Noturno' },
      ],
    },
    {
      id: 'filtStatusRes',
      label: 'Status',
      campo: 'status',
      opcoes: [
        { value: 'ATIVA', label: 'ATIVA' },
        { value: 'CANCELADA', label: 'CANCELADA' },
      ],
    },
  ],
};

export function rdTodasReservas(): void {
  cfgResAdmin.filtros![0].opcoes = getUnidades().map((u) => ({
    value: u.id,
    label: u.nome,
  }));
  const cont = tryById('searchResAdmin');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchResAdmin', cfgResAdmin, renderTbResAdmin);
  } else {
    atualizarFiltroUnidades('filtUnidRes');
  }
  renderTbResAdmin();
}

function renderTbResAdmin(): void {
  const vals = lerFiltros(cfgResAdmin);
  let list = getReservas();
  list = filtrarLista(list, vals['_busca'], [
    (r) => {
      const s = getSalaById(r.salaId);
      return s ? s.nome : '';
    },
    (r) => {
      const t = r.turmaId ? getTurmaById(r.turmaId) : null;
      return t ? t.nome : '';
    },
    'turno',
  ]);
  if (vals['unidadeId']) {
    list = list.filter((r) => String(r.unidadeId) === String(vals['unidadeId']));
  }
  if (vals['turno']) list = list.filter((r) => r.turno === vals['turno']);
  if (vals['status']) list = list.filter((r) => r.status === vals['status']);

  setTextSafe('countResAdmin', `${list.length} reserva(s)`);
  const tb = byId('tbResAdmin');
  if (list.length === 0) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="6">Nenhuma reserva encontrada.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((r) => {
      const sala = getSalaById(r.salaId);
      const turma = r.turmaId ? getTurmaById(r.turmaId) : null;
      const unid = getUnidadeById(r.unidadeId);
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
        '<td>' +
        esc(unid ? unid.nome : '—') +
        '</td>' +
        '<td><span class="bdg bdg-primary">' +
        esc(r.turno) +
        '</span></td>' +
        '<td style="font-size:.82rem">' +
        fmtData(r.dataInicio) +
        ' → ' +
        fmtData(r.dataFim) +
        '</td>' +
        '<td><span class="bdg ' +
        (r.status === 'ATIVA' ? 'bdg-green' : 'bdg-red') +
        '">' +
        esc(r.status) +
        '</span></td></tr>'
      );
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Visao global — chaves
// ---------------------------------------------------------------------------

const cfgChavAdmin: ConfigBarraFiltros = {
  busca: { id: 'buscarChavAdmin', placeholder: 'Pesquisar por código, sala, andar…' },
  filtros: [
    { id: 'filtUnidChav', label: 'Unidade', campo: 'unidadeId', opcoes: [] },
    {
      id: 'filtStatusChav',
      label: 'Status',
      campo: 'status',
      opcoes: [
        { value: 'disponivel', label: 'Disponível' },
        { value: 'pega', label: 'Retirada' },
      ],
    },
  ],
};

export function rdTodasChaves(): void {
  cfgChavAdmin.filtros![0].opcoes = getUnidades().map((u) => ({
    value: u.id,
    label: u.nome,
  }));
  const cont = tryById('searchChavAdmin');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchChavAdmin', cfgChavAdmin, renderTbChavAdmin);
  } else {
    atualizarFiltroUnidades('filtUnidChav');
  }
  renderTbChavAdmin();
}

function renderTbChavAdmin(): void {
  const vals = lerFiltros(cfgChavAdmin);
  let list = getChaves();
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
  if (vals['unidadeId']) {
    list = list.filter((c) => String(c.unidadeId) === String(vals['unidadeId']));
  }
  if (vals['status']) list = list.filter((c) => c.status === vals['status']);

  setTextSafe('countChavAdmin', `${list.length} chave(s)`);
  const tb = byId('tbChavAdmin');
  if (list.length === 0) {
    tb.innerHTML =
      '<tr class="empty-row"><td colspan="5">Nenhuma chave encontrada.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((c) => {
      const sala = getSalaById(c.salaId);
      const unid = getUnidadeById(c.unidadeId);
      const quem = c.instrutorId ? getUserById(c.instrutorId) : null;
      return (
        '<tr><td><strong>' +
        esc(c.codigo ?? '—') +
        '</strong></td>' +
        '<td>' +
        esc(sala ? sala.nome : '—') +
        '</td>' +
        '<td>' +
        esc(unid ? unid.nome : '—') +
        '</td>' +
        '<td>' +
        esc(c.andar ?? '—') +
        '</td>' +
        '<td><span class="bdg ' +
        (c.status === 'disponivel' ? 'bdg-green' : 'bdg-amber') +
        '">' +
        (c.status === 'disponivel' ? 'Disponível' : `Retirada por ${quem ? quem.nome : '?'}`) +
        '</span></td></tr>'
      );
    })
    .join('');
}