package conecta.demo;

import conecta.demo.config.TestSecurityConfig;
import conecta.demo.model.Solicitacao;
import conecta.demo.model.StatusSolicitacao;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.service.SolicitacaoTemporalService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regra temporal do POST /api/sinc para solicitacoes.
 *
 * <p>Causa raiz da falha 1 da homologacao: a criacao normal passa por
 * {@code SolicitacaoService.criar}, que chama o {@link SolicitacaoTemporalService},
 * mas a sincronizacao usava so {@code validarParaSincronizacao}, sem regra
 * temporal. Resultado reproduzido: as 17:49 uma solicitacao MATUTINA para o
 * proprio dia era aceita pelo /api/sinc (o turno matutino termina as 12:00).</p>
 *
 * <p>Relogio fixo em 2026-11-18 17:49 (America/Sao_Paulo) via bean
 * {@code @Primary}, para que os casos nao dependam da hora real da maquina.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class SincSolicitacaoTemporalTest {

    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    /** "Hoje" do relogio fixo de teste. */
    private static final LocalDate HOJE = LocalDate.of(2026, 11, 18);

    /**
     * Substitui o relogio do servidor por um fixo em 17:49 de 2026-11-18 —
     * mesmo algoritmo e mesmos horarios de turno da configuracao oficial.
     */
    @TestConfiguration
    static class RelogioFixoDeTeste {
        @Bean
        @Primary
        SolicitacaoTemporalService solicitacaoTemporalService() {
            Instant instante = HOJE.atTime(17, 49).atZone(ZONE).toInstant();
            return new SolicitacaoTemporalService(Clock.fixed(instante, ZONE), ZONE, Map.of(
                    "matutino", new SolicitacaoTemporalService.IntervaloTurno(
                            LocalTime.of(8, 0), LocalTime.of(12, 0)),
                    "vespertino", new SolicitacaoTemporalService.IntervaloTurno(
                            LocalTime.of(14, 0), LocalTime.of(18, 0)),
                    "noturno", new SolicitacaoTemporalService.IntervaloTurno(
                            LocalTime.of(19, 0), LocalTime.of(22, 0))));
        }
    }

    private static final AtomicLong SEQUENCIA = new AtomicLong(700);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SolicitacaoRepository solicitacoes;

    private final tools.jackson.databind.ObjectMapper mapper = new tools.jackson.databind.ObjectMapper();

    private long unidadeId;
    private long salaId;
    private long instrutorId;

    @BeforeEach
    void preparar() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
        long n = SEQUENCIA.incrementAndGet();
        unidadeId = criarUnidade("Unidade sinc temporal " + n, "719" + String.format("%05d", n));
        instrutorId = criarUsuario("Instrutor Temporal " + n,
                "sinctemporal" + n + "@edu.df.senac.br", unidadeId);
        String salaCriada = mockMvc.perform(post("/api/salas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Sala sinc temporal " + n + "\",\"tipo\":\"teorica\","
                                + "\"capacidade\":40,\"turnos\":[\"Matutino\"],"
                                + "\"unidadeId\":" + unidadeId + "}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        salaId = mapper.readTree(salaCriada).get("id").asLong();
    }

    @AfterEach
    void limparAutenticacao() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("FALHA 1: Matutina para hoje enviada as 17:49 e rejeitada e nao persistida")
    void sincRejeitaMatutinaParaHojeAposFimDoTurnoSemPersistir() throws Exception {
        String payload = loteCriado(payloadSolicitacao("Matutino", HOJE.toString(),
                "Temporal matutino 17:49"));

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro", containsString("encerrado")));

        assertThat(solicitacoes.findByUnidadeId(unidadeId))
                .as("solicitacao Matutina rejeitada nao pode ser persistida")
                .isEmpty();
    }

    @Test
    @DisplayName("Vespertina para hoje enviada as 17:49 (turno em andamento) e rejeitada")
    void sincRejeitaVespertinaParaHojeEmAndamentoSemPersistir() throws Exception {
        String payload = loteCriado(payloadSolicitacao("Vespertino", HOJE.toString(),
                "Temporal vespertino 17:49"));

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro", containsString("comecou")));

        assertThat(solicitacoes.findByUnidadeId(unidadeId)).isEmpty();
    }

    @Test
    @DisplayName("Noturna para hoje enviada as 17:49 (turno futuro) e aceita e persistida")
    void sincAceitaNoturnaParaHojeComoTurnoFuturo() throws Exception {
        String payload = loteCriado(payloadSolicitacao("Noturno", HOJE.toString(),
                "Temporal noturno 17:49"));

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk());

        assertThat(solicitacoes.findByUnidadeId(unidadeId))
                .hasSize(1)
                .first()
                .extracting(Solicitacao::getStatus, s -> s.getTurnos())
                .containsExactly(StatusSolicitacao.PENDENTE, Set.of("Noturno"));
    }

    @Test
    @DisplayName("solicitacao historica reenviada e vencida permanece expirada")
    void sincPreservaSolicitacaoHistoricaSemAlteracaoTemporal() throws Exception {
        Solicitacao historica = salvarHistorica(HOJE.minusDays(8), "Matutino", "Historica 17:49");

        // Delta identico ao do frontend: mesmos dados temporais, so o motivo muda.
        String payload = "{\"alteracoes\":{\"solicitacoes\":[" + payloadSolicitacao(
                historica.getId(), "Matutino", HOJE.minusDays(8).toString(),
                "Historica 17:49 - reenvio do delta") + "]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk());

        Solicitacao salva = solicitacoes.findById(historica.getId()).orElseThrow();
        assertThat(salva.getStatus())
                .as("recuperacao do servidor deve impedir que cache antigo reabra o registro")
                .isEqualTo(StatusSolicitacao.EXPIRADA);
        assertThat(salva.getData())
                .as("dados temporais do historico nao podem mudar so por reenviar o delta")
                .isEqualTo(HOJE.minusDays(8));
        assertThat(salva.getMotivo()).isEqualTo("Historica 17:49 - reenvio do delta");
    }

    @Test
    @DisplayName("Alteracao efetiva do dado temporal para data passada e rejeitada sem gravar nada")
    void sincRejeitaAlteracaoTemporalParaDataPassadaSemGravar() throws Exception {
        Solicitacao historica = salvarHistorica(HOJE.minusDays(8), "Matutino", "Historica 17:49");

        // O payload altera efetivamente as datas (para outro dia passado) e o
        // motivo: a regra temporal deve rejeitar e a transacao deve desfazer
        // tambem a mudanca de motivo (nenhuma gravacao parcial).
        String payload = "{\"alteracoes\":{\"solicitacoes\":[" + payloadSolicitacao(
                historica.getId(), "Matutino", HOJE.minusDays(15).toString(),
                "Alteracao temporal indevida") + "]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro", containsString("passou")));

        Solicitacao salva = solicitacoes.findById(historica.getId()).orElseThrow();
        assertThat(salva.getData())
                .as("data do historico deve permanecer a original (rollback)")
                .isEqualTo(HOJE.minusDays(8));
        assertThat(salva.getMotivo())
                .as("nenhuma gravacao parcial pode sobreviver a rejeicao")
                .isEqualTo("Historica 17:49");
        assertThat(salva.getStatus()).isEqualTo(StatusSolicitacao.PENDENTE);
    }

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    private String loteCriado(String solicitacaoJson) {
        return "{\"criados\":{\"solicitacoes\":[" + solicitacaoJson + "]}}";
    }

    private String payloadSolicitacao(String turno, String data, String motivo) {
        return payloadSolicitacao(null, turno, data, motivo);
    }

    private String payloadSolicitacao(Long id, String turno, String data, String motivo) {
        String identificacao = id == null ? "\"id\":99701," : "\"id\":" + id + ",";
        return "{" + identificacao
                + "\"salaId\":" + salaId + ",\"instrutorId\":" + instrutorId
                + ",\"unidadeId\":" + unidadeId
                + ",\"data\":\"" + data + "\",\"dataInicio\":\"" + data
                + "\",\"dataFim\":\"" + data + "\""
                + ",\"turnos\":[\"" + turno + "\"],\"diasSemana\":[\"SEG\"]"
                + ",\"status\":\"pendente\",\"motivo\":\"" + motivo + "\"}";
    }

    private Solicitacao salvarHistorica(LocalDate data, String turno, String motivo) {
        long id = solicitacoes.findAll().stream().mapToLong(Solicitacao::getId).max().orElse(0L) + 1;
        Solicitacao s = new Solicitacao();
        s.setId(id);
        s.setSalaId(salaId);
        s.setInstrutorId(instrutorId);
        s.setUnidadeId(unidadeId);
        s.setData(data);
        s.setDataInicio(data);
        s.setDataFim(data);
        s.setTurnos(Set.of(turno));
        s.setDiasSemana(Set.of("SEG"));
        s.setStatus(StatusSolicitacao.PENDENTE);
        s.setMotivo(motivo);
        s.setCriadaEm(Instant.now().minusSeconds(86400));
        return solicitacoes.save(s);
    }

    private long criarUnidade(String nome, String cep) throws Exception {
        String body = "{\"nome\":\"" + nome + "\",\"cep\":\"" + cep + "\","
                + "\"cidade\":\"Brasilia/DF\",\"endereco\":\"SCS Q.98\"}";
        String resposta = mockMvc.perform(post("/api/unidades")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(resposta).get("id").asLong();
    }

    private long criarUsuario(String nome, String email, long unidade) throws Exception {
        String body = "{\"nome\":\"" + nome + "\",\"email\":\"" + email + "\","
                + "\"senha\":\"Senha.123\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidade + "}";
        String resposta = mockMvc.perform(post("/api/usuarios")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(resposta).get("id").asLong();
    }
}
