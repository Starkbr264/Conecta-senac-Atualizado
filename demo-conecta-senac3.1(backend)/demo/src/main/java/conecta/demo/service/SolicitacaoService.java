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

    public SolicitacaoService(SolicitacaoRepository solicitacoes, SalaRepository salas, UsuarioRepository usuarios, ReservaService reservas, NotificacaoRepository notificacoes) {
        this.solicitacoes = solicitacoes;
        this.salas = salas;
        this.usuarios = usuarios;
        this.reservas = reservas;
        this.notificacoes = notificacoes;
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
        return solicitacoes.findAll().stream().mapToLong(Solicitacao::getId).max().orElse(0L) + 1;
    }

    private Long proximoIdNotificacao() {
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
