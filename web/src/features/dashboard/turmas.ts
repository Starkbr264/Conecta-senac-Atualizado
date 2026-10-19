/**
 * Gestao de turmas do painel publico (`dashboard.html`).
 *
 * Migrado de `_js_original/turmas.js`.
 *
 * Assim como em `salas.js`, o original sobrescrevia `renderTabelaTurmas` via
 * `var` depois de guardar a versao anterior em `_renderTabelaTurmasOrig`
 * (que nunca era chamada). Portamos somente a versao efetiva.
 */

import {
  addTurma,
  deleteTurma,
  getReservas,
  getTurmas,
  updateTurma,
} from '../../core/storage';
import { showMsg, showToast } from '../../core/ui';
import { calcStatus, escapeHtml, fmtData } from '../../core/format';
import {
  filtrarLista,
  lerFiltros,
  montarBarraPesquisaFiltros,
  type ConfigBarraFiltros,
} from '../../core/filters';
import { byId, tryById } from '../../core/dom';
import type { StatusTurma, Turma, Turno } from '../../types';

/** Id da turma em edicao, ou `null` quando o formulario esta em modo cadastro. */
let turmaEditId: number | null = null;

/** Configuracao da barra de busca/filtros da secao "Turmas". */
const cfgTurmasDash: ConfigBarraFiltros = {
  busca: { id: 'buscarTurmaD', placeholder: 'Pesquisar por código, curso…' },
  filtros: [
    {
      id: 'filtTurnoTD',
      label: 'Turno',
      campo: 'turno',
      opcoes: [
        { value: 'Matutino', label: 'Matutino' },
        { value: 'Vespertino', label: 'Vespertino' },
        { value: 'Noturno', label: 'Noturno' },
      ],
    },
    {
      id: 'filtStatusTD',
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

/** Liga os listeners do formulario de turmas. */
export function initTurmas(): void {
  const hoje = new Date().toISOString().split('T')[0];
  byId<HTMLInputElement>('turmaInicio').min = hoje;

  byId<HTMLInputElement>('turmaInicio').addEventListener('change', function (this: HTMLInputElement) {
    byId<HTMLInputElement>('turmaFim').min = this.value;
  });

  byId<HTMLFormElement>('formTurma').addEventListener('submit', (e) => {
    e.preventDefault();
    salvarTurma();
  });

  renderTabelaTurmas();
}

interface DadosTurma {
  nome: string;
  curso: string;
  turno: string;
  dataInicio: string;
  dataFim: string;
}

/** Le e valida o formulario de turma. */
function lerDadosTurma(): { dados: DadosTurma; erros: string[] } {
  const nome = byId<HTMLInputElement>('turmaNome').value.trim();
  const curso = byId<HTMLInputElement>('turmaCurso').value.trim();
  const turno = byId<HTMLSelectElement>('turmaTurno').value;
  const dataInicio = byId<HTMLInputElement>('turmaInicio').value;
  const dataFim = byId<HTMLInputElement>('turmaFim').value;

  const erros: string[] = [];
  if (!nome) erros.push('Informe o nome da turma.');
  if (!curso) erros.push('Informe o curso.');
  if (!dataInicio) erros.push('Informe a data de início.');
  if (!dataFim) erros.push('Informe a data de fim.');
  if (dataInicio && dataFim && dataFim <= dataInicio) {
    erros.push('Data fim deve ser posterior ao início.');
  }

  return { dados: { nome, curso, turno, dataInicio, dataFim }, erros };
}

/** Persiste a turma (cadastro ou edicao). */
export function salvarTurma(): void {
  const { dados, erros } = lerDadosTurma();

  if (erros.length > 0) {
    showMsg('msgTurma', 'error', '<i class="ph ph-x-circle"></i> ' + erros.join(' '));
    return;
  }

  if (turmaEditId) {
    updateTurma(turmaEditId, dados);
    showToast('Turma atualizada com sucesso!', 'success');
    cancelarEdicaoTurma();
  } else {
    addTurma(dados);
    showToast('Turma cadastrada com sucesso!', 'success');
  }

  byId<HTMLFormElement>('formTurma').reset();
  const msg = tryById('msgTurma');
  if (msg !== null) msg.style.display = 'none';
  renderTabelaTurmas();
}

/** Carrega uma turma no formulario para edicao. */
export function editarTurma(id: number): void {
  const turma = getTurmas().find((t) => t.id === id);
  if (!turma) return;

  turmaEditId = id;

  byId<HTMLInputElement>('turmaNome').value = turma.nome;
  byId<HTMLInputElement>('turmaCurso').value = turma.curso ?? '';
  byId<HTMLSelectElement>('turmaTurno').value = turma.turno ?? '';
  byId<HTMLInputElement>('turmaInicio').value = turma.dataInicio ?? '';
  byId<HTMLInputElement>('turmaFim').value = turma.dataFim ?? '';

  byId('btnSalvarTurma').innerHTML =
    '<i class="ph ph-floppy-disk"></i> Atualizar Turma';
  byId('btnCancelarTurma').style.display = 'inline-flex';
  byId<HTMLInputElement>('turmaNome').focus();
  byId('section-turmas').scrollIntoView({ behavior: 'smooth' });
}

/** Sai do modo de edicao e limpa o formulario. */
export function cancelarEdicaoTurma(): void {
  turmaEditId = null;
  byId<HTMLFormElement>('formTurma').reset();
  byId('btnSalvarTurma').innerHTML = '+ Cadastrar Turma';
  byId('btnCancelarTurma').style.display = 'none';
  const msg = tryById('msgTurma');
  if (msg !== null) msg.style.display = 'none';
}

/** Exclui uma turma, bloqueando quando existem reservas ativas. */
export function excluirTurma(id: number): void {
  const reservasVinculadas = getReservas().filter(
    (r) => r.turmaId === id && r.status === 'ATIVA',
  );
  if (reservasVinculadas.length > 0) {
    showToast(
      `Não é possível excluir: turma tem ${reservasVinculadas.length} reserva(s) ativa(s).`,
      'error',
    );
    return;
  }
  if (!confirm('Excluir esta turma? Esta ação não pode ser desfeita.')) return;
  deleteTurma(id);
  showToast('Turma excluída.', 'warning');
  renderTabelaTurmas();
}

/** Linha HTML de uma turma, com badge ATIVA/ENCERRADA derivado das datas. */
function linhaTurma(t: Turma, hoje: string): string {
  const encerrada = hoje > (t.dataFim ?? '');
  return `
      <tr>
        <td><strong class="code-text">${escapeHtml(t.nome)}</strong></td>
        <td>${escapeHtml(t.curso)}</td>
        <td><span class="badge badge-primary">${t.turno}</span></td>
        <td>${fmtData(t.dataInicio)}</td>
        <td>${fmtData(t.dataFim)}</td>
        <td><span class="badge ${encerrada ? 'badge-danger' : 'badge-success'}">${
          encerrada ? 'ENCERRADA' : 'ATIVA'
        }</span></td>
        <td>
          <button class="btn btn-warning-sm" data-action="editarTurma" data-arg="${t.id}"><i class="ph ph-pencil-simple"></i>️ Editar</button>
          <button class="btn btn-danger-sm"  data-action="excluirTurma" data-arg="${t.id}"><i class="ph ph-trash"></i>️ Excluir</button>
        </td>
      </tr>`;
}

/**
 * Renderiza a tabela de turmas aplicando os filtros da barra de busca.
 *
 * No legado esta era a funcao sobrescrita pelo "monkey-patch"; aqui e a
 * unica implementacao exported, porque a versao anterior ja era inalcancavel.
 */
export function renderTabelaTurmas(): void {
  const cont = tryById('searchTurmasDash');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchTurmasDash', cfgTurmasDash, renderTabelaTurmas);
  }

  const vals = lerFiltros(cfgTurmasDash);
  const hoje = new Date().toISOString().split('T')[0];

  let turmas: Array<Turma & { _status: StatusTurma }> = getTurmas().map((t) => ({
    ...t,
    _status: calcStatus(t),
  }));

  turmas = filtrarLista(turmas, vals['_busca'], ['nome', 'curso']);
  if (vals['turno']) turmas = turmas.filter((t) => t.turno === vals['turno']);
  if (vals['_status']) {
    turmas = turmas.filter((t) => t._status === vals['_status']);
  }

  const cnt = tryById('countTurmasDash');
  if (cnt !== null) cnt.textContent = `${turmas.length} turma(s)`;

  const tbody = tryById<HTMLTableSectionElement>('tabelaTurmas')?.querySelector('tbody');
  if (tbody === null || tbody === undefined) return;

  if (turmas.length === 0) {
    tbody.innerHTML =
      '<tr class="empty-row"><td colspan="7">Nenhuma turma encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = turmas.map((t) => linhaTurma(t, hoje)).join('');
}

/** Reexportado para manter o nome historico usado por outros modulos. */
export { fmtData as formatDate };

/** Tipo auxiliar exportado para testes e consumidores do modulo. */
export type { Turno };