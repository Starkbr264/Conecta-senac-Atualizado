/**
 * ============================================================================
 *  CONTRATO DE DOMINIO — CONECTA-SENAC
 * ============================================================================
 *
 * Fonte unica de verdade dos tipos de dominio, compartilhada por:
 *   - `web/src/**`     (este arquivo)
 *   - `mobile/src/**`  (mesmo contrato, espelhado em `mobile/src/types/index.ts`)
 *
 * Derivado de TRES referencias, nesta ordem de prioridade:
 *   1. `server/seed.js` e `server/data/db.json` — o que o web e o mobile
 *      realmente trocam (servidor Node, porta 3333).
 *   2. `backend/demo/src/main/java/conecta/demo/model|dto` — o mesmo dominio
 *      em Spring Boot, contra PostgreSQL/Supabase.
 *   3. Historico do frontend legado (unica origem dos campos marcados
 *      "LEGADO" abaixo).
 *
 * ---------------------------------------------------------------------------
 *  REGRAS DE OURO
 * ---------------------------------------------------------------------------
 *  - NENHUM nome de propriedade deste arquivo pode ser alterado: o contrato
 *    JSON esperado por `backend/demo/` e por `server/index.js` e intocavel.
 *    Unificar aqui significa alinhar TIPAGEM e OPCIONALIDADE entre os dois
 *    frontends, nunca renomear chaves.
 *  - IDs sao `number` (o Java usa `Long`, o JSON do Node devolve numeros).
 *  - Datas sao ISO `YYYY-MM-DD`; timestamps sao ISO-8601 completo
 *    (`LocalDate` no Java, `Instant` em `criadaEm`/`pegaEm`/`manualCriadaEm`).
 *  - Campo opcional do banco vira `?:`. `| null` so onde o banco realmente
 *    carrega `null` (ver `Chave.instrutorId`, `Sala.statusManual`).
 *  - O Java declara alguns enums como `String` (`Turma.turno`, `Reserva.turno`,
 *    `Reserva.status`, `Notificacao.paraPerfil`). Nos dois lados mantemos a
 *    uniao estrita + `| string`, para continuar aceitando valor legado sem
 *    perder a checagem de tipos no codigo novo.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Enums / unions de dominio — espelham os enums Java e o que o seed grava
// ---------------------------------------------------------------------------

/**
 * `usuarios.perfil`.
 * Java: enum `Perfil { ADMIN, COORDENADOR, INSTRUTOR, RECEPCAO }` com
 * `@JsonValue -> name().toLowerCase(Locale.ROOT)`. Logo o JSON e minusculo.
 */
export type Perfil = 'admin' | 'coordenador' | 'instrutor' | 'recepcao';

/**
 * Turnos de salas, turmas, reservas e solicitacoes.
 * Java: `String` livre (sem enum). O seed so popula estes tres valores.
 */
export type Turno = 'Matutino' | 'Vespertino' | 'Noturno';

/** Turnos aceitos como entrada livre (o seed tambem aceita minusculos). */
export type TurnoInput = Turno | 'matutino' | 'vespertino' | 'noturno';

/** Dias da semana em notacao curta, exatamente como persistidos. */
export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

/**
 * `reservas.status` — persistido em MAIUSCULAS.
 * Java: `String status = "ATIVA"` (o `DELETE` Troca para `"CANCELADA"`).
 */
export type StatusReserva = 'ATIVA' | 'CANCELADA';

/**
 * `chaves.status`.
 * Java: enum `StatusChave { DISPONIVEL, RETIRADA }` com
 * `@JsonValue`: DISPONIVEL -> `"disponivel"`, RETIRADA -> `"pega"`.
 * Atencao: o nome no JSON NAO acompanha o nome do enum.
 */
export type StatusChave = 'disponivel' | 'pega';

/**
 * `solicitacoes.status`.
 * Java: enum `StatusSolicitacao { PENDENTE, APROVADA, RECUSADA }`
 * (`@JsonValue` minusculo).
 */
export type StatusSolicitacao = 'pendente' | 'aprovada' | 'recusada';

/** Nome curto usado pelo mobile; alias exato, mantido por compatibilidade. */
export type StatusSolic = StatusSolicitacao;

/** `RespostaSolicitacaoRequest.decisao` — texto livre no Java. */
export type DecisaoSolicitacao = 'aprovar' | 'recusar';

/** Tipos conhecidos de notificacao. O banco aceita qualquer string. */
export type TipoNotificacao =
  | 'info'
  | 'ok'
  | 'sucesso'
  | 'aviso'
  | 'erro';

/** Status derivado de uma `Turma` (calculado, nunca persistido). */
export type StatusTurma = 'ativa' | 'iminente' | 'posterior' | 'encerrada';

/**
 * Status de ocupacao de uma sala — tanto calculado (mapa) quanto forcado
 * manualmente pelo coordenador (`salas.status_manual`).
 *
 * Antes este contrato declarava `StatusSala` e `StatusManualSala` como dois
 * literais identicos. Agora `StatusManualSala` e alias de `StatusSala`; o banco
 * nao distingue os dois casos e as duas unions garantiam divergencia-free
 * apenas por luck.
 */
export type StatusSala = 'livre' | 'ocupada' | 'iminente';

/** Alias legado de {@link StatusSala} (nome usado por `salas.status_manual`). */
export type StatusManualSala = StatusSala;

/**
 * `solicitacoes.modo` — modo de escolha de datas.
 * Java: `String modo` (sem enum). Valores usados pelo web e pelo mobile.
 */
export type ModoDataSolicitacao = 'unica' | 'periodo' | 'especificas';

/** Nome curto usado pelo mobile; alias exato, mantido por compatibilidade. */
export type ModoData = ModoDataSolicitacao;

/** Tipos de toast exibidos pela camada de UI. */
export type TipoToast = 'success' | 'error' | 'info' | 'aviso';

/** Tema do documento (`<html data-theme="...">`). */
export type Tema = 'light' | 'dark';

// ---------------------------------------------------------------------------
// Entidades — nomes de propriedade espelham 1:1 as entidades JPA e as tabelas
// `unidades`, `usuarios`, `turmas`, `salas`, `chaves`, `notificacoes`,
// `solicitacoes`, `reservas`.
// ---------------------------------------------------------------------------

/** Tabela `unidades` (sem `ativa`, sem timestamps). */
export interface Unidade {
  id: number;
  nome: string;
  cep?: string;
  cidade?: string;
  endereco?: string;
}

/** Tabela `usuarios` (unique em `email`). */
export interface Usuario {
  id: number;
  nome: string;
  email: string;
  /**
   * Presente no banco (o projeto grava senhas em texto puro — pendencia
   * documentada em `docs/RELATORIO_REFATORACAO.md`). O Java tem
   * `@NotBlank NOT NULL`, logo nao deve vir ausente; o servidor Node sempre
   * a preenche. Nao e devolvido por `UsuarioResponse` (login), mas volta em
   * `GET /api/dados`.
   */
  senha: string;
  perfil: Perfil;
  unidadeId: number;
}

/** Tabela `salas` + coleções `sala_turnos` e `sala_turnos_legado`. */
export interface Sala {
  id: number;
  nome: string;
  capacidade?: number;
  tipo: string;
  andar?: string;
  bloco?: string;
  /**
   * Turnos em que a sala pode ser usada. O banco mantem historicamente DUAS
   * chaves equivalentes (`turnos` -> `sala_turnos_legado` e `turnosDisponiveis`
   * -> `sala_turnos`) por compatibilidade com o web legado; ambas sao lidas,
   * com `turnosDisponiveis` como fonte canonica.
   */
  turnos?: Turno[];
  /** Java: `@ElementCollection(EAGER)` -> tabela `sala_turnos`, nunca null. */
  turnosDisponiveis: Turno[];
  unidadeId: number;
  /** Override manual de status; quando preenchido, sobrepoe o calculo. */
  statusManual?: StatusManualSala | null;
  motivoManual?: string | null;
  manualPor?: string | null;
  manualCriadaEm?: string | null;
  /** Java: `boolean ativa = true` (primitivo, nunca nulo). */
  ativa?: boolean;
}

/** Tabela `turmas`. */
export interface Turma {
  id: number;
  /** Codigo exibido (ex.: "2025.01.10"). O `addTurma` sincroniza nome/codigo. */
  codigo?: string;
  nome: string;
  curso: string;
  /** Java: `String turno` com `@NotBlank` — nao e enum. */
  turno: Turno | string;
  dataInicio?: string;
  dataFim?: string;
  instrutorId?: number | null;
  unidadeId: number;
}

/**
 * Tabela `reservas` + coleção `reserva_dias_semana` (coluna `dia_semana`).
 */
export interface Reserva {
  id: number;
  salaId: number;
  turmaId?: number | null;
  /** Java: `String turno` com `@NotBlank` — nao e enum. */
  turno: Turno | string;
  /** O servidor Node pode persistir `null` aqui. */
  diasSemana?: DiaSemana[] | null;
  datasEspecificas?: string[];
  /** Sempre preenchidas: toda reserva tem periodo (inclusive avulsa). */
  dataInicio: string;
  dataFim: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  instrutorId?: number | null;
  unidadeId: number;
  /** Java: `String status = "ATIVA"`. */
  status?: StatusReserva | string;
  /** Reserva sem turma vinculada. Java: `boolean avulsa = false`. */
  avulsa?: boolean;
  /**
   * LEGADO (so no web) — id do usuario que criou a reserva.
   * Nao existe no schema do backend Spring nem nos tipos do mobile.
   */
  reservadoPorId?: number | null;
  /**
   * LEGADO (so no web) — id da solicitacao que originou a reserva.
   * Usado para recusar a solicitacao quando a reserva e excluida.
   * Nao existe no schema do backend Spring nem nos tipos do mobile.
   */
  solicId?: number | null;
}

/** Tabela `chaves` (unique em `codigo`). */
export interface Chave {
  id: number;
  codigo: string;
  salaId: number;
  andar?: string;
  status: StatusChave | string;
  /** Usuario com a chave em custodia. `null` quando disponivel. */
  instrutorId?: number | null;
  /** `Instant` no Java. */
  pegaEm?: string | null;
  unidadeId: number;
}

/**
 * Tabela `notificacoes`.
 * Java: `paraPerfil` e `String` (NAO o enum `Perfil`) e **nao existe**
 * `mensagem` — aqui o campo e legado e opcional.
 */
export interface Notificacao {
  id: number;
  tipo?: TipoNotificacao | string;
  titulo?: string;
  /** Campo canonico (Java: `@NotBlank`, `length = 1000`). */
  msg?: string;
  /** LEGADO (so no web) — `addNotif` normaliza entre `msg` e `mensagem`. */
  mensagem?: string;
  paraPerfil?: Perfil | string | null;
  /** Destinatario especifico; `null` = todos do perfil. */
  paraId?: number | null;
  unidadeId?: number | null;
  lida?: boolean;
  /** `Instant` no Java; o Java sempre preenche (`= Instant.now()`). */
  criadaEm?: string;
}

/**
 * Tabela `solicitacoes` + coleções `solicitacao_turnos`,
 * `solicitacao_dias_semana` e `solicitacao_datas_especificas`.
 */
export interface Solicitacao {
  id: number;
  salaId: number;
  instrutorId: number;
  turmaId?: number | null;
  unidadeId: number;
  /** `data NOT NULL` no Java (modo "unica"). */
  data?: string;
  dataInicio?: string;
  dataFim?: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  turnos?: Turno[];
  /**
   * `turno` singular: redundante com `turnos`, mas gravado pelo web.
   * Mantido opcional e NAO removido — contrato JSON intocavel.
   */
  turno?: Turno | string;
  /** O servidor Node pode persistir `null` aqui. */
  diasSemana?: DiaSemana[] | null;
  datasEspecificas?: string[];
  modo?: ModoDataSolicitacao;
  motivo?: string;
  status: StatusSolicitacao | string;
  criadaEm?: string;
  respondidaEm?: string | null;
  resposta?: string | null;
}

// ---------------------------------------------------------------------------
// Sessao
// ---------------------------------------------------------------------------

/**
 * Sessao persistida — no web em `sessionStorage`, no mobile em AsyncStorage.
 *
 * O backend Java persiste a sessao como UM JSON serializado na linha unica da
 * tabela `sessao` (coluna `usuarioJson`), nao como colunas.
 */
export type Sessao = Usuario;

// ---------------------------------------------------------------------------
// Estado de UI (espelha `EstadoCalendario` do mobile — antes so existia la)
// ---------------------------------------------------------------------------

/** Estado do modulo de calendario (`features/calendario/calendario.ts`). */
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
// Formas parciais de criacao/atualizacao (CRUD)
// ---------------------------------------------------------------------------

export type NovoUsuario = Omit<Usuario, 'id'>;
export type NovoUnidade = Omit<Unidade, 'id'>;
export type NovoSala = Omit<Sala, 'id'>;
export type NovoTurma = Omit<Turma, 'id'>;
export type NovaReserva = Omit<Reserva, 'id'>;
export type NovaChave = Omit<Chave, 'id' | 'status'> & {
  status?: StatusChave | string;
};
export type NovaSolicitacao = Omit<Solicitacao, 'id'>;
export type NovaNotificacao = Omit<Notificacao, 'id'>;

/** Atualizacao parcial — somente os campos enviados sao alterados. */
export type Atualizar<T> = Partial<Omit<T, 'id'>>;

// ---------------------------------------------------------------------------
// DTOs — espelham os `record` de `backend/demo/.../dto/`
//
// Nao ha `any` aqui de proposito: sao os corpos EXATOS que o Spring Boot
// aceita nas requisicoes. Nome de campo incompativel aqui quebraria a API.
// ---------------------------------------------------------------------------

/** `LoginRequest` — corpo de `POST /api/login`. */
export interface LoginRequest {
  email: string;
  senha: string;
}

/**
 * `ReservaRequest` — corpo de `POST /api/reservas`.
 * Nao inclui `status` nem `avulsa`: o servidor define os dois.
 */
export interface ReservaRequest {
  salaId: number;
  turmaId?: number | null;
  turno: Turno | string;
  diasSemana: DiaSemana[];
  dataInicio: string;
  dataFim: string;
  horaInicio?: string | null;
  horaFim?: string | null;
  instrutorId?: number | null;
  unidadeId: number;
}

/**
 * `SolicitacaoRequest` — corpo de `POST /api/solicitacoes`.
 * Nao inclui `status`, `criadaEm`, `resposta` nem `respondidaEm`.
 */
export interface SolicitacaoRequest {
  salaId: number;
  instrutorId: number;
  turmaId?: number | null;
  turnos: Turno[];
  data?: string;
  dataInicio?: string;
  dataFim?: string;
  diasSemana?: DiaSemana[];
  datasEspecificas?: string[];
  horaInicio?: string | null;
  horaFim?: string | null;
  modo?: ModoDataSolicitacao | string;
  turno?: Turno | string;
  motivo?: string;
  unidadeId: number;
}

/** `RespostaSolicitacaoRequest` — corpo de `POST /api/solicitacoes/{id}/resposta`. */
export interface RespostaSolicitacaoRequest {
  decisao: DecisaoSolicitacao | string;
  resposta?: string | null;
}

/**
 * `UsuarioResponse` — o que o login devolve.
 * `perfil` e `String` minusculo e **nao** inclui `senha` (ao contrario da
 * entidade `Usuario`, que a serializa direto e expoe a senha em texto puro —
 * pendencia registrada em `docs/RELATORIO_REFATORACAO.md`).
 */
export interface UsuarioResponse {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil | string;
  unidadeId: number;
}

// ---------------------------------------------------------------------------
// Formatos de rede (contrato com `server/index.js`, porta 3333)
// ---------------------------------------------------------------------------

/** Corpo devolvido por `GET /api/dados`. */
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
  [colegaoExtra: string]: unknown;
}

/** Corpo aceito por `POST /api/sinc`. */
export interface PayloadSinc {
  criados?: Record<string, unknown[]>;
  alteracoes?: Record<string, unknown[]>;
  remocoes?: Record<string, unknown[]>;
}

/** Resposta de `POST /api/login`. */
export interface RespostaLogin {
  ok?: boolean;
  usuario?: Usuario | null;
  sessao?: Sessao | null;
  token?: string | null;
  erro?: string;
  [campo: string]: unknown;
}

/** Formato de erro padronizado do servidor Node. */
export interface RespostaErro {
  erro: string;
}

/** Nomes das coleções conhecidas pelo servidor. */
export type NomeColecao =
  | 'usuarios'
  | 'unidades'
  | 'salas'
  | 'turmas'
  | 'reservas'
  | 'chaves'
  | 'notificacoes'
  | 'solicitacoes';

// ---------------------------------------------------------------------------
// Globais de window
//
// Declarados aqui para que `core/api.ts` leia direto,
// sem `as unknown as Record<string, unknown>`.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    /**
     * Base da API injetada antes do bundle (ou por proxy de deploy).
     * Aceita `same-origin`, que expande para `window.location.origin`.
     * Ver `core/api.ts`.
     */
    __CONECTA_API_BASE__?: string;
  }
}