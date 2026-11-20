package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;

import tools.jackson.databind.ObjectMapper;
import conecta.demo.model.Solicitacao;
import conecta.demo.model.SolicitacaoDataExpirada;
import conecta.demo.model.StatusSolicitacao;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class SolicitacaoLifecycleContractTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void statusDoCicloCompletoSerializaEmMinusculas() {
        assertThat(StatusSolicitacao.from("cancelada")).isEqualTo(StatusSolicitacao.CANCELADA);
        assertThat(StatusSolicitacao.from("EXPIRADA")).isEqualTo(StatusSolicitacao.EXPIRADA);
        assertThat(StatusSolicitacao.EXPIRADA.json()).isEqualTo("expirada");
    }

    @Test
    void historicoDaOcorrenciaExpiradaFazParteDoContratoJson() throws Exception {
        Solicitacao solicitacao = new Solicitacao();
        solicitacao.setId(42L);
        solicitacao.setData(LocalDate.of(2026, 11, 21));
        solicitacao.setStatus(StatusSolicitacao.EXPIRADA);
        solicitacao.setExpiradaEm(Instant.parse("2026-11-21T03:00:00Z"));
        solicitacao.setOrigemStatus("SISTEMA");
        solicitacao.setMotivoStatus("Data solicitada atingida sem decisão do coordenador");
        solicitacao.setDatasExpiradas(List.of(new SolicitacaoDataExpirada(
                LocalDate.of(2026, 11, 21),
                Instant.parse("2026-11-21T03:00:00Z"),
                "SISTEMA",
                "Data solicitada atingida sem decisão do coordenador")));

        String payload = json.writeValueAsString(solicitacao);

        assertThat(payload).contains("\"status\":\"expirada\"");
        assertThat(payload).contains("\"expiradaEm\":\"2026-11-21T03:00:00Z\"");
        assertThat(payload).contains("\"origemStatus\":\"SISTEMA\"");
        assertThat(payload).contains("\"datasExpiradas\"");
        assertThat(payload).contains("\"data\":\"2026-11-21\"");
    }
}
