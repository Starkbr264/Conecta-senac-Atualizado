package conecta.demo;

import conecta.demo.dto.RespostaSolicitacaoRequest;
import conecta.demo.dto.SolicitacaoRequest;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Notificacao;
import conecta.demo.model.Sala;
import conecta.demo.model.Solicitacao;
import conecta.demo.model.StatusSolicitacao;
import conecta.demo.model.Usuario;
import conecta.demo.repository.NotificacaoRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.service.ReservaService;
import conecta.demo.service.SolicitacaoService;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Integridade de {@link SolicitacaoService}.
 *
 * <p>Caso valido: solicitacao criada com instrutor, sala e unidade compativeis.
 * Caso invalido: unidade divergente → {@link RegraDeNegocioException} (HTTP 409
 * no controlador).</p>
 *
 * <p>Teste puro JUnit 5 + Mockito.</p>
 */
@ExtendWith(MockitoExtension.class)
class SolicitacaoServiceTest {

    private static final Long UNIDADE_OK = 1L;
    private static final Long SALA_ID = 10L;
    private static final Long INSTRUTOR_ID = 20L;
    private static final Long SOLICITACAO_ID = 30L;

    @Mock
    private SolicitacaoRepository solicitacoes;
    @Mock
    private SalaRepository salas;
    @Mock
    private UsuarioRepository usuarios;
    @Mock
    private ReservaService reservas;
    @Mock
    private NotificacaoRepository notificacoes;

    private SolicitacaoService service;

    @BeforeEach
    void setUp() {
        service = new SolicitacaoService(solicitacoes, salas, usuarios, reservas, notificacoes);
    }

    private Sala salaDaUnidade(Long unidadeId) {
        Sala sala = new Sala();
        sala.setUnidadeId(unidadeId);
        return sala;
    }

    private Usuario instrutorDaUnidade(Long unidadeId) {
        Usuario usuario = new Usuario();
        usuario.setUnidadeId(unidadeId);
        return usuario;
    }

    private SolicitacaoRequest request(Long unidadeId) {
        return new SolicitacaoRequest(
                SALA_ID,
                INSTRUTOR_ID,
                null,
                Set.of("Matutino"),
                null,
                null,
                null,
                Set.of("seg"),
                null,
                null,
                null,
                "periodo",
                "Matutino",
                "Aula pratica",
                unidadeId);
    }

    @Test
    @DisplayName("Criar: unidade compativel salva e devolve a solicitacao")
    void criarComUnidadeCompativelSalva() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(salaDaUnidade(UNIDADE_OK)));
        when(usuarios.findById(INSTRUTOR_ID)).thenReturn(Optional.of(instrutorDaUnidade(UNIDADE_OK)));
        when(solicitacoes.findAll()).thenReturn(List.of());

        Solicitacao salva = new Solicitacao();
        when(solicitacoes.save(any(Solicitacao.class))).thenAnswer(inv -> {
            Solicitacao s = inv.getArgument(0);
            s.setId(SOLICITACAO_ID);
            return s;
        });

        Solicitacao resultado = service.criar(request(UNIDADE_OK));

        assertEquals(SOLICITACAO_ID, resultado.getId());
        verify(solicitacoes).save(any(Solicitacao.class));
        verify(reservas, never()).criar(any());
        verify(notificacoes, never()).save(any());
    }

    @Test
    @DisplayName("Criar: unidade divergente do instrutor lanca 409")
    void criarComUnidadeDivergenteDoInstrutorFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(salaDaUnidade(UNIDADE_OK)));
        when(usuarios.findById(INSTRUTOR_ID)).thenReturn(Optional.of(instrutorDaUnidade(99L)));

        RegraDeNegocioException erro =
                assertThrows(RegraDeNegocioException.class, () -> service.criar(request(UNIDADE_OK)));

        assertTrue(erro.getMessage().contains("compativeis"));
        verify(solicitacoes, never()).save(any());
    }

    @Test
    @DisplayName("Criar: unidade divergente da sala lanca 409")
    void criarComUnidadeDivergenteDaSalaFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(salaDaUnidade(99L)));
        when(usuarios.findById(INSTRUTOR_ID)).thenReturn(Optional.of(instrutorDaUnidade(UNIDADE_OK)));

        assertThrows(RegraDeNegocioException.class, () -> service.criar(request(UNIDADE_OK)));
        verify(solicitacoes, never()).save(any());
    }

    @Test
    @DisplayName("Criar: sala inexistente lanca 404")
    void criarComSalaInexistenteFalha() {
        when(salas.findById(SALA_ID)).thenReturn(Optional.isEmpty());

        assertThrows(conecta.demo.exception.RecursoNaoEncontradoException.class,
                () -> service.criar(request(UNIDADE_OK)));
    }

    @Test
    @DisplayName("Listar: sem filtros usa findAll()")
    void listarSemFiltroUsaFindAll() {
        when(solicitacoes.findAll()).thenReturn(List.of());

        assertEquals(List.of(), service.listar(null, null));
        verify(solicitacoes).findAll();
    }

    @Test
    @DisplayName("Listar: com unidadeId usa findByUnidadeId")
    void listarComUnidadeUsaFindByUnidadeId() {
        when(solicitacoes.findByUnidadeId(UNIDADE_OK)).thenReturn(List.of());

        service.listar(UNIDADE_OK, null);

        verify(solicitacoes).findByUnidadeId(UNIDADE_OK);
    }

    @Test
    @DisplayName("Listar: com instrutorId usa findByInstrutorId")
    void listarComInstrutorUsaFindByInstrutorId() {
        when(solicitacoes.findByInstrutorId(INSTRUTOR_ID)).thenReturn(List.of());

        service.listar(null, INSTRUTOR_ID);

        verify(solicitacoes).findByInstrutorId(INSTRUTOR_ID);
    }

    @Test
    @DisplayName("Responder: solicitacao ja respondida lanca 409")
    void responderSolicitacaoJaRespondidaFalha() {
        Solicitacao pendente = solicitacao(StatusSolicitacao.APROVADA);
        when(solicitacoes.findById(SOLICITACAO_ID)).thenReturn(Optional.of(pendente));

        assertThrows(RegraDeNegocioException.class,
                () -> service.responder(SOLICITACAO_ID, new RespostaSolicitacaoRequest("aprovar", "ok")));
        verify(solicitacoes, never()).save(any());
    }

    @Test
    @DisplayName("Responder: decisao fora de aprovar/recusar lanca 409")
    void responderComDecisaoInvalidaFalha() {
        when(solicitacoes.findById(SOLICITACAO_ID)).thenReturn(Optional.of(solicitacao(StatusSolicitacao.PENDENTE)));

        assertThrows(RegraDeNegocioException.class,
                () => service.responder(SOLICITACAO_ID, new RespostaSolicitacaoRequest("talvez", null)));
    }

    @Test
    @DisplayName("Responder: aprovar sem turnos lanca 409")
    void responderAprovarSemTurnosFalha() {
        Solicitacao semTurnos = solicitacao(StatusSolicitacao.PENDENTE);
        semTurnos.setTurnos(Set.of());
        when(solicitacoes.findById(SOLICITACAO_ID)).thenReturn(Optional.of(semTurnos));

        assertThrows(RegraDeNegocioException.class,
                () -> service.responder(SOLICITACAO_ID, new RespostaSolicitacaoRequest("aprovar", null)));
        verify(reservas, never()).criar(any());
    }

    @Test
    @DisplayName("Responder: aprovar com turnos cria uma reserva por turno")
    void responderAprovarCriaReservaPorTurno() {
        Solicitacao pendente = solicitacao(StatusSolicitacao.PENDENTE);
        pendente.setTurnos(Set.of("Matutino", "Vespertino"));
        when(solicitacoes.findById(SOLICITACAO_ID)).thenReturn(Optional.of(pendente));
        when(notificacoes.findAll()).thenReturn(List.of());

        service.responder(SOLICITACAO_ID, new RespostaSolicitacaoRequest("aprovar", "Aprovada"));

        verify(reservas, org.mockito.Mockito.times(2)).criar(any());
        assertEquals(StatusSolicitacao.APROVADA, pendente.getStatus());
    }

    @Test
    @DisplayName("Responder: recusar nao cria reserva nem altera turnos")
    void responderRecusarNaoCriaReserva() {
        Solicitacao pendente = solicitacao(StatusSolicitacao.PENDENTE);
        when(solicitacoes.findById(SOLICITACAO_ID)).thenReturn(Optional.of(pendente));
        when(notificacoes.findAll()).thenReturn(List.of());

        service.responder(SOLICITACAO_ID, new RespostaSolicitacaoRequest("recusar", "Indisponivel"));

        verify(reservas, never()).criar(any());
        assertEquals(StatusSolicitacao.RECUSADA, pendente.getStatus());
    }

    @Test
    @DisplayName("Responder: grava notificacao para o instrutor")
    void responderGravaNotificacao() {
        Solicitacao pendente = solicitacao(StatusSolicitacao.PENDENTE);
        when(solicitacoes.findById(SOLICITACAO_ID)).thenReturn(Optional.of(pendente));
        when(notificacoes.findAll()).thenReturn(List.of());

        service.responder(SOLICITACAO_ID, new RespostaSolicitacaoRequest("recusar", "Sala ocupada"));

        org.mockito.ArgumentCaptor<Notificacao> captor = org.mockito.ArgumentCaptor.forClass(Notificacao.class);
        verify(notificacoes).save(captor.capture());
        assertEquals(INSTRUTOR_ID, captor.getValue().getParaId());
        assertEquals("instrutor", captor.getValue().getParaPerfil());
    }

    private Solicitacao solicitacao(StatusSolicitacao status) {
        Solicitacao s = new Solicitacao();
        s.setId(SOLICITACAO_ID);
        s.setSalaId(SALA_ID);
        s.setInstrutorId(INSTRUTOR_ID);
        s.setUnidadeId(UNIDADE_OK);
        s.setStatus(status);
        s.setTurnos(Set.of("Matutino"));
        return s;
    }
}
