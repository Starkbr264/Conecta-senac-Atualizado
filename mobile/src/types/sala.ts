// Tipos de status de sala — extraidos de SalaCard.tsx (componente morto).
// Usados por salaStatus.ts para calcular o status de ocupacao.

import { StatusSala } from '@/types';

export type Periodo = {
  turno: string;
  turmaNome: string;
  instNome: string | null;
  stat: 'ocupada' | 'iminente';
  hora?: string;
};

export type SalaInfo = {
  stat: StatusSala;
  periodos: Periodo[];
};
