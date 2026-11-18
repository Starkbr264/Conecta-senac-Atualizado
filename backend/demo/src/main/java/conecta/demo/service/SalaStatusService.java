package conecta.demo.service;

import conecta.demo.dto.SalaStatusResponse;
import conecta.demo.model.Reserva;
import conecta.demo.model.Sala;
import conecta.demo.model.Turma;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.TurmaRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fonte única do estado de ocupação apresentado pelo mapa e pelas telas de
 * solicitação. Solicitações não aparecem aqui: somente reservas efetivas
 * ocupam uma sala.
 */
@Service
@Transactional(readOnly = true)
public class SalaStatusService {
    private static final int JANELA_IMINENTE_DIAS = 7;

    private final SalaRepository salas;
    private final ReservaRepository reservas;
    private final TurmaRepository turmas;
    private final UsuarioAtual usuarioAtual;

    public SalaStatusService(SalaRepository salas, ReservaRepository reservas,
                             TurmaRepository turmas, UsuarioAtual usuarioAtual) {
        this.salas = salas;
        this.reservas = reservas;
        this.turmas = turmas;
        this.usuarioAtual = usuarioAtual;
    }

    public List<SalaStatusResponse> listar(Long unidadeId, LocalDate inicio, LocalDate fim,
                                           String horaInicio, String horaFim, String turno) {
        Long unidadeVisivel = unidadePermitida(unidadeId);
        LocalDate dataInicial = inicio == null ? LocalDate.now() : inicio;
        LocalDate dataFinal = fim == null ? dataInicial : fim;
        if (dataFinal.isBefore(dataInicial)) {
            throw new IllegalArgumentException("A data final deve ser posterior a data inicial");
        }
        return salas.findByUnidadeId(unidadeVisivel).stream()
                .map(sala -> calcular(sala, dataInicial, dataFinal, horaInicio, horaFim, turno))
                .toList();
    }

    private Long unidadePermitida(Long solicitada) {
        var usuario = usuarioAtual.buscar()
                .orElseThrow(() -> new conecta.demo.exception.AcessoNegadoException("Usuario nao autenticado"));
        if (usuario.getPerfil().name().equals("ADMIN")) {
            return solicitada == null ? usuario.getUnidadeId() : solicitada;
        }
        if (solicitada != null && !solicitada.equals(usuario.getUnidadeId())) {
            throw new conecta.demo.exception.AcessoNegadoException("Acesso negado a outra unidade");
        }
        return usuario.getUnidadeId();
    }

    private SalaStatusResponse calcular(Sala sala, LocalDate inicio, LocalDate fim,
                                        String horaInicio, String horaFim, String turno) {
        Resultado atual = calcularAutomatico(sala, LocalDate.now(), LocalDate.now(), null, null, null, true);
        String manual = normalizar(sala.getStatusManual());
        // Override manual tem precedencia absoluta — os cinco estados, inclusive
        // 'livre'. Somente statusManual nulo (Auto) devolve o calculo ao automatico:
        // tratar 'livre' como Auto fazia a API ocultar a marcacao do coordenador.
        if (!manual.isEmpty()) {
            return resposta(sala, manual, sala.getMotivoManual(), null, null, null, manual);
        }
        String statusAtual = atual.status;
        boolean consultaDoEstadoAtual = inicio.equals(LocalDate.now()) && fim.equals(inicio)
                && (horaInicio == null || horaInicio.isBlank())
                && (horaFim == null || horaFim.isBlank());
        Resultado periodo = calcularAutomatico(sala, inicio, fim, horaInicio, horaFim, turno,
                consultaDoEstadoAtual);
        return resposta(sala, periodo.status, periodo.reason, periodo.inicio, periodo.fim,
                periodo.turma, statusAtual);
    }

    private Resultado calcularAutomatico(Sala sala, LocalDate inicio, LocalDate fim,
                                          String horaInicio, String horaFim, String turno,
                                          boolean estadoAtual) {
        List<Reserva> candidatas = reservas.findBySalaIdAndDataInicioLessThanEqualAndDataFimGreaterThanEqual(
                sala.getId(), fim, inicio).stream()
                .filter(r -> !"CANCELADA".equalsIgnoreCase(r.getStatus()))
                .filter(r -> turno == null || turno.isBlank() || turno.equalsIgnoreCase(r.getTurno()))
                .filter(r -> r.getDiasSemana() == null || r.getDiasSemana().isEmpty()
                        || diasCoincidem(r, inicio, fim))
                .filter(r -> intervaloCoincide(r, horaInicio, horaFim))
                .sorted(Comparator.comparing(Reserva::getDataInicio))
                .toList();

        for (Reserva reserva : candidatas) {
            Turma turma = reserva.getTurmaId() == null ? null : turmas.findById(reserva.getTurmaId()).orElse(null);
            if (turma != null && turma.getDataFim() != null && turma.getDataFim().isBefore(inicio)) continue;
            if (estadoAtual && turma != null && turma.getDataInicio() != null
                    && turma.getDataInicio().isAfter(LocalDate.now())) {
                long dias = ChronoUnit.DAYS.between(LocalDate.now(), turma.getDataInicio());
                if (dias <= JANELA_IMINENTE_DIAS) {
                    return detalhe("iminente", reserva, turma);
                }
                continue;
            }
            return detalhe("ocupada", reserva, turma);
        }
        return new Resultado("livre", null, null, null, null);
    }

    private boolean diasCoincidem(Reserva reserva, LocalDate inicio, LocalDate fim) {
        for (LocalDate dia = inicio; !dia.isAfter(fim); dia = dia.plusDays(1)) {
            final LocalDate diaAtual = dia;
            String abreviatura = switch (dia.getDayOfWeek()) {
                case SUNDAY -> "dom"; case MONDAY -> "seg"; case TUESDAY -> "ter";
                case WEDNESDAY -> "qua"; case THURSDAY -> "qui"; case FRIDAY -> "sex";
                case SATURDAY -> "sab";
            };
            if (reserva.getDiasSemana().stream().anyMatch(d -> d.equalsIgnoreCase(abreviatura)
                    || d.equalsIgnoreCase(diaAtual.getDayOfWeek().name()))) return true;
        }
        return false;
    }

    private boolean intervaloCoincide(Reserva reserva, String inicio, String fim) {
        if (inicio == null || inicio.isBlank() || fim == null || fim.isBlank()
                || reserva.getHoraInicio() == null || reserva.getHoraFim() == null) return true;
        return LocalTime.parse(reserva.getHoraInicio()).isBefore(LocalTime.parse(fim))
                && LocalTime.parse(reserva.getHoraFim()).isAfter(LocalTime.parse(inicio));
    }

    private Resultado detalhe(String status, Reserva reserva, Turma turma) {
        String nome = turma == null ? "Sem turma" : turma.getNome();
        return new Resultado(status, reserva.getHoraInicio(), reserva.getHoraFim(), nome, null);
    }

    private SalaStatusResponse resposta(Sala sala, String status, String reason, String inicio,
                                        String fim, String turma, String statusAtual) {
        return new SalaStatusResponse(sala.getId(), sala.getNome(), status, reason, inicio, fim, turma, statusAtual);
    }

    private String normalizar(String valor) {
        return valor == null ? "" : valor.trim().toLowerCase(Locale.ROOT);
    }

    private record Resultado(String status, String inicio, String fim, String turma, String reason) {}
}
