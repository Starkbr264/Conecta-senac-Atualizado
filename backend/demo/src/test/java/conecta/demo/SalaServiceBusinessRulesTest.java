package conecta.demo;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Sala;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.service.SalaService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SalaServiceBusinessRulesTest {
    @Mock SalaRepository salas;
    @Mock UnidadeRepository unidades;
    @Mock UsuarioRepository usuarios;
    @Mock ReservaRepository reservas;

    @Test
    void rejeitaSalaSemTurnosDisponiveis() {
        Sala sala = new Sala();
        sala.setNome("Sala");
        sala.setTipo("Aula");
        sala.setCapacidade(20);
        sala.setUnidadeId(1L);
        when(unidades.existsById(1L)).thenReturn(true);

        SalaService service = new SalaService(salas, unidades, usuarios, reservas);
        assertThrows(RegraDeNegocioException.class, () -> service.criar(sala));
    }

    @Test
    void rejeitaExclusaoDeSalaComReserva() {
        Sala sala = new Sala();
        sala.setId(1L);
        sala.setUnidadeId(1L);
        when(salas.findById(1L)).thenReturn(java.util.Optional.of(sala));
        when(reservas.existsBySalaId(1L)).thenReturn(true);

        SalaService service = new SalaService(salas, unidades, usuarios, reservas);
        assertThrows(RegraDeNegocioException.class, () -> service.excluir(1L));
        verify(salas, never()).delete(sala);
    }
}
