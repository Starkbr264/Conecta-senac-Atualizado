package conecta.demo.service;

import conecta.demo.dto.ReservaRequest;
import conecta.demo.dto.RespostaSolicitacaoRequest;
import conecta.demo.dto.SolicitacaoRequest;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.exception.AcessoNegadoException;
import conecta.demo.model.*;
import conecta.demo.repository.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SolicitacaoService {
    private final SolicitacaoRepository solicitacoes;
    private final SalaRepository salas;
    private final UsuarioRepository usuarios;
    private final ReservaService reservas;
    private final NotificacaoRepository notificacoes;
    private final IdAllocatorService ids;
    private final TurmaRepository turmas;
    private final UnidadeRepository unidades;
    private final SolicitacaoTemporalService temporal;
    private final SolicitacaoExpiracaoService expiracao;

    public SolicitacaoService(SolicitacaoRepository solicitacoes, SalaRepository salas, UsuarioRepository usuarios, ReservaService reservas, NotificacaoRepository notificacoes) {
        this(solicitacoes, salas, usuarios, reservas, notificacoes, null, null, null,
                new SolicitacaoTemporalService(java.time.Clock.systemUTC(),
                        java.time.ZoneId.of("America/Sao_Paulo"), java.util.Map.of()), null);
    }

    public SolicitacaoService(SolicitacaoRepository solicitacoes, SalaRepository salas, UsuarioRepository usuarios, ReservaService reservas, NotificacaoRepository notificacoes, IdAllocatorService ids, TurmaRepository turmas, UnidadeRepository unidades, SolicitacaoTemporalService temporal) {
        this(solicitacoes, salas, usuarios, reservas, notificacoes, ids, turmas, unidades, temporal, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public SolicitacaoService(SolicitacaoRepository solicitacoes, SalaRepository salas, UsuarioRepository usuarios, ReservaService reservas, NotificacaoRepository notificacoes, IdAllocatorService ids, TurmaRepository turmas, UnidadeRepository unidades, SolicitacaoTemporalService temporal, SolicitacaoExpiracaoService expiracao) {
        this.solicitacoes = solicitacoes;
        this.salas = salas;
        this.usuarios = usuarios;
        this.reservas = reservas;
        this.notificacoes = notificacoes;
        this.ids = ids;
        this.turmas = turmas;
        this.unidades = unidades;
        this.temporal = temporal;
        this.expiracao = expiracao;
    }

    /**
     * Snapshot dos dados temporais de uma solicitacao persistida.
     *
     * <p>O {@code /api/sinc} materializa o payload APLICANDO-O sobre a mesma
     * entidade JPA existente (mutacao no lugar), entao o estado anterior precisa
     * ser capturado antes dos setters para distinguir uma alteracao efetiva de
     * um reenvio de delta sem mudanca relevante.
     */
    public record EstadoTemporalSolicitacao(LocalDate data, LocalDate dataInicio, LocalDate dataFim,
            List<String> datasEspecificas, Set<String> turnos, String horaInicio, String horaFim) {

        static EstadoTemporalSolicitacao de(Solicitacao s) {
            return new EstadoTemporalSolicitacao(s.getData(), s.getDataInicio(), s.getDataFim(),
                    s.getDatasEspecificas(), s.getTurnos(), s.getHoraInicio(), s.getHoraFim());
        }

        /** True quando o payload mexeu em algum dado temporal da solicitacao. */
        boolean alteradoEmRelacao(Solicitacao atual) {
            return !Objects.equals(data, atual.getData())
                    || !Objects.equals(dataInicio, atual.getDataInicio())
                    || !Objects.equals(dataFim, atual.getDataFim())
                    || !Objects.equals(datasEspecificas, atual.getDatasEspecificas())
                    || !Objects.equals(turnos, atual.getTurnos())
                    || !Objects.equals(horaInicio, atual.getHoraInicio())
                    || !Objects.equals(horaFim, atual.getHoraFim());
        }
    }

    /**
     * Valida uma solicitacao recebida do /api/sinc sem persisti-la.
     *
     * <p>Confere que sala, instrutor, unidade (e turma, quando informada)
     * existem e pertencem a mesma unidade da solicitacao — nenhum registro
     * orfao nem referencia cruzada entre unidades entra no banco.
     *
     * <p>Em seguida aplica a MESMA regra temporal da criacao normal
     * ({@link SolicitacaoTemporalService}, fuso America/Sao_Paulo e horario do
     * servidor): sempre em criacao, e em atualizacao apenas quando o payload
     * altera efetivamente os dados temporais. Solicitacoes historicas cujos
     * dados nao mudaram seguem preservadas.
     *
     * @param anterior estado persistido antes da aplicacao do payload;
     *                {@code null} quando a solicitacao esta sendo criada
     */
    void validarParaSincronizacao(Solicitacao sol, EstadoTemporalSolicitacao anterior) {
        if (sol.getSalaId() == null || sol.getInstrutorId() == null || sol.getUnidadeId() == null || sol.getData() == null)
            throw new RegraDeNegocioException("Sala, instrutor, unidade e data da solicitacao sao obrigatorios");
        if (sol.getUnidadeId() == null || !unidades.existsById(sol.getUnidadeId()))
            throw new RegraDeNegocioException("Unidade da solicitacao nao existe");
        Sala sala = salas.findById(sol.getSalaId())
                .orElseThrow(() -> new RegraDeNegocioException("Sala da solicitacao nao existe"));
        Usuario instrutor = usuarios.findById(sol.getInstrutorId())
                .orElseThrow(() -> new RegraDeNegocioException("Instrutor da solicitacao nao existe"));
        if (!sol.getUnidadeId().equals(sala.getUnidadeId())
                || !sol.getUnidadeId().equals(instrutor.getUnidadeId()))
            throw new RegraDeNegocioException("Solicitacao deve usar instrutor, sala e unidade compativeis");
        if (sol.getTurmaId() != null) {
            Turma turma = turmas.findById(sol.getTurmaId())
                    .orElseThrow(() -> new RegraDeNegocioException("Turma da solicitacao nao existe"));
            if (!sol.getUnidadeId().equals(turma.getUnidadeId()))
                throw new RegraDeNegocioException("Turma da solicitacao nao pertence a mesma unidade");
            validarTurnosDaTurma(turma, sol.getTurnos());
        }
        // Regra temporal unica (mesmo servico da criacao normal). Revalida em
        // criacao e sempre que o payload alterar dados temporais; registros
        // historicos com dados temporais inalterados nao sao rejeitados aqui.
        if (anterior == null || anterior.alteradoEmRelacao(sol)) {
            temporal.validar(dataInicio(sol), dataFim(sol), sol.getDatasEspecificas(),
                    sol.getTurnos() == null ? List.of() : sol.getTurnos(),
                    sol.getHoraInicio(), sol.getHoraFim());
        }
    }

    public List<Solicitacao> listar(Long unidadeId, Long instrutorId) {
        if (expiracao != null) expiracao.expirarVencidas();
        if (instrutorId != null) return solicitacoes.findByInstrutorId(instrutorId);
        return unidadeId == null ? solicitacoes.findAll() : solicitacoes.findByUnidadeId(unidadeId);
    }

    public Solicitacao buscar(Long id) {
        if (expiracao != null) expiracao.expirarVencidas();
        return solicitacoes.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Solicitacao", id));
    }

    public Map<String, Object> configuracaoTemporal() {
        return temporal.configuracao();
    }

    /** Recupera pendências vencidas antes de qualquer lote do cliente. */
    public int expirarVencidas() {
        return expiracao == null ? 0 : expiracao.expirarVencidas();
    }

    public Solicitacao criar(SolicitacaoRequest r) {
        Sala sala = salas.findById(r.salaId()).orElseThrow(() -> new RecursoNaoEncontradoException("Sala", r.salaId()));
        Usuario instrutor = usuarios.findById(r.instrutorId()).orElseThrow(() -> new RecursoNaoEncontradoException("Instrutor", r.instrutorId()));
        if (!instrutor.getUnidadeId().equals(r.unidadeId()) || !sala.getUnidadeId().equals(r.unidadeId()))
            throw new RegraDeNegocioException("Solicitacao deve usar instrutor, sala e unidade compativeis");
        if (r.turnos() == null || r.turnos().isEmpty())
            throw new RegraDeNegocioException("A solicitacao deve ter ao menos um turno");
        validarTurma(r.turmaId(), r.unidadeId(), r.turnos());
        temporal.validar(dataInicio(r), dataFim(r), r.datasEspecificas(),
                r.turnos(), r.horaInicio(), r.horaFim());
        if (duplicada(r)) {
            throw new RegraDeNegocioException("Ja existe uma solicitacao pendente equivalente");
        }
        for (String turno : r.turnos()) {
            reservas.validarParaSolicitacao(new ReservaRequest(
                    r.salaId(), r.turmaId(), turno, r.diasSemana(),
                    r.dataInicio() != null ? r.dataInicio() : r.data(),
                    r.dataFim() != null ? r.dataFim() : r.data(),
                    r.horaInicio(), r.horaFim(), r.instrutorId(), r.unidadeId()));
        }

        Solicitacao s = new Solicitacao();
        s.setSalaId(r.salaId());
        s.setInstrutorId(r.instrutorId());
        s.setTurmaId(r.turmaId());
        s.setTurnos(r.turnos() == null ? new LinkedHashSet<>() : r.turnos());
        s.setData(r.data());
        s.setDataInicio(r.dataInicio());
        s.setDataFim(r.dataFim());
        s.setDiasSemana(r.diasSemana() == null ? new LinkedHashSet<>() : r.diasSemana());
        s.setDatasEspecificas(r.datasEspecificas() == null ? List.of() : r.datasEspecificas());
        s.setHoraInicio(r.horaInicio());
        s.setHoraFim(r.horaFim());
        s.setModo(r.modo());
        s.setTurno(r.turno());
        s.setMotivo(r.motivo());
        s.setUnidadeId(r.unidadeId());
        s.setId(proximoId());
        return solicitacoes.save(s);
    }

    private Long proximoId() {
        if (ids != null) return ids.next("solicitacoes", () -> solicitacoes.findAll().stream().mapToLong(Solicitacao::getId).max().orElse(0L));
        return solicitacoes.findAll().stream().mapToLong(Solicitacao::getId).max().orElse(0L) + 1;
    }

    private Long proximoIdNotificacao() {
        if (ids != null) return ids.next("notificacoes", () -> notificacoes.findAll().stream().mapToLong(Notificacao::getId).max().orElse(0L));
        return notificacoes.findAll().stream().mapToLong(Notificacao::getId).max().orElse(0L) + 1;
    }

    public Solicitacao responder(Long id, RespostaSolicitacaoRequest resposta) {
        Solicitacao s = solicitacoes.findByIdForUpdate(id)
                .orElseGet(() -> solicitacoes.findById(id)
                        .orElseThrow(() -> new RecursoNaoEncontradoException("Solicitacao", id)));
        if (expiracao != null) expiracao.expirarSeVencida(s);
        validarUnidadeDoUsuario(s);
        if (s.getStatus() != StatusSolicitacao.PENDENTE)
            throw new RegraDeNegocioException("Esta solicitacao ja foi respondida");

        boolean aprovar = "aprovar".equalsIgnoreCase(resposta.decisao());
        if (!aprovar && !"recusar".equalsIgnoreCase(resposta.decisao()))
            throw new RegraDeNegocioException("Decisao deve ser aprovar ou recusar");

        if (aprovar) {
            if (s.getTurnos().isEmpty())
                throw new RegraDeNegocioException("A solicitacao deve ter ao menos um turno");
            validarTurma(s.getTurmaId(), s.getUnidadeId(), s.getTurnos());
            if (solicitacaoPendenteEquivalente(s)) {
                throw new RegraDeNegocioException("Ja existe uma solicitacao pendente equivalente");
            }
            temporal.validar(dataInicio(s), dataFim(s), s.getDatasEspecificas(),
                    s.getTurnos(), s.getHoraInicio(), s.getHoraFim());
            for (String turno : s.getTurnos()) {
                reservas.criar(new ReservaRequest(s.getSalaId(), s.getTurmaId(), turno, s.getDiasSemana(), s.getDataInicio() != null ? s.getDataInicio() : s.getData(), s.getDataFim() != null ? s.getDataFim() : s.getData(), s.getHoraInicio(), s.getHoraFim(), s.getInstrutorId(), s.getUnidadeId()));
            }
            s.setStatus(StatusSolicitacao.APROVADA);
        } else {
            s.setStatus(StatusSolicitacao.RECUSADA);
        }

        s.setResposta(resposta.resposta());
        s.setRespondidaEm(Instant.now());
        Solicitacao salva = solicitacoes.save(s);

        Notificacao n = new Notificacao();
        n.setId(proximoIdNotificacao());
        n.setTipo(aprovar ? "aprovada" : "recusada");
        n.setTitulo(aprovar ? "Solicitacao aprovada" : "Solicitacao recusada");
        n.setMsg(resposta.resposta() == null ? "Sua solicitacao foi respondida." : resposta.resposta());
        n.setParaPerfil("instrutor");
        n.setParaId(s.getInstrutorId());
        n.setUnidadeId(s.getUnidadeId());
        notificacoes.save(n);
        return salva;
    }

    public Solicitacao cancelar(Long id, String motivo) {
        Solicitacao s = solicitacoes.findByIdForUpdate(id)
                .orElseGet(() -> solicitacoes.findById(id)
                        .orElseThrow(() -> new RecursoNaoEncontradoException("Solicitacao", id)));
        if (expiracao != null) expiracao.expirarSeVencida(s);
        validarUnidadeDoUsuario(s);
        if (s.getStatus() != StatusSolicitacao.PENDENTE)
            throw new RegraDeNegocioException("Somente solicitacoes pendentes podem ser canceladas");

        String justificativa = motivo == null || motivo.isBlank()
                ? "Solicitação cancelada pelo coordenador"
                : motivo.trim();
        s.setStatus(StatusSolicitacao.CANCELADA);
        s.setOrigemStatus("COORDENADOR");
        s.setMotivoStatus(justificativa);
        s.setResposta(justificativa);
        s.setRespondidaEm(Instant.now());
        Solicitacao salva = solicitacoes.save(s);

        Notificacao n = new Notificacao();
        n.setId(proximoIdNotificacao());
        n.setTipo("cancelada");
        n.setTitulo("Solicitacao cancelada");
        n.setMsg(justificativa);
        n.setParaPerfil("instrutor");
        n.setParaId(s.getInstrutorId());
        n.setUnidadeId(s.getUnidadeId());
        notificacoes.save(n);
        return salva;
    }

    private void validarUnidadeDoUsuario(Solicitacao solicitacao) {
        var auth = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName())) return;
        if (auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) return;
        Long unidadeUsuario = usuarios.findByEmailIgnoreCase(auth.getName())
                .map(Usuario::getUnidadeId)
                .orElseThrow(() -> new AcessoNegadoException("Usuario autenticado nao possui unidade"));
        if (!Objects.equals(unidadeUsuario, solicitacao.getUnidadeId()))
            throw new AcessoNegadoException("Usuario nao pode alterar solicitacao de outra unidade");
    }

    private LocalDate dataInicio(SolicitacaoRequest r) {
        return r.dataInicio() != null ? r.dataInicio() : r.data();
    }

    private LocalDate dataFim(SolicitacaoRequest r) {
        return r.dataFim() != null ? r.dataFim() : r.data();
    }

    private LocalDate dataInicio(Solicitacao s) {
        return s.getDataInicio() != null ? s.getDataInicio() : s.getData();
    }

    private LocalDate dataFim(Solicitacao s) {
        return s.getDataFim() != null ? s.getDataFim() : s.getData();
    }

    /**
     * A turma atualmente possui um turno cadastrado por registro. A regra fica
     * centralizada aqui para ser aplicada na criacao/sincronizacao e na
     * aprovacao, sem confiar no turno enviado pelo frontend.
     */
    private void validarTurma(Long turmaId, Long unidadeId, Set<String> turnos) {
        if (turmaId == null) return;
        Turma turma = turmas.findById(turmaId)
                .orElseThrow(() -> new RegraDeNegocioException("Turma da solicitacao nao existe"));
        if (!Objects.equals(unidadeId, turma.getUnidadeId()))
            throw new RegraDeNegocioException("Turma da solicitacao nao pertence a unidade");
        validarTurnosDaTurma(turma, turnos);
    }

    private void validarTurnosDaTurma(Turma turma, Set<String> turnos) {
        if (turnos == null || turnos.isEmpty())
            throw new RegraDeNegocioException("A solicitacao deve ter ao menos um turno");
        String turnoTurma = turma.getTurno();
        boolean incompatibilidade = turnoTurma == null || turnos.stream()
                .anyMatch(turno -> turno == null || !turnoTurma.equalsIgnoreCase(turno));
        if (incompatibilidade)
            throw new RegraDeNegocioException(
                    "A solicitacao deve usar o turno da turma: " + turnoTurma);
    }

    private boolean duplicada(SolicitacaoRequest r) {
        return solicitacoes.findByUnidadeId(r.unidadeId()).stream()
                .filter(s -> s.getStatus() == StatusSolicitacao.PENDENTE)
                .anyMatch(s -> Objects.equals(s.getInstrutorId(), r.instrutorId())
                        && Objects.equals(s.getSalaId(), r.salaId())
                        && Objects.equals(s.getTurmaId(), r.turmaId())
                        && Objects.equals(dataInicio(s), dataInicio(r))
                        && Objects.equals(dataFim(s), dataFim(r))
                        && Objects.equals(s.getHoraInicio(), r.horaInicio())
                        && Objects.equals(s.getHoraFim(), r.horaFim())
                        && Objects.equals(s.getTurnos(), r.turnos())
                        && Objects.equals(s.getDiasSemana(), r.diasSemana()));
    }

    private boolean solicitacaoPendenteEquivalente(Solicitacao atual) {
        return solicitacoes.findByUnidadeId(atual.getUnidadeId()).stream()
                .filter(s -> s.getId() != null && !s.getId().equals(atual.getId()))
                .filter(s -> s.getStatus() == StatusSolicitacao.PENDENTE)
                .anyMatch(s -> Objects.equals(s.getInstrutorId(), atual.getInstrutorId())
                        && Objects.equals(s.getSalaId(), atual.getSalaId())
                        && Objects.equals(s.getTurmaId(), atual.getTurmaId())
                        && Objects.equals(dataInicio(s), dataInicio(atual))
                        && Objects.equals(dataFim(s), dataFim(atual))
                        && Objects.equals(s.getTurnos(), atual.getTurnos())
                        && Objects.equals(s.getDiasSemana(), atual.getDiasSemana()));
    }
}
