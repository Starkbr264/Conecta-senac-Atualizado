/**
 * Verificacao de disponibilidade de sala (`dashboard.html`, secao
 * "Disponibilidade").
 *
 * Migrado de `_js_original/disponibilidade.js`.
 *
 * REGRA DE OCUPACAO — espelhada em `mobile/src/utils/salaStatus.ts`
 * (`calcSalaInfo`). Os dois arquivos aplicam exatamente a mesma regra; se
 * mudar aqui, mude la. Passo a passo:
 *
 *   1. `Sala.statusManual` tem precedencia absoluta (override do coordenador).
 *      Vale `'livre'`, `'ocupada'` ou `'iminente'`; qualquer outro valor cai
 *      em `'livre'`.
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

import { getReservas, getSalas, getSalaById, getTurmaById, getUserById } from '../../core/storage';
import { calcStatus, escapeHtml, fmtData as formatDate, hojeISO } from '../../core/format';
import { byId } from '../../core/dom';
import { getSessao } from '../../core/theme';
import type { DiaSemana, Reserva, Sala, StatusSala } from '../../types';

const DIA_MAP: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

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

/** Dia da semana (`'dom'`..`'sab'`) de uma data `YYYY-MM-DD` local. */
function diaDaSemanaDe(dataStr: string): DiaSemana {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return DIA_MAP[new Date(ano, mes - 1, dia).getDay()];
}

/** Um turno ocupado num dia, com a turma/instrutor responsaveis. */
export interface Periodo {
  turno: string;
  turmaNome: string;
  instNome: string | null;
  stat: 'ocupada' | 'iminente';
  hora?: string;
}

export interface InfoSala {
  stat: StatusSala;
  periodos: Periodo[];
}

/**
 * Classifica uma unica reserva dentro da regra unificada. Retorna `null`
 * quando a reserva nao ocupa a sala (fora do periodo, dia errado, turma
 * encerrada ou reserva cancelada).
 */
function classificarReserva(r: Reserva, hoje: string, dia: DiaSemana): Periodo | null {
  if (r.status !== 'ATIVA') return null;
  if ((r.dataInicio ?? '') > hoje || (r.dataFim ?? '') < hoje) return null;
  if (!(r.diasSemana ?? []).includes(dia)) return null;

  let pStat: 'ocupada' | 'iminente';
  let pTurma: string;
  let pInst: string | null;

  if (r.avulsa || !r.turmaId) {
    pStat = 'ocupada';
    pTurma = 'Sem turma';
    const iA = r.instrutorId ? getUserById(r.instrutorId) : null;
    pInst = iA?.nome ?? null;
  } else {
    const turma = getTurmaById(r.turmaId);
    const cst = calcStatus(turma);
    if (cst === 'encerrada') return null;
    pStat = cst === 'ativa' ? 'ocupada' : 'iminente';
    pTurma = turma?.nome ?? '-';
    const inst = r.instrutorId
      ? getUserById(r.instrutorId)
      : (turma?.instrutorId ? getUserById(turma.instrutorId) : null);
    pInst = inst?.nome ?? null;
  }

  const hora = r.horaInicio && r.horaFim ? `${r.horaInicio} - ${r.horaFim}` : undefined;
  return { turno: r.turno, turmaNome: pTurma, instNome: pInst, stat: pStat, hora };
}

/**
 * Aplica a regra unificada a uma sala. E a mesma funcao que
 * `mobile/src/utils/salaStatus.ts` expoe como `calcSalaInfo`.
 */
export function statusDaSala(sala: Sala, hoje: string): InfoSala {
  // 1. Override manual tem precedencia absoluta.
  if (sala.statusManual) {
    const bruto = sala.statusManual;
    const manualStat: StatusSala =
      bruto === 'ocupada' || bruto === 'iminente' ? bruto : 'livre';
    const periodos: Periodo[] =
      manualStat !== 'livre'
        ? [{
            turno: 'Manual',
            turmaNome: sala.motivoManual || 'Status manual',
            instNome: sala.manualPor || '',
            stat: manualStat as 'ocupada' | 'iminente',
          }]
        : [];
    return { stat: manualStat, periodos };
  }

  const dia = diaDaSemanaDe(hoje);
  const periodos: Periodo[] = [];

  for (const r of getReservas()) {
    if (r.salaId !== sala.id) continue;
    const p = classificarReserva(r, hoje, dia);
    if (!p) continue;
    // Deduplica periodo repetido (mesma turma+instrutor+turno).
    const existe = periodos.some(
      (q) => q.turno === p.turno && q.turmaNome === p.turmaNome && q.instNome === p.instNome,
    );
    if (!existe) periodos.push(p);
  }

  const stat: StatusSala = periodos.some((p) => p.stat === 'ocupada')
    ? 'ocupada'
    : periodos.length > 0
      ? 'iminente'
      : 'livre';

  return { stat, periodos };
}

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
