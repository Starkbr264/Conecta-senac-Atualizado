export type Perfil = 'admin' | 'coordenador' | 'instrutor' | 'recepcao';
export type StatusTurma = 'ativa' | 'iminente' | 'posterior' | 'encerrada';
export type StatusSala = 'ocupada' | 'livre' | 'iminente';
export type StatusChave = 'disponivel' | 'pega';
export type StatusSolic = 'pendente' | 'aprovada' | 'recusada';
export type Turno = 'Matutino' | 'Vespertino' | 'Noturno';
export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';
export type ModoData = 'unica' | 'periodo' | 'especificas';

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
  unidadeId: number;
};

export type Sessao = Usuario;

export type Unidade = {
  id: number;
  nome: string;
  cep: string;
  cidade: string;
  endereco: string;
};

export type Sala = {
  id: number;
  nome: string;
  tipo: string;
  capacidade: number;
  andar: string;
  bloco: string;
  turnosDisponiveis: Turno[];
  unidadeId: number;
  // Override manual de status (espelha statusManual/motivoManual/manualPor do web)
  statusManual?: string | null;
  motivoManual?: string;
  manualPor?: string;
  manualCriadaEm?: string | null;
};

export type Turma = {
  id: number;
  nome: string;
  codigo: string;
  curso: string;
  turno: Turno;
  dataInicio: string;
  dataFim: string;
  instrutorId: number | null;
  unidadeId: number;
};

export type Reserva = {
  id: number;
  salaId: number;
  turmaId: number | null;
  turno: Turno;
  diasSemana: DiaSemana[];
  dataInicio: string;
  dataFim: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  instrutorId?: number | null;
  unidadeId: number;
  avulsa?: boolean;
  status?: string;
};

export type Chave = {
  id: number;
  codigo: string;
  salaId: number;
  andar: string;
  status: StatusChave;
  instrutorId: number | null;
  pegaEm: string | null;
  unidadeId: number;
};

export type Solicitacao = {
  id: number;
  salaId: number;
  instrutorId: number;
  turmaId?: number | null;
  turnos: Turno[];
  data: string;
  dataInicio?: string;
  dataFim?: string;
  diasSemana?: DiaSemana[] | null;
  datasEspecificas?: string[] | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  motivo?: string;
  modo?: ModoData;
  turno?: Turno;
  status: StatusSolic;
  unidadeId: number;
  criadaEm: string;
  respondidaEm?: string;
  resposta?: string;
};

export type Notificacao = {
  id: number;
  tipo: string;
  titulo: string;
  msg: string;
  paraPerfil: string;
  paraId: number | null;
  unidadeId: number | null;
  lida: boolean;
  criadaEm: string;
};

export type EstadoCalendario = {
  ano: number;
  mes: number;
  vista: 'mes' | 'semana';
  diaSel: Date;
  semBase: Date;
  filtSala: string;
  filtTurno: string;
};
