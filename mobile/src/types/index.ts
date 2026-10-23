/**
 * Contratos de dados do Conecta-Senac (mobile).
 *
 * ESTE ARQUIVO E ESPELHADO EM `web/src/types/index.ts`. As definicoes de
 * unioes, entidades, DTOs e formas de rede DEVEM permanecer identicas nos
 * dois projetos — os dois frontends consomem o mesmo backend (Spring Boot
 * com Postgres/Supabase, ou o servidor Node em desenvolvimento). Antes de
 * mudar um campo aqui, mude la tambem.
 *
 * Tres fontes de verdade, em ordem de precedencia:
 *   1. `backend/demo/src/main/java/conecta/demo/model/` e `dto/`
 *      — o contrato Java e a referencia para NOMES de campos e valores de
 *        enumeracao (`Perfil`, `StatusChave`, `StatusSolicitacao`). Nenhum
 *        nome de propriedade pode mudar aqui sem mudar o JSON do backend.
 *   2. `server/seed.js` — o que o servidor Node realmente entrega em
 *        desenvolvimento (em producao o front fala com a API Java).
 *   3. campos marcados como `LEGADO` — existem apenas no web legado e no
 *        servidor Node, NAO existem no Java. Mantidos por compatibilidade
 *        com o cache/offline ja persistido.
 *
 * Regra de ouro: **alinhar tipagem e opcionalidade, nunca renomear chaves.**
 * Um campo `?` aqui significa "pode vir ausente no JSON"; isso NAO altera o
 * que o backend responde — apenas deixa o TS honesto sobre o que pode faltar.
 */

// ---------------------------------------------------------------------------
// Enumeracoes
// ---------------------------------------------------------------------------

/**
 * Espelha `backend/.../model/Perfil.java` (enum `ADMIN, COORDENADOR,
 * INSTRUTOR, RECEPCAO`). A classe usa `@JsonValue` com
 * `name().toLowerCase(Locale.ROOT)`, logo no JSON sempre vem minusculo.
 */
export type Perfil = 'admin' | 'coordenador' | 'instrutor' | 'recepcao';

/** Alias herdado do mobile. Mantido para nao quebrar importacoes existentes. */
export type StatusSolic = StatusSolicitacao;

/**
 * Espelha `backend/.../model/StatusSolicitacao.java` (`PENDENTE, APROVADA,
 * RECUSADA`), `@JsonValue` minusculo -> `'pendente' | 'aprovada' | 'recusada'`.
 */
export type StatusSolicitacao = 'pendente' | 'aprovada' | 'recusada';

/** Decisao aceita por `RespostaSolicitacaoRequest.decisao` (texto livre). */
export type DecisaoSolicitacao = 'aprovar' | 'recusar';

/**
 * Espelha `backend/.../model/StatusChave.java` (`DISPONIVEL, RETIRADA`).
 * O `@JsonValue` da classe mapeia `DISPONIVEL -> "disponivel"` e
 * `RETIRADA -> "pega"` — NAO eh o nome do enum.
 */
export type StatusChave = 'disponivel' | 'pega';

/**
 * O Java guarda `Reserva.status` como `String` com default `"ATIVA"` — NAO eh
 * um enum. No servidor Node o valor e sempre `'ATIVA' | 'CANCELADA'`.
 */
export type StatusReserva = 'ATIVA' | 'CANCELADA';

/**
 * O Java guarda `Turma.turno` como `String` (`@NotBlank`), NAO como enum.
 * No servidor Node apenas estes tres valores sao emitidos.
 */
export type Turno = 'Matutino' | 'Vespertino' | 'Noturno';

/** Aceita tambem a versao minuscula, que o formulario do web legado grava. */
export type TurnoInput = Turno | 'matutino' | 'vespertino' | 'noturno';

/** `Reserva.diasSemana` / `Solicitacao.diasSemana` (tabelas de juncao). */
export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

/** `Solicitacao.modo` — o Java guarda como `String`. */
export type ModoDataSolicitacao = 'unica' | 'periodo' | 'especificas';

/** Alias herdado do mobile. */
export type ModoData = ModoDataSolicitacao;

/** `Notificacao.tipo` — o Java guarda como `String` (`@NotBlank`). */
export type TipoNotificacao = 'info' | 'ok' | 'sucesso' | 'aviso' | 'erro';

/**
 * Status de ocupacao de sala. O Java NAO tem este enum — ele e calculado no
 * cliente a partir de `Reserva` + `Sala.statusManual` + `Turma`.
 */
export type StatusSala = 'livre' | 'ocupada' | 'iminente';

/** `Sala.statusManual` — mesmo dominio de `StatusSala`, redundante de proposito. */
export type StatusManualSala = StatusSala;

/**
 * Status de uma turma, calculado a partir de `dataInicio`/`dataFim`.
 * Tambem calculado no cliente, nao existe no Java.
 */
export type StatusTurma = 'ativa' | 'iminente' | 'posterior' | 'encerrada';

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

/** Espelha `backend/.../model/Unidade.java` / tabela `unidades`. */
export interface Unidade {
  id: number;
  nome: string;
  cep?: string;
  cidade?: string;
  endereco?: string;
}

/**
 * Espelha `backend/.../model/Usuario.java` / tabela `usuarios`.
 *
 * `senha` e obrigatoria porque o Java tem `@NotBlank NOT NULL` e o seed do
 * servidor Node sempre a preenche. Ela so trafega no mobile (que grava o
 * login) — o endpoint `UsuarioResponse` do Java NAO a devolve.
 */
export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha?: string; // nao retornado pela API (WRITE_ONLY no backend)
  perfil: Perfil;
  unidadeId: number;
}

/** Espelha `backend/.../model/Sala.java` / tabela `salas`. */
export interface Sala {
  id: number;
  nome: string;
  /** Java: `Integer @Positive` — pode vir ausente. */
  capacidade?: number;
  tipo: string;
  /** Java: colunas nullable. */
  andar?: string;
  bloco?: string;
  /**
   * Java: `@ElementCollection(EAGER)` -> tabela `sala_turnos_legado`.
   * Duplicacao historica de `turnosDisponiveis`, mantida no modelo.
   */
  turnos?: Turno[];
  /** Java: `@ElementCollection(EAGER)` -> tabela `sala_turnos`, nunca null. */
  turnosDisponiveis: Turno[];
  unidadeId: number;
  /** Java: `private boolean ativa = true` (primitivo). */
  ativa?: boolean;
  /** Java: `String` nullable. Tem precedencia sobre o calculo automatico. */
  statusManual?: StatusManualSala | null;
  motivoManual?: string | null;
  manualPor?: string | null;
  manualCriadaEm?: string | null;
}

/** Espelha `backend/.../model/Turma.java` / tabela `turmas`. */
export interface Turma {
  id: number;
  /** Java: `@NotBlank`. */
  codigo: string;
  nome: string;
  curso: string;
  /** Java: `@NotBlank String` (nao enum) — o servidor emite so os 3 valores. */
  turno: Turno;
  dataInicio?: string;
  dataFim?: string;
  instrutorId?: number | null;
  unidadeId: number;
}

/** Espelha `backend/.../model/Reserva.java` / tabela `reservas`. */
export interface Reserva {
  id: number;
  salaId: number;
  turmaId?: number | null;
  turno: Turno;
  /** O servidor Node pode persistir `null` aqui. */
  diasSemana?: DiaSemana[] | null;
  /**
   * LEGADO: o Java NAO tem este campo em `Reserva` (existe so em
   * `Solicitacao.datasEspecificas`). O servidor Node o entrega no GET /api/dados.
   */
  datasEspecificas?: string[];
  dataInicio: string;
  dataFim: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  instrutorId?: number | null;
  unidadeId: number;
  /**
   * Java: `String` com default `"ATIVA"` (nao enum). O servidor Node usa
   * sempre `'ATIVA' | 'CANCELADA'`.
   */
  status?: StatusReserva | string;
  avulsa?: boolean;
  /**
   * LEGADO: NAO existe no Java. Persistido pelo servidor Node quando o
   * coordenador reserva em nome de alguem.
   */
  reservadoPorId?: number | null;
  /** LEGADO: NAO existe no Java. Liga a reserva a `Solicitacao.id`. */
  solicId?: number | null;
}

/** Espelha `backend/.../model/Chave.java` / tabela `chaves`. */
export interface Chave {
  id: number;
  codigo: string;
  salaId: number;
  andar?: string;
  status: StatusChave | string;
  instrutorId?: number | null;
  pegaEm?: string | null;
  unidadeId: number;
}

/** Espelha `backend/.../model/Notificacao.java` / tabela `notificacoes`. */
export interface Notificacao {
  id: number;
  tipo?: TipoNotificacao | string;
  titulo?: string;
  msg?: string;
  /**
   * LEGADO: o Java NAO tem este campo. O servidor Node aceita `mensagem` como
   * alias de `msg` no POST /api/sinc.
   */
  mensagem?: string;
  /** Java: `String` (nao enum `Perfil`). */
  paraPerfil?: string | null;
  paraId?: number | null;
  unidadeId?: number | null;
  lida?: boolean;
  criadaEm?: string;
}

/** Espelha `backend/.../model/Solicitacao.java` / tabela `solicitacoes`. */
export interface Solicitacao {
  id: number;
  salaId: number;
  instrutorId: number;
  turmaId?: number | null;
  turnos?: Turno[];
  data?: string;
  dataInicio?: string;
  dataFim?: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  /** O servidor Node pode persistir `null` aqui. */
  diasSemana?: DiaSemana[] | null;
  datasEspecificas?: string[];
  modo?: ModoDataSolicitacao;
  turno?: Turno | string;
  motivo?: string;
  status: StatusSolicitacao | string;
  unidadeId: number;
  criadaEm?: string;
  respondidaEm?: string | null;
  resposta?: string | null;
}

/**
 * Sessao corrente. O Java guarda a sessao inteira como um JSON numa unica
 * linha da tabela `sessao` (`Sessao.usuarioJson`), logo o formato e o do
 * proprio `Usuario`.
 */
export type Sessao = Usuario;

/**
 * Estado do calendario. NAO e contrato de rede — so existe no cliente.
 * Mantido aqui para paridade com `web/src/types/index.ts`.
 */
export interface EstadoCalendario {
  ano: number;
  mes: number;
  vista: 'mes' | 'semana';
  diaSel: Date;
  semBase: Date;
  filtSala: string;
  filtTurno: string;
}

// ---------------------------------------------------------------------------
// DTOs do backend Java
// ---------------------------------------------------------------------------

/** Espelha `backend/.../dto/LoginRequest.java`. */
export interface LoginRequest {
  email: string;
  senha: string;
}

/**
 * Espelha `backend/.../dto/UsuarioResponse.java`.
 *
 * `perfil` vem como `String` minusculo (`user.getPerfil().name().toLowerCase()`).
 * **Nao inclui `senha`** — ao contrario da entidade `Usuario`.
 */
export interface UsuarioResponse {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  unidadeId: number;
}

/**
 * Espelha `backend/.../dto/ReservaRequest.java`.
 *
 * Nao inclui `status` nem `avulsa`: o servidor define esses valores.
 */
export interface ReservaRequest {
  salaId: number;
  turmaId?: number | null;
  turno: string;
  diasSemana: string[];
  dataInicio: string;
  dataFim: string;
  horaInicio?: string;
  horaFim?: string;
  instrutorId?: number | null;
  unidadeId: number;
}

/**
 * Espelha `backend/.../dto/SolicitacaoRequest.java`.
 *
 * Nao inclui `status`, `criadaEm`, `resposta` nem `respondidaEm`: o servidor
 * define esses valores.
 */
export interface SolicitacaoRequest {
  salaId: number;
  instrutorId: number;
  turmaId?: number | null;
  turnos: string[];
  data?: string;
  dataInicio?: string;
  dataFim?: string;
  diasSemana?: string[];
  datasEspecificas?: string[];
  horaInicio?: string;
  horaFim?: string;
  modo?: string;
  turno?: string;
  motivo?: string;
  unidadeId: number;
}

/** Espelha `backend/.../dto/RespostaSolicitacaoRequest.java`. */
export interface RespostaSolicitacaoRequest {
  decisao: string;
  resposta?: string;
}

// ---------------------------------------------------------------------------
// Formas de CRUD
// ---------------------------------------------------------------------------

/** Corpo aceito por `POST /api/<colecao>` e `alteracoes` do `/api/sinc`. */
export type NovoUsuario = Omit<Usuario, 'id'>;
export type NovoUnidade = Omit<Unidade, 'id'>;
export type NovoSala = Omit<Sala, 'id'>;
export type NovoTurma = Omit<Turma, 'id'>;
export type NovaReserva = Omit<Reserva, 'id'>;
export type NovaChave = Omit<Chave, 'id' | 'status'> & { status?: StatusChave | string };
export type NovaSolicitacao = Omit<Solicitacao, 'id'>;
export type NovaNotificacao = Omit<Notificacao, 'id'>;

/** Corpo aceito por `PUT /api/<colecao>/<id>`. */
export type Atualizar<T> = Partial<Omit<T, 'id'>>;

// ---------------------------------------------------------------------------
// Formatos de rede
// ---------------------------------------------------------------------------

/** Corpo de `GET /api/dados` — as 8 colecoes do banco. */
export interface BancoDados {
  usuarios: Usuario[];
  unidades: Unidade[];
  salas: Sala[];
  turmas: Turma[];
  reservas: Reserva[];
  chaves: Chave[];
  notificacoes: Notificacao[];
  solicitacoes: Solicitacao[];
  sessao?: Sessao | null;
  ultimaSinc?: number | string | null;
  [colecaoExtra: string]: unknown;
}

/** Corpo de `POST /api/sinc`. */
export interface PayloadSinc {
  criados?: Record<string, unknown[]>;
  alteracoes?: Record<string, unknown[]>;
  remocoes?: Record<string, unknown[]>;
}

/** Corpo de `POST /api/login`. */
export interface RespostaLogin {
  ok?: boolean;
  usuario?: Usuario | null;
  sessao?: Sessao | null;
  erro?: string;
  [campo: string]: unknown;
}

/** Corpo de erro padrao (`ApiExceptionHandler`). */
export interface RespostaErro {
  erro: string;
}

/** Colecoes que o CRUD generico do servidor Node conhece. */
export type NomeColecao =
  | 'usuarios'
  | 'unidades'
  | 'salas'
  | 'turmas'
  | 'reservas'
  | 'chaves'
  | 'notificacoes'
  | 'solicitacoes';
