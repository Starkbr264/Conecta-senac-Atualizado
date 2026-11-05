package conecta.demo;

import conecta.demo.model.Usuario;
import conecta.demo.model.Sala;
import conecta.demo.repository.ChaveRepository;
import conecta.demo.repository.NotificacaoRepository;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.service.DadosService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DadosServiceScopeTest {
    @Mock UsuarioRepository usuarios;
    @Mock UnidadeRepository unidades;
    @Mock SalaRepository salas;
    @Mock TurmaRepository turmas;
    @Mock ReservaRepository reservas;
    @Mock ChaveRepository chaves;
    @Mock NotificacaoRepository notificacoes;
    @Mock SolicitacaoRepository solicitacoes;

    @Test
    void bancoFiltraColecoesPelaUnidadeDoUsuario() {
        Usuario usuario = new Usuario();
        usuario.setId(7L);
        usuario.setUnidadeId(2L);
        when(usuarios.findAll()).thenReturn(List.of());
        when(unidades.findAll()).thenReturn(List.of());
        Sala local = new Sala();
        local.setUnidadeId(2L);
        Sala foreign = new Sala();
        foreign.setUnidadeId(1L);
        when(salas.findAll()).thenReturn(List.of(local, foreign));
        when(turmas.findAll()).thenReturn(List.of());
        when(reservas.findAll()).thenReturn(List.of());
        when(chaves.findAll()).thenReturn(List.of());
        when(notificacoes.findAll()).thenReturn(List.of());
        when(solicitacoes.findAll()).thenReturn(List.of());

        DadosService service = new DadosService(usuarios, unidades, salas, turmas,
                reservas, chaves, notificacoes, solicitacoes);
        assertEquals(1, ((List<?>) service.banco(usuario).get("salas")).size());
    }
}
