/** Regra única de cálculo do estado visual de uma sala no web. */

import {
  getOverride,
  getReservas,
  getTurmaById,
  getUserById,
  type OverrideSala,
} from '../../core/storage';
import { calcStatus } from '../../core/format';
import type { DiaSemana, Reserva, Sala, StatusSala } from '../../types';

export interface PeriodoSala {
  turno: string;
  turmaNome: string;
  instNome: string | null;
  stat: 'ocupada' | 'iminente';
  hora?: string;
}

export interface SalaStatusInfo {
  stat: StatusSala;
  periodos: PeriodoSala[];
  override: OverrideSala | null;
}

const DIA_MAP: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export function diaDaSemanaDe(data: string): DiaSemana {
  const [ano, mes, dia] = data.split('-').map(Number);
  return DIA_MAP[new Date(ano, mes - 1, dia).getDay()];
}

function reservaAtivaNoDia(r: Reserva, hoje: string, dia: DiaSemana): boolean {
  if (r.status !== 'ATIVA') return false;
  if (r.dataInicio > hoje || r.dataFim < hoje) return false;
  if (r.datasEspecificas?.length) return r.datasEspecificas.includes(hoje);
  return Boolean(r.diasSemana?.includes(dia));
}

function classificarReserva(r: Reserva): PeriodoSala | null {
  if (r.avulsa || !r.turmaId) {
    const instrutor = r.instrutorId ? getUserById(r.instrutorId) : null;
    return {
      turno: r.turno,
      turmaNome: 'Sem turma',
      instNome: instrutor?.nome ?? null,
      stat: 'ocupada',
      hora: r.horaInicio && r.horaFim ? `${r.horaInicio} - ${r.horaFim}` : undefined,
    };
  }

  const turma = getTurmaById(r.turmaId);
  const turmaStatus = calcStatus(turma);
  if (turmaStatus === 'encerrada') return null;

  const instrutor = r.instrutorId
    ? getUserById(r.instrutorId)
    : turma?.instrutorId
      ? getUserById(turma.instrutorId)
      : null;

  return {
    turno: r.turno,
    turmaNome: turma?.nome ?? '—',
    instNome: instrutor?.nome ?? null,
    stat: turmaStatus === 'ativa' ? 'ocupada' : 'iminente',
    hora: r.horaInicio && r.horaFim ? `${r.horaInicio} - ${r.horaFim}` : undefined,
  };
}

/**
 * Calcula o estado efetivo da sala.
 *
 * `statusManual` não preenchido devolve o controle às reservas. Os estados
 * de bloqueio retornam diretamente e nunca são rebaixados para `livre`.
 */
export function calcularStatusSala(sala: Sala, hoje: string, turnoFiltro = ''): SalaStatusInfo {
  const override = getOverride(sala.id, sala.unidadeId);
  if (override) {
    const periodos =
      override.status === 'ocupada' || override.status === 'iminente'
        ? [{
            turno: 'Manual',
            turmaNome: override.motivo || 'Status manual',
            instNome: override.por || null,
            stat: override.status,
          }]
        : [];
    return { stat: override.status, periodos, override };
  }

  const dia = diaDaSemanaDe(hoje);
  const periodos: PeriodoSala[] = [];
  for (const reserva of getReservas()) {
    if (reserva.salaId !== sala.id || reserva.unidadeId !== sala.unidadeId) continue;
    if (turnoFiltro && reserva.turno !== turnoFiltro) continue;
    if (!reservaAtivaNoDia(reserva, hoje, dia)) continue;
    const periodo = classificarReserva(reserva);
    if (!periodo) continue;

    const repetido = periodos.some(
      (existente) =>
        existente.turno === periodo.turno &&
        existente.turmaNome === periodo.turmaNome &&
        existente.instNome === periodo.instNome,
    );
    if (!repetido) periodos.push(periodo);
  }

  const stat: StatusSala = periodos.some((p) => p.stat === 'ocupada')
    ? 'ocupada'
    : periodos.length
      ? 'iminente'
      : 'livre';
  return { stat, periodos, override: null };
}
