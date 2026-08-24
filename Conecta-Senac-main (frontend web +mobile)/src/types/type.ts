// src/types/index.ts

export interface Sessao {
  id: string;
  perfil: 'admin' | 'coordenador' | 'recepcao' | 'instrutor';
  unidadeId: string;
}

export interface Sala {
  id: string;
  nome: string;
}

export interface Turma {
  id: string;
  nome?: string;
  codigo?: string;
  curso?: string;
  instrutorId?: string;
}

export interface Usuario {
  id: string;
  nome: string;
}

export interface Reserva {
  id: string;
  dataInicio: string; // Formato YYYY-MM-DD
  dataFim: string;    // Formato YYYY-MM-DD
  diasSemana: string[]; // Ex: ['seg', 'ter']
  turno: 'Matutino' | 'Vespertino' | 'Noturno';
  salaId: string;
  turmaId?: string;
  instrutorId?: string;
  unidadeId: string;
  avulsa?: boolean;
}

export interface EstadoCalendario {
  ano: number;
  mes: number;
  vista: 'mes' | 'semana';
  diaSel: Date;
  semBase: Date;
  filtSala: string;
  filtTurno: string;
}