package conecta.demo.service;

import conecta.demo.dto.ReservaRequest;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Reserva;
import conecta.demo.model.Sala;
import conecta.demo.model.Turma;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.TurmaRepository;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReservaService {
    private final ReservaRepository reservas;
    private final SalaRepository salas;
    private final TurmaRepository turmas;
    private final IdAllocatorService ids;

    public ReservaService(ReservaRepository reservas, SalaRepository salas, TurmaRepository turmas) {
        this(reservas, salas, turmas, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ReservaService(ReservaRepository reservas, SalaRepository salas, TurmaRepository turmas,
                          IdAllocatorService ids) {
        this.reservas = reservas;
        this.salas = salas;
        this.turmas = turmas;
        this.ids = ids;
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
        validarSalaParaNovaOcupacao(reserva, null);
        validarDisponibilidade(reserva, null);
        reserva.setId(proximoId());
        return reservas.save(reserva);
    }

    /** Valida uma reserva sincronizada sem persisti-la. */
    void validarParaSincronizacao(ReservaRequest request, Long ignorarId) {
        validarParaSincronizacao(request, ignorarId, "ATIVA");
    }

    /** Valida uma reserva sincronizada, distinguindo ocupacao de cancelamento. */
    void validarParaSincronizacao(ReservaRequest request, Long ignorarId, String status) {
        if (request == null || request.salaId() == null || request.turno() == null
                || request.turno().isBlank() || request.diasSemana() == null
                || request.diasSemana().isEmpty() || request.dataInicio() == null
                || request.dataFim() == null || request.unidadeId() == null) {
            throw new RegraDeNegocioException("Dados da reserva invalidos");
        }
        Reserva proposta = montar(request);
        validarSalaParaNovaOcupacao(proposta, ignorarId, "CANCELADA".equals(status));
        if (!"CANCELADA".equals(status)) validarDisponibilidade(proposta, ignorarId);
    }

    private Long proximoId() {
        if (ids != null) return ids.next("reservas", () -> reservas.findAll().stream().mapToLong(Reserva::getId).max().orElse(0L));
        return reservas.findAll().stream().mapToLong(Reserva::getId).max().orElse(0L) + 1;
    }

    public Reserva atualizar(Long id, ReservaRequest request) {
        Reserva atual = buscar(id);
        Reserva nova = montar(request);
        validarSalaParaNovaOcupacao(nova, id);
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
        java.util.List<String> turnos = sala.getTurnosDisponiveis().isEmpty()
                ? sala.getTurnos() : sala.getTurnosDisponiveis();
        if (turnos.stream().noneMatch(turno -> turno.equalsIgnoreCase(r.turno())))
            throw new RegraDeNegocioException("A sala nao esta disponivel para o turno informado");
        if (r.turmaId() != null) {
            Turma turma = turmas.findById(r.turmaId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Turma", r.turmaId()));
            if (!turma.getUnidadeId().equals(r.unidadeId()))
                throw new RegraDeNegocioException("A turma nao pertence a unidade informada");
            if (turma.getTurno() != null && !turma.getTurno().equalsIgnoreCase(r.turno()))
                throw new RegraDeNegocioException("O turno da reserva deve ser o turno da turma");
            if (turma.getDataFim() != null && r.dataFim().isAfter(turma.getDataFim()))
                throw new RegraDeNegocioException("A reserva nao pode ultrapassar o fim da turma");
        }
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

    /**
     * Impede que uma nova ocupacao seja criada em uma sala manualmente bloqueada.
     * Uma reserva que ja ocupa a sala pode continuar sendo sincronizada ou sofrer
     * alteracoes administrativas, desde que seu intervalo de ocupacao permaneça
     * exatamente o mesmo. Transferencias e reagendamentos continuam proibidos.
     */
    private void validarSalaParaNovaOcupacao(Reserva proposta, Long ignorarId) {
        validarSalaParaNovaOcupacao(proposta, ignorarId, false);
    }

    private void validarSalaParaNovaOcupacao(Reserva proposta, Long ignorarId, boolean cancelada) {
        if (cancelada) return;
        Sala sala = salas.findById(proposta.getSalaId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Sala", proposta.getSalaId()));
        String statusManual = sala.getStatusManual() == null
                ? ""
                : sala.getStatusManual().trim().toLowerCase(Locale.ROOT);
        boolean bloqueada = "manutencao".equals(statusManual) || "indisponivel".equals(statusManual);
        if (!bloqueada) return;

        if (ignorarId != null) {
            Reserva existente = reservas.findById(ignorarId).orElse(null);
            if (existente != null && mesmaOcupacao(existente, proposta)) return;
        }

        throw new RegraDeNegocioException("Sala bloqueada para novas reservas");
    }

    private boolean mesmaOcupacao(Reserva existente, Reserva proposta) {
        return Objects.equals(existente.getSalaId(), proposta.getSalaId())
                && Objects.equals(existente.getDataInicio(), proposta.getDataInicio())
                && Objects.equals(existente.getDataFim(), proposta.getDataFim())
                && existente.getTurno() != null
                && proposta.getTurno() != null
                && existente.getTurno().equalsIgnoreCase(proposta.getTurno())
                && normalizarDias(existente.getDiasSemana()).equals(normalizarDias(proposta.getDiasSemana()));
    }

    private Set<String> normalizarDias(Set<String> dias) {
        if (dias == null) return Set.of();
        return dias.stream()
                .filter(Objects::nonNull)
                .map(dia -> dia.toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
    }

    private boolean diasCoincidem(java.util.Set<String> um, java.util.Set<String> outro) {
        return um.stream().anyMatch(dia -> outro.stream().anyMatch(candidato -> dia.equalsIgnoreCase(candidato)));
    }
}
