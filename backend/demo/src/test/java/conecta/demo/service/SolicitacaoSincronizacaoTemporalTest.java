package conecta.demo.service;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Sala;
import conecta.demo.model.Solicitacao;
import conecta.demo.model.StatusSolicitacao;
import conecta.demo.model.Usuario;
import conecta.demo.repository.NotificacaoRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regra temporal do {@code /api/sinc} para solicitacoes.
 *
 * <p>A sincronizacao validava unidade/sala/instrutor/turma, mas NAO chamava o
 * {@link SolicitacaoTemporalService} — uma solicitacao Matutina para o proprio
 * dia era aceita apos as 12:00. Aqui ficam cobertos, com relogio fixo:</p>
 *
 * <ul>
 *   <li>criacao rejeitada fora do turno (Matutino/Vespertino as 17:49);</li>
 *   <li>criacao aceita para turno futuro do mesmo dia (Noturno as 17:49,
 *       Matutino as 07:30) e rejeitada para data passada;</li>
 *   <li>preservacao de registro historico cujos dados temporais NAO mudaram;</li>
 *   <li>rejeicao quando a atualizacao altera efetivamente o dado temporal.</li>
 * </ul>
 *
 * <p>Teste puro JUnit 5 + Mockito, no mesmo padrao de SolicitacaoServiceTest.</p>
 */
@ExtendWith(MockitoExtension.class)
class SolicitacaoSincronizacaoTemporalTest {

    private static final Long UNIDADE_OK = 1L;
    private static final Long SALA_ID = 10L;
    private static final Long INSTRUTOR_ID = 20L;
    /** "Hoje" dos relogios fixos abaixo (America/Sao_Paulo). */
    private static final LocalDate HOJE = LocalDate.of(2026, 11, 18);

    @Mock
    private SolicitacaoRepository solicitacoes;
    @Mock
    private SalaRepository salas;
    @Mock
    private UsuarioRepository usuarios;
    @Mock
    private UnidadeRepository unidades;
    @Mock
    private TurmaRepository turmas;
    @Mock
    private ReservaService reservas;
    @Mock
    private NotificacaoRepository notificacoes;

    private SolicitacaoService service;

    @BeforeEach
    void setUp() {
        when(unidades.existsById(UNIDADE_OK)).thenReturn(true);
        when(salas.findById(SALA_ID)).thenReturn(Optional.of(salaDaUnidade()));
        when(usuarios.findById(INSTRUTOR_ID)).thenReturn(Optional.of(instrutorDaUnidade()));
        service = serviceAt("17:49");
    }

    // ------------------------------------------------------------------
    // Criacao (anterior == null) sempre revalida a regra temporal
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Sinc: solicitacao Matutina para hoje as 17:49 e rejeitada antes de persistir")
    void sincRejeitaMatutinoEncerrado() {
        Solicitacao sol = nova(HOJE, Set.of("Matutino"));

        RegraDeNegocioException erro = assertThrows(RegraDeNegocioException.class,
                () -> service.validarParaSincronizacao(sol, null));

        assertTrue(erro.getMessage().contains("encerrado"), erro.getMessage());
        verify(solicitacoes, never()).save(ArgumentMatchers.any());
    }

    @Test
    @DisplayName("Sinc: solicitacao Vespertina para hoje as 17:49 (turno em andamento) e rejeitada")
    void sincRejeitaVespertinoEmAndamento() {
        Solicitacao sol = nova(HOJE, Set.of("Vespertino"));

        RegraDeNegocioException erro = assertThrows(RegraDeNegocioException.class,
                () -> service.validarParaSincronizacao(sol, null));

        assertTrue(erro.getMessage().contains("comecou"), erro.getMessage());
        verify(solicitacoes, never()).save(ArgumentMatchers.any());
    }

    @Test
    @DisplayName("Sinc: solicitacao Noturna para hoje as 17:49 (turno futuro) e aceita")
    void sincAceitaNoturnoFuturoHoje() {
        Solicitacao sol = nova(HOJE, Set.of("Noturno"));

        assertDoesNotThrow(() -> service.validarParaSincronizacao(sol, null));
    }

    @Test
    @DisplayName("Sinc: turno futuro no mesmo dia (Matutino as 07:30) e aceito")
    void sincAceitaTurnoFuturoNoMesmoDia() {
        service = serviceAt("07:30");
        Solicitacao sol = nova(HOJE, Set.of("Matutino"));

        assertDoesNotThrow(() -> service.validarParaSincronizacao(sol, null));
    }

    @Test
    @DisplayName("Sinc: solicitacao para data passada e rejeitada")
    void sincRejeitaDataPassada() {
        Solicitacao sol = nova(HOJE.minusDays(1), Set.of("Noturno"));

        RegraDeNegocioException erro = assertThrows(RegraDeNegocioException.class,
                () -> service.validarParaSincronizacao(sol, null));

        assertTrue(erro.getMessage().contains("passou"), erro.getMessage());
        verify(solicitacoes, never()).save(ArgumentMatchers.any());
    }

    // ------------------------------------------------------------------
    // Atualizacao: so revalida quando o dado temporal muda efetivamente
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Sinc: reenvio de solicitacao historica sem mudanca temporal e preservado")
    void sincPreservaHistoricoSemMudancaTemporal() {
        Solicitacao historica = nova(HOJE.minusDays(8), Set.of("Matutino"));
        historica.setStatus(StatusSolicitacao.PENDENTE);
        SolicitacaoService.EstadoTemporalSolicitacao anterior =
                SolicitacaoService.EstadoTemporalSolicitacao.de(historica);

        // Mesmos dados temporais recebidos de volta pelo delta (apenas status
        // e motivo mudam) — mesmo que a data ja tenha passado, nao ha o que
        // revalidar e o registro historico segue preservado.
        Solicitacao reenvio = nova(HOJE.minusDays(8), Set.of("Matutino"));
        reenvio.setStatus(StatusSolicitacao.APROVADA);
        reenvio.setMotivo("Reenvio do delta sem mudanca temporal");

        assertDoesNotThrow(() -> service.validarParaSincronizacao(reenvio, anterior));
    }

    @Test
    @DisplayName("Sinc: alteracao efetiva para data passada e rejeitada")
    void sincRejeitaAlteracaoTemporalParaDataPassada() {
        Solicitacao persistida = nova(HOJE.plusDays(3), Set.of("Noturno"));
        SolicitacaoService.EstadoTemporalSolicitacao anterior =
                SolicitacaoService.EstadoTemporalSolicitacao.de(persistida);

        Solicitacao alterada = nova(HOJE.minusDays(2), Set.of("Noturno"));

        RegraDeNegocioException erro = assertThrows(RegraDeNegocioException.class,
                () -> service.validarParaSincronizacao(alterada, anterior));

        assertTrue(erro.getMessage().contains("passou"), erro.getMessage());
        verify(solicitacoes, never()).save(ArgumentMatchers.any());
    }

    @Test
    @DisplayName("Sinc: alteracao para turno futuro do mesmo dia e aceita")
    void sincAceitaAlteracaoParaTurnoFuturo() {
        Solicitacao persistida = nova(HOJE, Set.of("Matutino"));
        SolicitacaoService.EstadoTemporalSolicitacao anterior =
                SolicitacaoService.EstadoTemporalSolicitacao.de(persistida);

        Solicitacao alterada = nova(HOJE, Set.of("Noturno"));

        assertDoesNotThrow(() -> service.validarParaSincronizacao(alterada, anterior));
    }

    // ------------------------------------------------------------------

    private SolicitacaoService serviceAt(String hora) {
        ZoneId zone = ZoneId.of("America/Sao_Paulo");
        SolicitacaoTemporalService temporal = new SolicitacaoTemporalService(
                Clock.fixed(HOJE.atTime(LocalTime.parse(hora)).atZone(zone).toInstant(), zone),
                zone,
                Map.of(
                        "matutino", new SolicitacaoTemporalService.IntervaloTurno(
                                LocalTime.of(8, 0), LocalTime.of(12, 0)),
                        "vespertino", new SolicitacaoTemporalService.IntervaloTurno(
                                LocalTime.of(14, 0), LocalTime.of(18, 0)),
                        "noturno", new SolicitacaoTemporalService.IntervaloTurno(
                                LocalTime.of(19, 0), LocalTime.of(22, 0))));
        return new SolicitacaoService(solicitacoes, salas, usuarios, reservas, notificacoes,
                null, turmas, unidades, temporal);
    }

    private Solicitacao nova(LocalDate data, Set<String> turnos) {
        Solicitacao s = new Solicitacao();
        s.setSalaId(SALA_ID);
        s.setInstrutorId(INSTRUTOR_ID);
        s.setUnidadeId(UNIDADE_OK);
        s.setData(data);
        s.setDataInicio(data);
        s.setDataFim(data);
        s.setTurnos(turnos);
        s.setStatus(StatusSolicitacao.PENDENTE);
        return s;
    }

    private Sala salaDaUnidade() {
        Sala sala = new Sala();
        sala.setUnidadeId(UNIDADE_OK);
        return sala;
    }

    private Usuario instrutorDaUnidade() {
        Usuario usuario = new Usuario();
        usuario.setUnidadeId(UNIDADE_OK);
        return usuario;
    }
}
