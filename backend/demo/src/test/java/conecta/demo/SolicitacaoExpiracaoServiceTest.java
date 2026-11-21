package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import conecta.demo.model.Solicitacao;
import conecta.demo.model.StatusSolicitacao;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.service.SolicitacaoExpiracaoService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;

class SolicitacaoExpiracaoServiceTest {

    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    @Test
    void pedidoDoDiaAnteriorContinuaPendenteEExpiraNaMeiaNoite() {
        Solicitacao s = pedido(LocalDate.of(2026, 11, 21), "unica");
        SolicitacaoRepository repo = mock(SolicitacaoRepository.class);
        when(repo.findByStatusForUpdate(StatusSolicitacao.PENDENTE)).thenReturn(List.of(s));

        SolicitacaoExpiracaoService service = serviceAt(repo, "2026-11-20T20:59:59Z");
        service.expirarVencidas();
        assertThat(s.getStatus()).isEqualTo(StatusSolicitacao.PENDENTE);

        when(repo.findByStatusForUpdate(StatusSolicitacao.PENDENTE)).thenReturn(List.of(s));
        service = serviceAt(repo, "2026-11-21T03:00:00Z");
        service.expirarVencidas();
        assertThat(s.getStatus()).isEqualTo(StatusSolicitacao.EXPIRADA);
        assertThat(s.getOrigemStatus()).isEqualTo("SISTEMA");
        assertThat(s.getMotivoStatus()).isEqualTo(SolicitacaoExpiracaoService.MOTIVO_EXPIRACAO);
    }

    @Test
    void periodoContinuoExpiraQuandoComecaEIndependeDoTurno() {
        Solicitacao s = pedido(LocalDate.of(2026, 11, 21), "periodo");
        s.setDataFim(LocalDate.of(2026, 11, 30));
        s.setTurnos(java.util.Set.of("Noturno"));
        SolicitacaoRepository repo = mock(SolicitacaoRepository.class);
        when(repo.findByStatusForUpdate(StatusSolicitacao.PENDENTE)).thenReturn(List.of(s));

        SolicitacaoExpiracaoService service = serviceAt(repo, "2026-11-21T03:00:00Z");
        service.expirarVencidas();

        assertThat(s.getStatus()).isEqualTo(StatusSolicitacao.EXPIRADA);
    }

    @Test
    void datasEspecificasExpiramIndividualmenteEConservamDatasFuturas() {
        Solicitacao s = pedido(LocalDate.of(2026, 11, 20), "especificas");
        s.setDatasEspecificas(List.of("2026-11-20", "2026-11-21", "2026-11-22"));
        SolicitacaoRepository repo = mock(SolicitacaoRepository.class);
        when(repo.findByStatusForUpdate(StatusSolicitacao.PENDENTE)).thenReturn(List.of(s));

        SolicitacaoExpiracaoService service = serviceAt(repo, "2026-11-21T03:00:00Z");
        service.expirarVencidas();
        assertThat(s.getStatus()).isEqualTo(StatusSolicitacao.PENDENTE);
        assertThat(s.getDatasExpiradas()).hasSize(2);
        assertThat(s.getDatasExpiradas()).extracting("data")
                .containsExactly(LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 21));

        when(repo.findByStatusForUpdate(StatusSolicitacao.PENDENTE)).thenReturn(List.of(s));
        service = serviceAt(repo, "2026-11-22T03:00:00Z");
        service.expirarVencidas();
        assertThat(s.getStatus()).isEqualTo(StatusSolicitacao.EXPIRADA);
        assertThat(s.getDatasExpiradas()).hasSize(3);

        when(repo.findByStatusForUpdate(StatusSolicitacao.PENDENTE)).thenReturn(List.of(s));
        service.expirarVencidas();
        assertThat(s.getDatasExpiradas()).hasSize(3);
    }

    @Test
    void estadosTerminaisNaoSaoAlterados() {
        Solicitacao aprovada = pedido(LocalDate.of(2026, 11, 20), "unica");
        aprovada.setStatus(StatusSolicitacao.APROVADA);
        Solicitacao recusada = pedido(LocalDate.of(2026, 11, 20), "unica");
        recusada.setStatus(StatusSolicitacao.RECUSADA);
        Solicitacao cancelada = pedido(LocalDate.of(2026, 11, 20), "unica");
        cancelada.setStatus(StatusSolicitacao.CANCELADA);
        SolicitacaoRepository repo = mock(SolicitacaoRepository.class);
        when(repo.findByStatusForUpdate(StatusSolicitacao.PENDENTE)).thenReturn(List.of());

        SolicitacaoExpiracaoService service = serviceAt(repo, "2026-11-22T03:00:00Z");
        service.expirarVencidas();

        assertThat(List.of(aprovada, recusada, cancelada))
                .extracting(Solicitacao::getStatus)
                .containsExactly(StatusSolicitacao.APROVADA, StatusSolicitacao.RECUSADA, StatusSolicitacao.CANCELADA);
    }

    private SolicitacaoExpiracaoService serviceAt(SolicitacaoRepository repo, String now) {
        return new SolicitacaoExpiracaoService(repo, Clock.fixed(Instant.parse(now), ZONE), ZONE);
    }

    private Solicitacao pedido(LocalDate data, String modo) {
        Solicitacao s = new Solicitacao();
        s.setId(1L);
        s.setData(data);
        s.setDataInicio(data);
        s.setModo(modo);
        s.setStatus(StatusSolicitacao.PENDENTE);
        return s;
    }
}
