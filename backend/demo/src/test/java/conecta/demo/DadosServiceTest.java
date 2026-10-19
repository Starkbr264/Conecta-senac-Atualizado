package conecta.demo;

import conecta.demo.model.Sala;
import conecta.demo.model.Usuario;
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
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link DadosService#banco()} devolve as oito colecoes de dominio num unico
 * mapa, e nenhum repositorio e consultado mais de uma vez.
 *
 * <p>Teste puro JUnit 5 + Mockito: nao sobe o Spring e nao usa banco.</p>
 */
@ExtendWith(MockitoExtension.class)
class DadosServiceTest {

    @Mock
    private UsuarioRepository usuarios;
    @Mock
    private UnidadeRepository unidades;
    @Mock
    private SalaRepository salas;
    @Mock
    private TurmaRepository turmas;
    @Mock
    private ReservaRepository reservas;
    @Mock
    private ChaveRepository chaves;
    @Mock
    private NotificacaoRepository notificacoes;
    @Mock
    private SolicitacaoRepository solicitacoes;

    @InjectMocks
    private DadosService service;

    private static final String[] CHAVES = {
        "usuarios", "unidades", "salas", "turmas", "reservas", "chaves", "notificacoes", "solicitacoes"
    };

    @Test
    @DisplayName("banco() devolve mapa com as oito colecoes")
    void bancoDevolveOitoColecoes() {
        Map<String, Object> banco = service.banco();

        assertEquals(8, banco.size(), "banco() deve conter exatamente 8 chaves");
        for (String chave : CHAVES) {
            assertTrue(banco.containsKey(chave), "chave ausente: " + chave);
        }
    }

    @Test
    @DisplayName("Cada repositorio e consultado uma unica vez com findAll()")
    void cadaRepositorioEChamadoUmaVez() {
        when(usuarios.findAll()).thenReturn(List.of());
        when(unidades.findAll()).thenReturn(List.of());
        when(salas.findAll()).thenReturn(List.of());
        when(turmas.findAll()).thenReturn(List.of());
        when(reservas.findAll()).thenReturn(List.of());
        when(chaves.findAll()).thenReturn(List.of());
        when(notificacoes.findAll()).thenReturn(List.of());
        when(solicitacoes.findAll()).thenReturn(List.of());

        service.banco();

        verify(usuarios, times(1)).findAll();
        verify(unidades, times(1)).findAll();
        verify(salas, times(1)).findAll();
        verify(turmas, times(1)).findAll();
        verify(reservas, times(1)).findAll();
        verify(chaves, times(1)).findAll();
        verify(notificacoes, times(1)).findAll();
        verify(solicitacoes, times(1)).findAll();
    }

    @Test
    @DisplayName("As listas devolvidas pelos repositorios sao as mesmas instancias no mapa")
    void listasSaoAsMesmasInstancias() {
        List<Usuario> listaDeUsuarios = List.of();
        List<Sala> listaDeSalas = List.of();
        when(usuarios.findAll()).thenReturn(listaDeUsuarios);
        when(salas.findAll()).thenReturn(listaDeSalas);

        Map<String, Object> banco = service.banco();

        assertSame(listaDeUsuarios, banco.get("usuarios"));
        assertSame(listaDeSalas, banco.get("salas"));
    }

    @Test
    @DisplayName("sessao e ultimaSic NAO fazem parte do snapshot")
    void sessaoEFultimaSincNaoAparecem() {
        Map<String, Object> banco = service.banco();

        assertFalse(banco.containsKey("sessao"), "sessao nao deve ir para o snapshot");
        assertFalse(banco.containsKey("ultimaSinc"), "ultimaSinc nao deve ir para o snapshot");
    }
}
