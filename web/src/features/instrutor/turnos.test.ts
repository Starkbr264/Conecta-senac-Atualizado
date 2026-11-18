import { describe, expect, it } from 'vitest';
import { turnosCompativeisComTurma } from './turnos';

describe('turnosCompativeisComTurma', () => {
  const sala = ['Matutino', 'Vespertino', 'Noturno'] as const;

  it('mantém somente o turno permitido pela turma', () => {
    expect(turnosCompativeisComTurma(sala, ['Matutino'])).toEqual(['Matutino']);
  });

  it('respeita múltiplos turnos quando o modelo os fornecer', () => {
    expect(turnosCompativeisComTurma(sala, ['Matutino', 'Noturno'])).toEqual([
      'Matutino',
      'Noturno',
    ]);
  });

  it('retorna vazio quando não há interseção', () => {
    expect(turnosCompativeisComTurma(['Matutino'], ['Noturno'])).toEqual([]);
  });
});
