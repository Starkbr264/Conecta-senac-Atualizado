/*
 * salaStatus.ts — Calcula o status de ocupação de uma sala.
 *
 * REGRA DE OCUPACAO — espelhada em
 * `web/src/features/dashboard/disponibilidade.ts` (`statusDaSala`). Os dois
 * arquivos aplicam exatamente a mesma regra; se mudar aqui, mude la. Passo a
 * passo:
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
 * A filtragem por `Unidade` e feita por quem chama (que ja filtra a lista de
 * salas antes de pedir o status), mantendo esta funcao pura.
 *
 * ATENCAO: no legado este arquivo NAO filtrava `status === 'ATIVA'`, ou seja,
 * uma reserva `CANCELADA` ainda marcava a sala como ocupada. Corrigido aqui
 * para casar com o web e com o Java (`ReservaService.validarDisponibilidade`
 * ignora `CANCELADA`).
 *
 * Usado pelo mapa de salas (coordenador e recepção) e pelo SalaCard.
 */

import { Sala, Reserva } from '@/types';
import { SalaInfo, Periodo } from '@/components/SalaCard';
import * as db from '@/services/storage';

/**
 * Classifica uma unica reserva dentro da regra unificada. Retorna `null`
 * quando a reserva nao ocupa a sala.
 */
function classificarReserva(r: Reserva, hoje: string, dia: string): Periodo | null {
  if (r.status !== 'ATIVA') return null;
  if ((r.dataInicio ?? '') > hoje || (r.dataFim ?? '') < hoje) return null;
  if (!(r.diasSemana ?? []).includes(dia as never)) return null;

  let pStat: 'ocupada' | 'iminente';
  let pTurma: string;
  let pInst: string | null;

  if (r.avulsa || !r.turmaId) {
    pStat = 'ocupada';
    pTurma = 'Sem turma';
    const iA = r.instrutorId ? db.getUserById(r.instrutorId) : null;
    pInst = iA?.nome ?? null;
  } else {
    const turma = db.getTurmaById(r.turmaId);
    const cst = db.calcStatus(turma);
    if (cst === 'encerrada') return null;
    pStat = cst === 'ativa' ? 'ocupada' : 'iminente';
    pTurma = turma?.nome ?? '-';
    const inst = r.instrutorId
      ? db.getUserById(r.instrutorId)
      : (turma?.instrutorId ? db.getUserById(turma.instrutorId) : null);
    pInst = inst?.nome ?? null;
  }

  const hora = r.horaInicio && r.horaFim ? `${r.horaInicio} - ${r.horaFim}` : undefined;
  return { turno: r.turno, turmaNome: pTurma, instNome: pInst, stat: pStat, hora };
}

// Calcula o status de ocupacao de uma sala hoje (espelha statusDaSala do web)
export function calcSalaInfo(sala: Sala, hoje: string): SalaInfo {
  // 1. Override manual tem prioridade (espelha getOverride do web)
  if (sala.statusManual) {
    const bruto = sala.statusManual;
    const manualStat = bruto === 'ocupada' || bruto === 'iminente' ? bruto : 'livre';
    const periodos = manualStat !== 'livre'
      ? [{ turno: 'Manual', turmaNome: sala.motivoManual || 'Status manual', instNome: sala.manualPor || '', stat: manualStat as 'ocupada' | 'iminente' }]
      : [];
    return { stat: manualStat, periodos };
  }

  const rs = db.getReservas().filter(
    r => r.salaId === sala.id && r.dataInicio <= hoje && r.dataFim >= hoje
  );
  const dia = db.diaDaSemana(hoje);
  const periodos: Periodo[] = [];

  rs.forEach(r => {
    const p = classificarReserva(r, hoje, dia);
    if (!p) return;
    // Deduplica: nao adiciona periodo repetido
    const existe = periodos.some(q => q.turno === p.turno && q.turmaNome === p.turmaNome && q.instNome === p.instNome);
    if (!existe) periodos.push(p);
  });

  const stat = periodos.some(p => p.stat === 'ocupada')
    ? 'ocupada'
    : periodos.length > 0 ? 'iminente' : 'livre';

  return { stat, periodos };
}
