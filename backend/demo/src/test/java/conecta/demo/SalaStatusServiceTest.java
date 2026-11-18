package conecta.demo;

import conecta.demo.dto.SalaStatusResponse;
import conecta.demo.model.Reserva;
import conecta.demo.model.Sala;
import conecta.demo.model.Usuario;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.service.SalaStatusService;
import conecta.demo.service.UsuarioAtual;
import conecta.demo.model.Perfil;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Regras do estado exibido por {@code GET /api/salas/status}.
 *
 * <p>Regressao do defeito "botao verde do mapa nao reage": o override manual
 * {@code statusManual = "livre"} era confundido com {@code Auto} (null) e a API
 * devolvia o calculo automatico, fazendo a interface descartar a selecao do
 * coordenador. Os cinco estados do override tem precedencia absoluta; somente
 * {@code statusManual} nulo devolve o controle ao calculo automatico.</p>
 */
@ExtendWith(MockitoExtension.class)
class SalaStatusServiceTest {

    @Mock
    private SalaRepository salas;

    @Mock
    private ReservaRepository reservas;

    @Mock
    private TurmaRepository turmas;

    @Mock
    private UsuarioAtual usuarioAtual;

    private SalaStatusService service;

    @BeforeEach
    void setUp() {
        service = new SalaStatusService(salas, reservas, turmas, usuarioAtual);
        Usuario coordenador = new Usuario();
        coordenador.setPerfil(Perfil.COORDENADOR);
        coordenador.setUnidadeId(1L);
        when(usuarioAtual.buscar()).thenReturn(Optional.of(coordenador));
    }

    @Test
    @DisplayName("Override livre prevalece mesmo com reserva ativa na sala")
    void overrideLivrePrevaleceComReservaAtiva() {
        montarSalaComReserva("livre");

        List<SalaStatusResponse> resposta = service.listar(1L, hoje(), hoje(), null, null, null);

        assertEquals("livre", resposta.get(0).status(),
                "statusManual='livre' nao pode ser rebaixado para o calculo automatico");
        assertEquals("livre", resposta.get(0).statusAtual());
    }

    @Test
    @DisplayName("Sem override, sala com reserva ativa continua ocupada")
    void semOverrideSalaComReservaContinuaOcupada() {
        montarSalaComReserva(null);

        List<SalaStatusResponse> resposta = service.listar(1L, hoje(), hoje(), null, null, null);

        assertEquals("ocupada", resposta.get(0).status(),
                "reserva ativa sem override manual nunca pode ser apresentada como livre");
    }

    @Test
    @DisplayName("Sem override e sem reserva, sala fica livre (calculo automatico)")
    void semOverrideESemReservaSalaFicaLivre() {
        montarSala(null, List.of());

        List<SalaStatusResponse> resposta = service.listar(1L, hoje(), hoje(), null, null, null);

        assertEquals("livre", resposta.get(0).status());
    }

    @Test
    @DisplayName("Override livre sem reserva tambem e refletido pela API")
    void overrideLivreSemReservaERefletido() {
        montarSala("livre", List.of());

        List<SalaStatusResponse> resposta = service.listar(1L, hoje(), hoje(), null, null, null);

        assertEquals("livre", resposta.get(0).status());
        assertEquals("livre", resposta.get(0).statusAtual());
    }

    @Test
    @DisplayName("Os demais overrides manuais continuam com precedencia absoluta")
    void demaisOverridesManuaisContinuamComPrecedencia() {
        for (String status : List.of("ocupada", "iminente", "manutencao", "indisponivel")) {
            montarSalaComReserva(status);

            List<SalaStatusResponse> resposta = service.listar(1L, hoje(), hoje(), null, null, null);

            assertEquals(status, resposta.get(0).status(),
                    "override '" + status + "' deve ser respeitado");
        }
    }

    private LocalDate hoje() {
        return LocalDate.now();
    }

    private void montarSalaComReserva(String statusManual) {
        Reserva reserva = new Reserva();
        reserva.setId(7001L);
        reserva.setSalaId(5001L);
        reserva.setTurno("Matutino");
        reserva.setDataInicio(hoje().minusDays(7));
        reserva.setDataFim(hoje().plusDays(30));
        reserva.setUnidadeId(1L);
        reserva.setStatus("ATIVA");
        // Sem dias especificos: a reserva ocupa qualquer dia da janela.
        reserva.setDiasSemana(java.util.Set.of());
        montarSala(statusManual, List.of(reserva));
    }

    private void montarSala(String statusManual, List<Reserva> reservasDaSala) {
        Sala sala = new Sala();
        sala.setId(5001L);
        sala.setNome("Lab Informatica 01");
        sala.setUnidadeId(1L);
        sala.setAtiva(true);
        sala.setStatusManual(statusManual);
        sala.setMotivoManual("");
        sala.setManualPor("");

        when(salas.findByUnidadeId(1L)).thenReturn(List.of(sala));
        when(reservas.findBySalaIdAndDataInicioLessThanEqualAndDataFimGreaterThanEqual(
                any(), any(), any())).thenReturn(reservasDaSala);
    }
}
