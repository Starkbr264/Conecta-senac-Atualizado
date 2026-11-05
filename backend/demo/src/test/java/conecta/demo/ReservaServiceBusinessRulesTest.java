package conecta.demo;

import conecta.demo.dto.ReservaRequest;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Sala;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.service.ReservaService;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReservaServiceBusinessRulesTest {
    @Mock ReservaRepository reservas;
    @Mock SalaRepository salas;
    @Mock TurmaRepository turmas;

    @Test
    void rejeitaReservaEmTurnoNaoDisponivelNaSala() {
        Sala sala = new Sala();
        sala.setId(1L);
        sala.setUnidadeId(1L);
        sala.setAtiva(true);
        sala.setTurnosDisponiveis(List.of("Matutino"));
        when(salas.findById(1L)).thenReturn(java.util.Optional.of(sala));

        ReservaService service = new ReservaService(reservas, salas, turmas);
        ReservaRequest request = new ReservaRequest(
                1L, null, "Noturno", Set.of("seg"),
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2),
                null, null, null, 1L);

        assertThrows(RegraDeNegocioException.class, () -> service.criar(request));
    }
}
