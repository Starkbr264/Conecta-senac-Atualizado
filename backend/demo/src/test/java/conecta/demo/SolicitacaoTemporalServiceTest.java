package conecta.demo;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.service.SolicitacaoTemporalService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SolicitacaoTemporalServiceTest {
    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private SolicitacaoTemporalService service(String hora) {
        Instant instante = LocalDate.of(2026, 11, 18).atTime(LocalTime.parse(hora)).atZone(ZONE).toInstant();
        return new SolicitacaoTemporalService(Clock.fixed(instante, ZONE), ZONE, Map.of(
                "matutino", new SolicitacaoTemporalService.IntervaloTurno(LocalTime.of(8, 0), LocalTime.of(12, 0)),
                "vespertino", new SolicitacaoTemporalService.IntervaloTurno(LocalTime.of(14, 0), LocalTime.of(18, 0)),
                "noturno", new SolicitacaoTemporalService.IntervaloTurno(LocalTime.of(19, 0), LocalTime.of(22, 0))));
    }

    @Test
    void rejeitaDataAnterior() {
        assertThrows(RegraDeNegocioException.class, () ->
                service("12:00").validar(LocalDate.of(2026, 11, 17), LocalDate.of(2026, 11, 17),
                        null, java.util.List.of("Noturno"), null, null));
    }

    @Test
    void aceitaTurnoFuturoHoje() {
        service("07:30").validar(LocalDate.of(2026, 11, 18), LocalDate.of(2026, 11, 18),
                null, java.util.List.of("Noturno"), null, null);
    }

    @ParameterizedTest(name = "{0} para {1} resulta em {2}")
    @CsvSource({
            "07:59, Matutino, ''",
            "08:00, Matutino, 'Turno em andamento'",
            "11:59, Matutino, 'Turno em andamento'",
            "12:00, Matutino, 'Turno encerrado'",
            "13:59, Vespertino, ''",
            "14:00, Vespertino, 'Turno em andamento'",
            "17:59, Vespertino, 'Turno em andamento'",
            "18:00, Vespertino, 'Turno encerrado'",
            "18:59, Noturno, ''",
            "19:00, Noturno, 'Turno em andamento'",
            "21:59, Noturno, 'Turno em andamento'",
            "22:00, Noturno, 'Turno encerrado'"
    })
    void classificaLimitesDosTurnos(String hora, String turno, String esperado) {
        assertEquals(esperado.isEmpty() ? null : esperado,
                service(hora).diagnostico(LocalDate.of(2026, 11, 18), turno, null, null));
    }

    @Test
    void permiteTurnoFuturoNosIntervalosEntreTurnos() {
        service("12:30").validar(LocalDate.of(2026, 11, 18), LocalDate.of(2026, 11, 18),
                null, java.util.List.of("Vespertino", "Noturno"), null, null);
    }
}
