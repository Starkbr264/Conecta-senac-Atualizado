package conecta.demo.service;

import conecta.demo.dto.ReservaRequest;
import conecta.demo.dto.RespostaSolicitacaoRequest;
import conecta.demo.dto.SolicitacaoRequest;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.*;
import conecta.demo.repository.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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

    public SolicitacaoService(SolicitacaoRepository solicitacoes, SalaRepository salas, UsuarioRepository usuarios, ReservaService reservas, NotificacaoRepository notificacoes) {
        this(solicitacoes, salas, usuarios, reservas, notificacoes, null, null, null,
                new SolicitacaoTemporalService(java.time.Clock.systemUTC(),
                        java.time.ZoneId.of("America/Sao_Paulo"), java.util.Map.of()));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public SolicitacaoService(SolicitacaoRepository solicitacoes, SalaRepository salas, UsuarioRepository usuarios, ReservaService reservas, NotificacaoRepository notificacoes, IdAllocatorService ids, TurmaRepository turmas, UnidadeRepository unidades, SolicitacaoTemporalService temporal) {
        this.solicitacoes = solicitacoes;
        this.salas = salas;
        this.usuarios = usuarios;
        this.reservas = reservas;
        this.notificacoes = notificacoes;
        this.ids = ids;
        this.turmas = turmas;
        this.unidades = unidades;
        this.temporal = temporal;
    }

    /**
     * Valida uma solicitacao recebida do /api/sinc sem persisti-la.
     *
     * <p>Confere que sala, instrutor, unidade (e turma, quando informada)
     * existem e pertencem a mesma unidade da solicitacao — nenhum registro
     * orfao nem referencia cruzada entre unidades entra no banco.
     */
    void validarParaSincronizacao(Solicitacao sol) {
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
        }
    }

    @Transactional(readOnly = true)
    public List<Solicitacao> listar(Long unidadeId, Long instrutorId) {
        if (instrutorId != null) return solicitacoes.findByInstrutorId(instrutorId);
        return unidadeId == null ? solicitacoes.findAll() : solicitacoes.findByUnidadeId(unidadeId);
    }

    @Transactional(readOnly = true)
    public Solicitacao buscar(Long id) {
        return solicitacoes.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Solicitacao", id));
    }

    public Map<String, Object> configuracaoTemporal() {
        return temporal.configuracao();
    }

    public Solicitacao criar(SolicitacaoRequest r) {
        Sala sala = salas.findById(r.salaId()).orElseThrow(() -> new RecursoNaoEncontradoException("Sala", r.salaId()));
        Usuario instrutor = usuarios.findById(r.instrutorId()).orElseThrow(() -> new RecursoNaoEncontradoException("Instrutor", r.instrutorId()));
        if (!instrutor.getUnidadeId().equals(r.unidadeId()) || !sala.getUnidadeId().equals(r.unidadeId()))
            throw new RegraDeNegocioException("Solicitacao deve usar instrutor, sala e unidade compativeis");
        if (r.turnos() == null || r.turnos().isEmpty())
            throw new RegraDeNegocioException("A solicitacao deve ter ao menos um turno");
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
        Solicitacao s = buscar(id);
        if (s.getStatus() != StatusSolicitacao.PENDENTE)
            throw new RegraDeNegocioException("Esta solicitacao ja foi respondida");

        boolean aprovar = "aprovar".equalsIgnoreCase(resposta.decisao());
        if (!aprovar && !"recusar".equalsIgnoreCase(resposta.decisao()))
            throw new RegraDeNegocioException("Decisao deve ser aprovar ou recusar");

        if (aprovar) {
            if (s.getTurnos().isEmpty())
                throw new RegraDeNegocioException("A solicitacao deve ter ao menos um turno");
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
