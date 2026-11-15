/**
 * Verificacao de disponibilidade de sala (`dashboard.html`, secao
 * "Disponibilidade").
 *
 * Migrado de `_js_original/disponibilidade.js`.
 *
 * REGRA DE OCUPACAO — centralizada em `../mapa/sala-status.ts` e espelhada
 * pelo mobile em `mobile/src/utils/salaStatus.ts` (`calcSalaInfo`).
 *
 *   1. `Sala.statusManual` tem precedencia absoluta (override do coordenador).
 *      Os cinco estados visuais persistidos sao respeitados.
 *   2. Senao, considera apenas reservas com `status === 'ATIVA'` (uma reserva
 *      `CANCELADA` NAO ocupa sala), cujo periodo (`dataInicio`..`dataFim`)
 *      contem a data consultada e cujo `diasSemana` inclui o dia da semana.
 *   3. Cada reserva e classificada:
 *        - avulsa (`avulsa` ou sem `turmaId`)  -> `'ocupada'`, turma "Sem turma"
 *        - turma `encerrada`                    -> reserva ignorada
 *        - turma `ativa`                        -> `'ocupada'`
 *        - turma `iminente`/`posterior`         -> `'iminente'`
 *   4. Status final: `'ocupada'` se algum periodo ocupado; senao `'iminente'`
 *      se houver periodo; senao `'livre'`.
 *
 * A filtragem por `Unidade` e aplicada na lista de salas: quando existe sessao
 * com `unidadeId`, so aparecem salas daquela unidade. Sem sessao (pagina de
 * demonstracao) a lista e completa, como no legado.
 */

import { getSalas, getSalaById } from '../../core/storage';
import { escapeHtml, fmtData as formatDate, hojeISO, labelSalaStatus } from '../../core/format';
import { byId } from '../../core/dom';
import { getSessao } from '../../core/theme';
import { calcularStatusSala, diaDaSemanaDe, type SalaStatusInfo } from '../mapa/sala-status';
import type { DiaSemana, Sala } from '../../types';

const NOMES_DIA: Record<DiaSemana, string> = {
  dom: 'Domingo',
  seg: 'Segunda-feira',
  ter: 'Terça-feira',
  qua: 'Quarta-feira',
  qui: 'Quinta-feira',
  sex: 'Sexta-feira',
  sab: 'Sábado',
};

/** Nome completo do dia a partir da abreviatura persistida. */
export function diaNomeCompleto(abrev: string): string {
  return NOMES_DIA[abrev as DiaSemana] ?? abrev;
}

export type InfoSala = SalaStatusInfo;

/** Compatibilidade para consumidores da seção de disponibilidade. */
export const statusDaSala = calcularStatusSala;

/** Liga os listeners da secao de disponibilidade. */
export function initDisponibilidade(): void {
  popularSelectDispSalas();

  const hoje = hojeISO();
  byId<HTMLInputElement>('dispData').value = hoje;

  byId<HTMLButtonElement>('btnVerificar').addEventListener(
    'click',
    verificarDisponibilidade,
  );
  byId<HTMLInputElement>('dispData').addEventListener(
    'change',
    verificarDisponibilidade,
  );
  byId<HTMLSelectElement>('dispSala').addEventListener(
    'change',
    verificarDisponibilidade,
  );
  byId<HTMLSelectElement>('dispTurno').addEventListener(
    'change',
    verificarDisponibilidade,
  );
}

/**
 * Preenche o select de salas da secao de disponibilidade.
 *
 * Com sessao logada, filtra pela `unidadeId` do usuario; sem sessao (pagina
 * de demonstracao) lista todas, como no legado.
 */
export function popularSelectDispSalas(): void {
  const sel = byId<HTMLSelectElement>('dispSala');
  sel.innerHTML = '<option value="">— Selecione uma sala —</option>';
  const unidadeId = getSessao()?.unidadeId;
  getSalas()
    .filter((s) => !unidadeId || s.unidadeId === unidadeId)
    .forEach((s) => {
      const o = document.createElement('option');
      o.value = String(s.id);
      o.textContent = `${s.nome} (${s.tipo})`;
      sel.appendChild(o);
    });
}

/** Limpa o resultado e repopula as salas (usado ao trocar de secao). */
export function refreshDisponibilidade(): void {
  popularSelectDispSalas();
  byId('resultadoDisponibilidade').className = 'disp-result';
}

/** Verifica se a sala esta livre/iminente/ocupada na data+turno selecionados. */
export function verificarDisponibilidade(): void {
  const salaId = parseInt(byId<HTMLSelectElement>('dispSala').value, 10);
  const turno = byId<HTMLSelectElement>('dispTurno').value;
  const dataStr = byId<HTMLInputElement>('dispData').value;
  const result = byId('resultadoDisponibilidade');

  if (!salaId || !dataStr) {
    result.className = 'disp-result';
    return;
  }

  const sala = getSalaById(salaId);
  const info = statusDaSala(sala as Sala, dataStr);
  const diaAbrev = diaDaSemanaDe(dataStr);

  // O turno escolhido no filtro decide qual periodo exibir; sem turno escolhido
  // mostra o status geral da sala naquele dia.
  const periodos = turno
    ? info.periodos.filter((p) => p.turno === turno || p.turno === 'Manual')
    : info.periodos;

  const titulo = `${sala?.nome ?? 'Sala'} — ${turno || 'todos os turnos'} — ${formatDate(dataStr)} (${diaNomeCompleto(diaAbrev)})`;

  if (info.stat === 'manutencao' || info.stat === 'indisponivel') {
    result.className = `disp-result ${info.stat}`;
    result.innerHTML = `
      <span class="disp-icon"><i class="ph ${info.stat === 'manutencao' ? 'ph-wrench' : 'ph-prohibit'}"></i></span>
      <div>
        <strong>${labelSalaStatus(info.stat)}</strong>
        <div style="font-size:.88rem;font-weight:400;margin-top:4px;opacity:.85">
          ${escapeHtml(titulo)}
        </div>
      </div>`;
    return;
  }

  if (info.stat === 'livre' || periodos.length === 0) {
    result.className = 'disp-result livre';
    result.innerHTML = `
      <span class="disp-icon"><i class="ph ph-check-circle"></i></span>
      <div>
        <strong>LIVRE</strong>
        <div style="font-size:.88rem;font-weight:400;margin-top:4px;opacity:.8">
          ${escapeHtml(titulo)}
        </div>
      </div>`;
    return;
  }

  const ocupadas = periodos.filter((p) => p.stat === 'ocupada');
  const iminentes = periodos.filter((p) => p.stat === 'iminente');

  if (ocupadas.length > 0) {
    result.className = 'disp-result ocupada';
    result.innerHTML = `
      <span class="disp-icon"><i class="ph ph-x-circle"></i></span>
      <div>
        <strong>OCUPADA</strong>
        <div style="font-size:.88rem;font-weight:400;margin-top:4px;opacity:.9">
          ${escapeHtml(titulo)}<br>
          Turma: ${ocupadas.map((p) => escapeHtml(p.turmaNome)).join('; ')}
        </div>
      </div>`;
    return;
  }

  result.className = 'disp-result iminente';
  result.innerHTML = `
    <span class="disp-icon"><i class="ph ph-clock"></i></span>
    <div>
      <strong>EM BREVE</strong>
      <div style="font-size:.88rem;font-weight:400;margin-top:4px;opacity:.9">
        ${escapeHtml(titulo)}<br>
        ${iminentes.map((p) => escapeHtml(p.turmaNome)).join('; ')}
      </div>
    </div>`;
}
