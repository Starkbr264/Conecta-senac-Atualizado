import type { Turno } from '../../types';

/**
 * Retorna a interseção entre os turnos atendidos pela sala e os turnos
 * permitidos pela turma. A lista da turma aceita mais de um turno para manter
 * o frontend compatível caso o modelo evolua nesse sentido.
 */
export function turnosCompativeisComTurma(
  turnosSala: readonly Turno[],
  turnosTurma?: readonly string[] | null,
): Turno[] {
  if (!turnosTurma || turnosTurma.length === 0) return [...turnosSala];
  const permitidos = new Set(turnosTurma.map((turno) => turno.toLowerCase()));
  return turnosSala.filter((turno) => permitidos.has(turno.toLowerCase()));
}
