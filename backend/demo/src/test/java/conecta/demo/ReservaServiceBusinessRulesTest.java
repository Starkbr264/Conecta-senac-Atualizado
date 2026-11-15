package conecta.demo;

import conecta.demo.dto.ReservaRequest;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Reserva;
import conecta.demo.model.Sala;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.service.ReservaService;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReservaServiceBusinessRulesTest {
    @Mock ReservaRepository reservas;
    @Mock SalaRepository salas;
    @Mock TurmaRepository turmas;
    private ReservaService service;

    @BeforeEach
    void setUp() {
        service = new ReservaService(reservas, salas, turmas);
    }

    @Test
    void rejeitaReservaEmTurnoNaoDisponivelNaSala() {
        Sala sala = new Sala();
        sala.setId(1L);
        sala.setUnidadeId(1L);
        sala.setAtiva(true);
        sala.setTurnosDisponiveis(List.of("Matutino"));
        when(salas.findById(1L)).thenReturn(java.util.Optional.of(sala));

        ReservaRequest request = new ReservaRequest(
                1L, null, "Noturno", Set.of("seg"),
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2),
                null, null, null, 1L);

        assertThrows(RegraDeNegocioException.class, () -> service.criar(request));
    }

    @Test
    void rejeitaNovaReservaEmSalaEmManutencao() {
        Sala sala = salaComStatusManual("manutencao");
        when(salas.findById(1L)).thenReturn(java.util.Optional.of(sala));

        assertThrows(RegraDeNegocioException.class, () -> service.criar(request()));
    }

    @Test
    void rejeitaNovaReservaEmSalaIndisponivel() {
        Sala sala = salaComStatusManual("indisponivel");
        when(salas.findById(1L)).thenReturn(java.util.Optional.of(sala));

        assertThrows(RegraDeNegocioException.class, () -> service.criar(request()));
    }

    @Test
    void rejeitaReservaQuandoStatusManualBloqueadoTemEspacosEMaiusculas() {
        Sala sala = salaComStatusManual("  MANUTENCAO ");
        when(salas.findById(1L)).thenReturn(java.util.Optional.of(sala));

        assertThrows(RegraDeNegocioException.class, () -> service.criar(request()));
    }

    @Test
    void permiteNovaReservaEmSalaSemBloqueioManual() {
        Sala sala = salaComStatusManual(null);
        when(salas.findById(1L)).thenReturn(java.util.Optional.of(sala));
        when(reservas.findBySalaIdAndDataInicioLessThanEqualAndDataFimGreaterThanEqual(
                any(), any(), any())).thenReturn(List.of());

        assertDoesNotThrow(() -> service.criar(request()));
        verify(reservas).save(any());
    }

    @Test
    void rejeitaAtualizacaoQueTransfereReservaParaSalaBloqueada() {
        Sala sala = salaComStatusManual("indisponivel");
        when(salas.findById(1L)).thenReturn(java.util.Optional.of(sala));
        Reserva atual = reservaExistente(9L, 2L);
        when(reservas.findById(9L)).thenReturn(java.util.Optional.of(atual));

        assertThrows(RegraDeNegocioException.class, () -> service.atualizar(9L, request()));
    }

    @Test
    void permiteAtualizacaoAdministrativaDeReservaExistenteEmSalaBloqueada() {
        Sala sala = salaComStatusManual("manutencao");
        when(salas.findById(1L)).thenReturn(java.util.Optional.of(sala));
        Reserva atual = reservaExistente(9L, 1L);
        when(reservas.findById(9L)).thenReturn(java.util.Optional.of(atual));
        when(reservas.findBySalaIdAndDataInicioLessThanEqualAndDataFimGreaterThanEqual(
                any(), any(), any())).thenReturn(List.of());

        assertDoesNotThrow(() -> service.atualizar(9L, request()));
        verify(reservas).save(any());
    }

    private ReservaRequest request() {
        return new ReservaRequest(
                1L, null, "Matutino", Set.of("seg"),
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2),
                null, null, null, 1L);
    }

    private Sala salaComStatusManual(String statusManual) {
        Sala sala = new Sala();
        sala.setId(1L);
        sala.setUnidadeId(1L);
        sala.setAtiva(true);
        sala.setTurnosDisponiveis(List.of("Matutino"));
        sala.setStatusManual(statusManual);
        return sala;
    }

    private Reserva reservaExistente(Long id, Long salaId) {
        Reserva reserva = new Reserva();
        reserva.setId(id);
        reserva.setSalaId(salaId);
        reserva.setTurno("Matutino");
        reserva.setDiasSemana(Set.of("seg"));
        reserva.setDataInicio(LocalDate.of(2026, 1, 1));
        reserva.setDataFim(LocalDate.of(2026, 1, 2));
        reserva.setUnidadeId(1L);
        return reserva;
    }
}
