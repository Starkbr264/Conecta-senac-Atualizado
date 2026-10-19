/**
 * Gestao de salas do painel publico (`dashboard.html`).
 *
 * Migrado de `_js_original/salas.js`.
 *
 * NOTA SOBRE CÓDIGO REMOVIDO: o arquivo original definia `renderTabelaSalas`
 * duas vezes — a segunda versao sobrescrevia a primeira atraves de
 * `var _renderTabelaSalasOrig = renderTabelaSalas; renderTabelaSalas = function(){...}`.
 * A variavel `_renderTabelaSalasOrig` nunca era chamada, ou seja, a primeira
 * versao virou codigo morto assim que o arquivo era avaliado. Aqui portamos
 * somente a versao efetiva (com barra de busca e filtros).
 */

import {
  addSala,
  deleteSala,
  getReservas,
  getSalas,
  updateSala,
} from '../../core/storage';
import { showMsg, showToast } from '../../core/ui';
import { escapeHtml } from '../../core/format';
import {
  filtrarLista,
  lerFiltros,
  montarBarraPesquisaFiltros,
  type ConfigBarraFiltros,
} from '../../core/filters';
import { byId, qsa, tryById } from '../../core/dom';
import type { Turno } from '../../types';

/** Id da sala em edicao, ou `null` quando o formulario esta em modo cadastro. */
let salaEditId: number | null = null;

/** Configuracao da barra de busca/filtros da secao "Salas". */
const cfgSalasDash: ConfigBarraFiltros = {
  busca: { id: 'buscarSalaD', placeholder: 'Pesquisar por nome ou tipo…' },
  filtros: [
    {
      id: 'filtTipoSalaD',
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
    {
      id: 'filtTurnoSalaD',
      label: 'Turno disponível',
      campo: '_turno',
      opcoes: [
        { value: 'Matutino', label: 'Matutino' },
        { value: 'Vespertino', label: 'Vespertino' },
        { value: 'Noturno', label: 'Noturno' },
      ],
    },
  ],
};

/** Liga os listeners do formulario de salas. */
export function initSalas(): void {
  renderTabelaSalas();

  byId<HTMLFormElement>('formSala').addEventListener('submit', (e) => {
    e.preventDefault();
    salvarSala();
  });

  qsa('.turno-chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      chip.classList.toggle('checked');
    });
  });
}

interface DadosSala {
  nome: string;
  capacidade: number;
  tipo: string;
  turnosDisponiveis: Turno[];
}

/** Le e valida o formulario de sala. */
function lerDadosSala(): { dados: DadosSala; erros: string[] } {
  const turnos: Turno[] = [];
  qsa('.turno-chip.checked').forEach((c) => {
    turnos.push((c as HTMLElement).dataset.val as Turno);
  });

  const nome = byId<HTMLInputElement>('salaNome').value.trim();
  const capacidade = parseInt(byId<HTMLInputElement>('salaCapacidade').value, 10);
  const tipo = byId<HTMLSelectElement>('salaTipo').value;

  const erros: string[] = [];
  if (!nome) erros.push('Informe o nome/número da sala.');
  if (!capacidade) erros.push('Informe a capacidade.');
  if (turnos.length === 0) erros.push('Selecione ao menos um turno disponível.');

  return { dados: { nome, capacidade, tipo, turnosDisponiveis: turnos }, erros };
}

/** Persiste a sala (cadastro ou edicao). */
export function salvarSala(): void {
  const { dados, erros } = lerDadosSala();

  if (erros.length > 0) {
    showMsg('msgSala', 'error', erros.join(' '));
    return;
  }

  if (salaEditId) {
    updateSala(salaEditId, dados);
    showToast('Sala atualizada com sucesso!', 'success');
    cancelarEdicaoSala();
  } else {
    addSala(dados);
    showToast('Sala cadastrada com sucesso!', 'success');
  }

  byId<HTMLFormElement>('formSala').reset();
  qsa('.turno-chip').forEach((c) => c.classList.remove('checked'));
  const msg = tryById('msgSala');
  if (msg !== null) msg.style.display = 'none';
  renderTabelaSalas();
}

/** Carrega uma sala no formulario para edicao. */
export function editarSala(id: number): void {
  const sala = getSalas().find((s) => s.id === id);
  if (!sala) return;

  salaEditId = id;

  byId<HTMLInputElement>('salaNome').value = sala.nome;
  byId<HTMLInputElement>('salaCapacidade').value = String(sala.capacidade ?? '');
  byId<HTMLSelectElement>('salaTipo').value = sala.tipo ?? '';

  const turnos = sala.turnosDisponiveis ?? sala.turnos ?? [];
  qsa('.turno-chip').forEach((c) => {
    c.classList.toggle('checked', turnos.includes((c as HTMLElement).dataset.val as Turno));
  });

  byId<HTMLButtonElement>('btnSalvarSala').textContent = 'Atualizar Sala';
  byId('btnCancelarSala').style.display = 'inline-flex';
  byId<HTMLInputElement>('salaNome').focus();
  byId('section-salas').scrollIntoView({ behavior: 'smooth' });
}

/** Sai do modo de edicao e limpa o formulario. */
export function cancelarEdicaoSala(): void {
  salaEditId = null;
  byId<HTMLFormElement>('formSala').reset();
  qsa('.turno-chip').forEach((c) => c.classList.remove('checked'));
  byId<HTMLButtonElement>('btnSalvarSala').textContent = '+ Cadastrar Sala';
  byId('btnCancelarSala').style.display = 'none';
  const msg = tryById('msgSala');
  if (msg !== null) msg.style.display = 'none';
}

/** Exclui uma sala, bloqueando quando existem reservas ativas. */
export function excluirSala(id: number): void {
  const reservasVinculadas = getReservas().filter(
    (r) => r.salaId === id && r.status === 'ATIVA',
  );
  if (reservasVinculadas.length > 0) {
    showToast(
      `Não é possível excluir: sala tem ${reservasVinculadas.length} reserva(s) ativa(s).`,
      'error',
    );
    return;
  }
  if (!confirm('Excluir esta sala? Esta ação não pode ser desfeita.')) return;
  deleteSala(id);
  showToast('Sala excluída.', 'warning');
  renderTabelaSalas();
}

/** Monta a linha HTML de uma sala na tabela. */
function linhaSala(s: ReturnType<typeof getSalas>[number]): string {
  const turnos = s.turnosDisponiveis ?? s.turnos ?? [];
  return `
    <tr>
      <td><strong>${escapeHtml(s.nome)}</strong></td>
      <td>${s.capacidade} pessoas</td>
      <td><span class="badge badge-primary">${s.tipo}</span></td>
      <td>${turnos
        .map(
          (t) =>
            `<span class="badge badge-warning" style="margin-right:4px">${t}</span>`,
        )
        .join('')}</td>
      <td>
        <button class="btn btn-warning-sm" data-action="editarSala" data-arg="${s.id}">Editar</button>
        <button class="btn btn-danger-sm"  data-action="excluirSala" data-arg="${s.id}">Excluir</button>
      </td>
    </tr>`;
}

/**
 * Renderiza a tabela de salas aplicando os filtros da barra de busca.
 *
 * No legado esta era a funcao sobrescrita pelo "monkey-patch"; aqui e a
 * unica implementacao exported, porque a versao anterior ja era inalcancavel.
 */
export function renderTabelaSalas(): void {
  const cont = tryById('searchSalasDash');
  if (cont !== null && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchSalasDash', cfgSalasDash, renderTabelaSalas);
  }

  const vals = lerFiltros(cfgSalasDash);
  let salas = getSalas().map((s) => ({
    ...s,
    _turno: (s.turnosDisponiveis ?? s.turnos ?? []).join(','),
  }));

  salas = filtrarLista(salas, vals['_busca'], ['nome', 'tipo']);
  if (vals['tipo']) salas = salas.filter((s) => s.tipo === vals['tipo']);
  if (vals['_turno']) {
    salas = salas.filter((s) =>
      (s.turnosDisponiveis ?? s.turnos ?? []).includes(vals['_turno'] as Turno),
    );
  }

  const cnt = tryById('countSalasDash');
  if (cnt !== null) cnt.textContent = `${salas.length} sala(s)`;

  const tbody = tryById<HTMLTableSectionElement>('tabelaSalas')
    ?.querySelector('tbody');
  if (tbody === null || tbody === undefined) return;

  if (salas.length === 0) {
    tbody.innerHTML =
      '<tr class="empty-row"><td colspan="5">Nenhuma sala encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = salas.map(linhaSala).join('');
}