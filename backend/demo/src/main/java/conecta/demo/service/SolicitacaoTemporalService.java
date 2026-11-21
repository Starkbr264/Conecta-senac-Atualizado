package conecta.demo.service;

import conecta.demo.exception.RegraDeNegocioException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Regra temporal única das solicitações.
 *
 * <p>Os horários dos turnos não existiam no projeto. Eles são, portanto,
 * configuração explícita, e não constantes inventadas no código. Enquanto
 * não forem configurados, uma solicitação para o dia atual sem horário
 * individualizado é recusada de forma segura.</p>
 */
@Component
public class SolicitacaoTemporalService {
    private final Clock clock;
    private final ZoneId zoneId;
    private final Map<String, IntervaloTurno> horariosTurno;

    @org.springframework.beans.factory.annotation.Autowired
    public SolicitacaoTemporalService(
            @Value("${app.timezone:America/Sao_Paulo}") String timezone,
            @Value("${turnos.horarios.matutino:}") String matutino,
            @Value("${turnos.horarios.vespertino:}") String vespertino,
            @Value("${turnos.horarios.noturno:}") String noturno,
            @Value("${turnos.horarios.matutino.fim:}") String fimMatutino,
            @Value("${turnos.horarios.vespertino.fim:}") String fimVespertino,
            @Value("${turnos.horarios.noturno.fim:}") String fimNoturno) {
        this(Clock.systemUTC(), ZoneId.of(timezone), horarios(
                intervalo(matutino, fimMatutino),
                intervalo(vespertino, fimVespertino),
                intervalo(noturno, fimNoturno)));
    }

    public SolicitacaoTemporalService(Clock clock, ZoneId zoneId, Map<String, IntervaloTurno> horarios) {
        this.clock = clock;
        this.zoneId = zoneId;
        this.horariosTurno = horarios.entrySet().stream()
                .filter(entry -> entry.getValue() != null)
                .collect(java.util.stream.Collectors.toUnmodifiableMap(
                        entry -> entry.getKey().toLowerCase(Locale.ROOT),
                        Map.Entry::getValue));
    }

    public void validar(LocalDate inicio, LocalDate fim, List<String> datasEspecificas,
                        Iterable<String> turnos, String horaInicio, String horaFim) {
        LocalDate hoje = hoje();
        LocalDate primeira = inicio;
        if (primeira == null && datasEspecificas != null && !datasEspecificas.isEmpty()) {
            primeira = datasEspecificas.stream().map(LocalDate::parse).min(LocalDate::compareTo).orElse(null);
        }
        if (primeira == null) {
            throw new RegraDeNegocioException("A data da solicitacao e obrigatoria");
        }
        if (fim != null && fim.isBefore(primeira)) {
            throw new RegraDeNegocioException("A data final deve ser posterior a data inicial");
        }
        if (primeira.isBefore(hoje)) {
            throw new RegraDeNegocioException("Nao e possivel solicitar uma sala para uma data que ja passou");
        }
        if (datasEspecificas != null) {
            for (String data : datasEspecificas) {
                if (LocalDate.parse(data).isBefore(hoje)) {
                    throw new RegraDeNegocioException("Nao e possivel solicitar uma sala para uma data que ja passou");
                }
            }
        }
        if (!primeira.equals(hoje)) return;

        LocalTime agora = LocalDateTime.now(clock.withZone(zoneId)).toLocalTime();
        for (String turno : turnos) {
            IntervaloTurno intervalo = intervaloDoTurno(turno, horaInicio, horaFim);
            if (!agora.isBefore(intervalo.fim())) {
                throw new RegraDeNegocioException("O turno " + turno + " ja foi encerrado");
            }
            if (!agora.isBefore(intervalo.inicio())) {
                throw new RegraDeNegocioException("O turno " + turno + " ja comecou. Selecione um turno futuro");
            }
        }
    }

    public LocalDate hoje() {
        return LocalDate.now(clock.withZone(zoneId));
    }

    public String diagnostico(LocalDate data, String turno, String horaInicio, String horaFim) {
        if (data == null || data.isBefore(hoje())) return "Data passada";
        if (!data.equals(hoje())) return null;
        LocalTime agora = LocalDateTime.now(clock.withZone(zoneId)).toLocalTime();
        IntervaloTurno intervalo = intervaloDoTurno(turno, horaInicio, horaFim);
        if (!agora.isBefore(intervalo.fim())) return "Turno encerrado";
        if (!agora.isBefore(intervalo.inicio())) return "Turno em andamento";
        return null;
    }

    public Map<String, Object> configuracao() {
        return Map.of("timezone", zoneId.getId(), "agora", Instant.now(clock).toString(), "turnos", horariosTurno);
    }

    private IntervaloTurno intervaloDoTurno(String turno, String horaInicio, String horaFim) {
        if (horaInicio != null && !horaInicio.isBlank()) {
            try {
                LocalTime inicio = LocalTime.parse(horaInicio);
                if (horaFim == null || horaFim.isBlank()) {
                    throw new RegraDeNegocioException("O horario final e obrigatorio quando o inicio e informado");
                }
                return new IntervaloTurno(inicio, LocalTime.parse(horaFim));
            } catch (DateTimeParseException ex) {
                throw new RegraDeNegocioException("Horario inicial invalido");
            }
        }
        IntervaloTurno configurado = horariosTurno.get(String.valueOf(turno).toLowerCase(Locale.ROOT));
        if (configurado == null) {
            throw new RegraDeNegocioException(
                    "Os horarios do turno " + turno + " ainda nao foram configurados");
        }
        return configurado;
    }

    private static IntervaloTurno intervalo(String inicio, String fim) {
        if (inicio == null || inicio.isBlank() || fim == null || fim.isBlank()) return null;
        try {
            return new IntervaloTurno(LocalTime.parse(inicio), LocalTime.parse(fim));
        } catch (DateTimeParseException ex) {
            throw new IllegalStateException("Horario de turno invalido: " + inicio + " - " + fim, ex);
        }
    }

    public record IntervaloTurno(LocalTime inicio, LocalTime fim) {}

    private static Map<String, IntervaloTurno> horarios(IntervaloTurno matutino,
                                                         IntervaloTurno vespertino,
                                                         IntervaloTurno noturno) {
        Map<String, IntervaloTurno> resultado = new java.util.HashMap<>();
        resultado.put("matutino", matutino);
        resultado.put("vespertino", vespertino);
        resultado.put("noturno", noturno);
        return resultado;
    }
}
