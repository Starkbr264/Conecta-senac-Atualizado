package conecta.demo.service;

import conecta.demo.dto.ReservaRequest;
import conecta.demo.dto.RespostaSolicitacaoRequest;
import conecta.demo.dto.SolicitacaoRequest;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.*;
import conecta.demo.repository.*;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
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

    public SolicitacaoService(SolicitacaoRepository solicitacoes, SalaRepository salas, UsuarioRepository usuarios, ReservaService reservas, NotificacaoRepository notificacoes) {
        this(solicitacoes, salas, usuarios, reservas, notificacoes, null, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public SolicitacaoService(SolicitacaoRepository solicitacoes, SalaRepository salas, UsuarioRepository usuarios, ReservaService reservas, NotificacaoRepository notificacoes, IdAllocatorService ids, TurmaRepository turmas, UnidadeRepository unidades) {
        this.solicitacoes = solicitacoes;
        this.salas = salas;
        this.usuarios = usuarios;
        this.reservas = reservas;
        this.notificacoes = notificacoes;
        this.ids = ids;
        this.turmas = turmas;
        this.unidades = unidades;
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

    public Solicitacao criar(SolicitacaoRequest r) {
        Sala sala = salas.findById(r.salaId()).orElseThrow(() -> new RecursoNaoEncontradoException("Sala", r.salaId()));
        Usuario instrutor = usuarios.findById(r.instrutorId()).orElseThrow(() -> new RecursoNaoEncontradoException("Instrutor", r.instrutorId()));
        if (!instrutor.getUnidadeId().equals(r.unidadeId()) || !sala.getUnidadeId().equals(r.unidadeId()))
            throw new RegraDeNegocioException("Solicitacao deve usar instrutor, sala e unidade compativeis");

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
}
