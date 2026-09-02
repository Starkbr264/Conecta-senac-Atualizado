package conecta.demo.service;

import conecta.demo.dto.ReservaRequest;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Reserva;
import conecta.demo.model.Sala;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReservaService {
    private final ReservaRepository reservas;
    private final SalaRepository salas;

    public ReservaService(ReservaRepository reservas, SalaRepository salas) {
        this.reservas = reservas;
        this.salas = salas;
    }

    @Transactional(readOnly = true)
    public List<Reserva> listar(Long unidadeId) {
        return unidadeId == null ? reservas.findAll() : reservas.findByUnidadeId(unidadeId);
    }

    @Transactional(readOnly = true)
    public Reserva buscar(Long id) {
        return reservas.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Reserva", id));
    }

    public Reserva criar(ReservaRequest request) {
        Reserva reserva = montar(request);
        validarDisponibilidade(reserva, null);
        reserva.setId(proximoId());
        return reservas.save(reserva);
    }

    private Long proximoId() {
        return reservas.findAll().stream().mapToLong(Reserva::getId).max().orElse(0L) + 1;
    }

    public Reserva atualizar(Long id, ReservaRequest request) {
        Reserva atual = buscar(id);
        Reserva nova = montar(request);
        validarDisponibilidade(nova, id);
        atual.setSalaId(nova.getSalaId());
        atual.setTurmaId(nova.getTurmaId());
        atual.setTurno(nova.getTurno());
        atual.setDiasSemana(nova.getDiasSemana());
        atual.setDataInicio(nova.getDataInicio());
        atual.setDataFim(nova.getDataFim());
        atual.setHoraInicio(nova.getHoraInicio());
        atual.setHoraFim(nova.getHoraFim());
        atual.setInstrutorId(nova.getInstrutorId());
        atual.setUnidadeId(nova.getUnidadeId());
        return reservas.save(atual);
    }

    public void cancelar(Long id) {
        Reserva reserva = buscar(id);
        reserva.setStatus("CANCELADA");
        reservas.save(reserva);
    }

    private Reserva montar(ReservaRequest r) {
        if (r.dataFim().isBefore(r.dataInicio()))
            throw new RegraDeNegocioException("A data final deve ser posterior a data inicial");
        Sala sala = salas.findById(r.salaId()).orElseThrow(() -> new RecursoNaoEncontradoException("Sala", r.salaId()));
        if (!sala.isAtiva())
            throw new RegraDeNegocioException("Sala indisponivel");
        if (!sala.getUnidadeId().equals(r.unidadeId()))
            throw new RegraDeNegocioException("A sala nao pertence a unidade informada");
        Reserva x = new Reserva();
        x.setSalaId(r.salaId());
        x.setTurmaId(r.turmaId());
        x.setTurno(r.turno());
        x.setDiasSemana(r.diasSemana());
        x.setDataInicio(r.dataInicio());
        x.setDataFim(r.dataFim());
        x.setHoraInicio(r.horaInicio());
        x.setHoraFim(r.horaFim());
        x.setInstrutorId(r.instrutorId());
        x.setUnidadeId(r.unidadeId());
        return x;
    }

    private void validarDisponibilidade(Reserva proposta, Long ignorarId) {
        boolean conflito = reservas
                .findBySalaIdAndDataInicioLessThanEqualAndDataFimGreaterThanEqual(proposta.getSalaId(), proposta.getDataFim(), proposta.getDataInicio())
                .stream()
                .filter(r -> ignorarId == null || !r.getId().equals(ignorarId))
                .filter(r -> !"CANCELADA".equals(r.getStatus()))
                .anyMatch(r -> r.getTurno().equalsIgnoreCase(proposta.getTurno()) && diasCoincidem(r.getDiasSemana(), proposta.getDiasSemana()));
        if (conflito)
            throw new RegraDeNegocioException("Ja existe reserva para esta sala, periodo e turno");
    }

    private boolean diasCoincidem(java.util.Set<String> um, java.util.Set<String> outro) {
        return um.stream().anyMatch(dia -> outro.stream().anyMatch(candidato -> dia.equalsIgnoreCase(candidato)));
    }
}
