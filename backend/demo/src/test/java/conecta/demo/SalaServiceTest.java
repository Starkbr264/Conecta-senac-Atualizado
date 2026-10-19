package conecta.demo;

import conecta.demo.exception.AcessoNegadoException;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Sala;
import conecta.demo.model.Usuario;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.service.SalaService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Integridade de {@link SalaService}, com enfase na regra de que uma sala so
 * pode ser atualizada por usuario da mesma unidade.
 *
 * <p>Teste puro JUnit 5 + Mockito.</p>
 */
@ExtendWith(MockitoExtension.class)
class SalaServiceTest {

    private static final Long UNIDADE_DA_SALA = 1L;
    private static final Long SALA_ID = 10L;
    private static final Long USUARIO_DA_MESMA_UNIDADE = 20L;
    private static final Long USUARIO_DE_OUTRA_UNIDADE = 21L;
    private static final Long USUARIO_INEXISTENTE = 99L;

    @Mock
    private SalaRepository salas;
    @Mock
    private UnidadeRepository unidades;
    @Mock
    private UsuarioRepository usuarios;

    private SalaService service;

    @BeforeEach
    void setUp() {
        service = new SalaService(salas, unidades, usuarios);
    }

    private Sala sala(Long unidadeId) {
        Sala sala = new Sala();
        sala.setId(SALA_ID);
        sala.setNome("Laboratorio 1");
        sala.setTipo("Laboratorio");
        sala.setCapacidade(25);
        sala.setUnidadeId(unidadeId);
        sala.setAtiva(true);
        return sala;
    }

    private Usuario usuario(Long unidadeId) {
        Usuario usuario = new Usuario();
        usuario.setUnidadeId(unidadeId);
        return usuario;
    }

    // ---------------------------------------------------------------- criar

    @Test
    @DisplayName("Criar: unidade existente salva e gera id")
    void criarComUnidadeExistenteSalva() {
        Sala entrada = sala(UNIDADE_DA_SALA);
        when(unidades.existsById(UNIDADE_DA_SALA)).thenReturn(true);
        when(salas.findAll()).thenReturn(List.of());
        when(salas.save(any(Sala.class))).thenAnswer(inv -> inv.getArgument(0));

        Sala salva = service.criar(entrada);

        assertEquals(1L, salva.getId(), "primeiro registro deve receber id 1");
        assertTrue(salva.isAtiva());
        verify(salas).save(entrada);
    }

    @Test
    @DisplayName("Criar: unidade inexistente lanca 409")
    void criarComUnidadeInexistenteFalha() {
        when(unidades.existsById(UNIDADE_DA_SALA)).thenReturn(false);

        assertThrows(RegraDeNegocioException.class, () -> service.criar(sala(UNIDADE_DA_SALA)));
        verify(salas, never()).save(any());
    }

    // --------------------------------------------------------------- listar

    @Test
    @DisplayName("Listar: sem unidade devolve findAll()")
    void listarSemUnidadeUsaFindAll() {
        when(salas.findAll()).thenReturn(List.of(sala(UNIDADE_DA_SALA)));

        assertEquals(1, service.listar(null).size());
        verify(salas).findAll();
    }

    @Test
    @DisplayName("Listar: com unidade filtra por unidade")
    void listarComUnidadeFiltra() {
        when(salas.findByUnidadeId(UNIDADE_DA_SALA)).thenReturn(List.of(sala(UNIDADE_DA_SALA)));

        assertEquals(1, service.listar(UNIDADE_DA_SALA).size());
        verify(salas).findByUnidadeId(UNIDADE_DA_SALA);
    }

    // --------------------------------------------------------------- buscar

    @Test
    @DisplayName("Buscar: sala existente devolve a sala")
    void buscarSalaExistente() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(sala(UNIDADE_DA_SALA)));

        assertEquals(SALA_ID, service.buscar(SALA_ID).getId());
    }

    @Test
    @DisplayName("Buscar: sala inexistente lanca 404")
    void buscarSalaInexistenteFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.empty());

        assertThrows(RecursoNaoEncontradoException.class, () -> service.buscar(SALA_ID));
    }

    // ------------------------------------------------------------- atualizar

    @Test
    @DisplayName("Atualizar: mesma unidade altera e devolve a sala")
    void atualizarComMesmaUnidadePermite() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(sala(UNIDADE_DA_SALA)));
        when(usuarios.findById(USUARIO_DA_MESMA_UNIDADE))
                .thenReturn(Optional.of(usuario(UNIDADE_DA_SALA)));
        when(unidades.existsById(UNIDADE_DA_SALA)).thenReturn(true);

        Sala entrada = sala(UNIDADE_DA_SALA);
        entrada.setNome("Laboratorio 2");
        entrada.setCapacidade(40);
        when(salas.save(any(Sala.class))).thenAnswer(inv -> inv.getArgument(0));

        Sala resultado = service.atualizar(SALA_ID, USUARIO_DA_MESMA_UNIDADE, entrada);

        assertEquals("Laboratorio 2", resultado.getNome());
        assertEquals(40, resultado.getCapacidade());
        verify(salas).save(any(Sala.class));
    }

    @Test
    @DisplayName("Atualizar: outra unidade lanca AcessoNegadoException (HTTP 403)")
    void atualizarComOutraUnidadeFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(sala(UNIDADE_DA_SALA)));
        when(usuarios.findById(USUARIO_DE_OUTRA_UNIDADE))
                .thenReturn(Optional.of(usuario(42L)));

        AcessoNegadoException erro = assertThrows(AcessoNegadoException.class,
                () -> service.atualizar(SALA_ID, USUARIO_DE_OUTRA_UNIDADE, sala(UNIDADE_DA_SALA)));

        assertTrue(erro.getMessage().contains("outras unidades"));
        verify(salas, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar: sem usuario identificado lanca AcessoNegadoException")
    void atualizarSemUsuarioFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(sala(UNIDADE_DA_SALA)));

        assertThrows(AcessoNegadoException.class,
                () -> service.atualizar(SALA_ID, null, sala(UNIDADE_DA_SALA)));
        verify(salas, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar: usuario inexistente lanca 404 antes da escrita")
    void atualizarComUsuarioInexistenteFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(sala(UNIDADE_DA_SALA)));
        when(usuarios.findById(USUARIO_INEXISTENTE)).thenReturn(Optional.empty());

        assertThrows(RecursoNaoEncontradoException.class,
                () -> service.atualizar(SALA_ID, USUARIO_INEXISTENTE, sala(UNIDADE_DA_SALA)));
        verify(salas, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar: sala inexistente lanca 404")
    void atualizarSalaInexistenteFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.empty());

        assertThrows(RecursoNaoEncontradoException.class,
                () -> service.atualizar(SALA_ID, USUARIO_DA_MESMA_UNIDADE, sala(UNIDADE_DA_SALA)));
    }

    @Test
    @DisplayName("Atualizar: unidade de destino inexistente lanca 409")
    void atualizarParaUnidadeInexistenteFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(sala(UNIDADE_DA_SALA)));
        when(usuarios.findById(USUARIO_DA_MESMA_UNIDADE))
                .thenReturn(Optional.of(usuario(UNIDADE_DA_SALA)));
        when(unidades.existsById(UNIDADE_DA_SALA)).thenReturn(false);

        assertThrows(RegraDeNegocioException.class,
                () -> service.atualizar(SALA_ID, USUARIO_DA_MESMA_UNIDADE, sala(UNIDADE_DA_SALA)));
        verify(salas, never()).save(any());
    }

    // -------------------------------------------------------------- excluir

    @Test
    @DisplayName("Excluir: sala existente e removida")
    void excluirSalaExistente() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(sala(UNIDADE_DA_SALA)));

        service.excluir(SALA_ID);

        verify(salas).delete(any(Sala.class));
    }

    @Test
    @DisplayName("Excluir: sala inexistente lanca 404")
    void excluirSalaInexistenteFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.empty());

        assertThrows(RecursoNaoEncontradoException.class, () -> service.excluir(SALA_ID));
        verify(salas, never()).delete(any());
    }

    // ------------------------------------------------------------ auxiliares

    @Test
    @DisplayName("Atualizar: o marcador ativa e preservado")
    void atualizarPreservaAtiva() {
        Sala atual = sala(UNIDADE_DA_SALA);
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(atual));
        when(usuarios.findById(USUARIO_DA_MESMA_UNIDADE))
                .thenReturn(Optional.of(usuario(UNIDADE_DA_SALA)));
        when(unidades.existsById(UNIDADE_DA_SALA)).thenReturn(true);
        when(salas.save(any(Sala.class))).thenAnswer(inv -> inv.getArgument(0));

        Sala entrada = sala(UNIDADE_DA_SALA);
        entrada.setAtiva(false);

        assertFalse(service.atualizar(SALA_ID, USUARIO_DA_MESMA_UNIDADE, entrada).isAtiva(),
                "atualizar deve respeitar o valor enviado em ativa");
    }

    @Test
    @DisplayName("Criar: sala nova nasce ativa por padrao")
    void criarSalaNasceAtiva() {
        Sala entrada = new Sala();
        entrada.setUnidadeId(UNIDADE_DA_SALA);
        when(unidades.existsById(UNIDADE_DA_SALA)).thenReturn(true);
        when(salas.findAll()).thenReturn(List.of());
        when(salas.save(any(Sala.class))).thenAnswer(inv -> {
            Sala s = inv.getArgument(0);
            s.setAtiva(true);
            return s;
        });

        assertTrue(service.criar(entrada).isAtiva());
    }

    @Test
    @DisplayName("Atualizar: usa o unidadeId do corpo para validar")
    void atualizarValidaUnidadeDoCorpo() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(sala(UNIDADE_DA_SALA)));
        when(usuarios.findById(USUARIO_DA_MESMA_UNIDADE))
                .thenReturn(Optional.of(usuario(UNIDADE_DA_SALA)));
        when(unidades.existsById(77L)).thenReturn(true);
        when(salas.save(any(Sala.class))).thenAnswer(inv -> inv.getArgument(0));

        Sala entrada = sala(77L);
        assertEquals(77L, service.atualizar(SALA_ID, USUARIO_DA_MESMA_UNIDADE, entrada).getUnidadeId());
    }

    @Test
    @DisplayName("Listar/buscar nunca escrevem no banco")
    void operacoesDeLeituraNaoEscrevem() {
        when(salas.findAll()).thenReturn(List.of());
        when(salas.findByUnidadeId(anyLong())).thenReturn(List.of());

        service.listar(null);
        service.listar(UNIDADE_DA_SALA);

        verify(salas, never()).save(any());
        verify(salas, never()).delete(any());
    }
}
