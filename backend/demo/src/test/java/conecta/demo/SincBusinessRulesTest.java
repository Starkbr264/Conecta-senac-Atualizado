package conecta.demo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.model.Sala;
import conecta.demo.model.Usuario;
import conecta.demo.model.Perfil;
import conecta.demo.service.SincService;
import conecta.demo.exception.AcessoNegadoException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import java.util.Map;

/** Regras de negocio que devem ser respeitadas também pelo lote de sincronizacao. */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@Import(conecta.demo.config.TestSecurityConfig.class)
class SincBusinessRulesTest {

    @BeforeEach
    void autenticarAdminParaFluxosDeSincronizacao() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
    }

    @AfterEach
    void limparAutenticacao() {
        SecurityContextHolder.clearContext();
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TurmaRepository turmas;

    @Autowired
    private SalaRepository salas;

    @Autowired
    private UsuarioRepository usuarios;

    @Autowired
    private UnidadeRepository unidades;

    @Autowired
    private SincService sinc;

    @Test
    void sincRejeitaTurmaIncompleta() throws Exception {
        long unidadeId = criarUnidade("Unidade turma sinc", "71000-001");
        String payload = "{\"criados\":{\"turmas\":["
                + "{\"id\":99101,\"nome\":\"\",\"codigo\":\"\","
                + "\"curso\":\"\",\"turno\":\"\",\"unidadeId\":" + unidadeId + "}]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sincRejeitaSenhaCurtaSemExporSenha() throws Exception {
        long unidadeId = criarUnidade("Unidade usuario sinc", "71000-006");
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criados\":{\"usuarios\":[{\"id\":99107,"
                                + "\"nome\":\"Usuario\",\"email\":\"usuario.sinc@senac.test\","
                                + "\"senha\":\"curta\",\"perfil\":\"instrutor\","
                                + "\"unidadeId\":" + unidadeId + "}]}}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("A senha deve ter pelo menos 8 caracteres"));
    }

    @Test
    void sincRejeitaReservaConflitante() throws Exception {
        long unidadeId = criarUnidade("Unidade reserva sinc", "71000-002");
        String sala = mockMvc.perform(post("/api/salas").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Sala sinc\",\"tipo\":\"Sala\",\"capacidade\":20,"
                                + "\"unidadeId\":" + unidadeId + ",\"turnosDisponiveis\":[\"manha\"],"
                                + "\"turnos\":[\"manha\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long salaId = new tools.jackson.databind.ObjectMapper().readTree(sala).get("id").asLong();

        String reserva = "{\"salaId\":" + salaId + ",\"turno\":\"manha\","
                + "\"diasSemana\":[\"SEG\"],\"dataInicio\":\"2026-02-02\","
                + "\"dataFim\":\"2026-02-27\",\"horaInicio\":\"08:00\","
                + "\"horaFim\":\"10:00\",\"unidadeId\":" + unidadeId + "}";
        mockMvc.perform(post("/api/reservas").contentType(MediaType.APPLICATION_JSON).content(reserva))
                .andExpect(status().isCreated());

        String lote = "{\"criados\":{\"reservas\":[{\"id\":99102,"
                + reserva.substring(1) + "]}}";
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(lote))
                .andExpect(status().isConflict());
    }

    @Test
    void sincFazRollbackDoLoteQuandoItemPosteriorEInvalido() throws Exception {
        long unidadeId = criarUnidade("Unidade rollback sinc", "71000-003");
        String payload = "{\"criados\":{\"turmas\":["
                + "{\"id\":99103,\"nome\":\"Turma valida\",\"codigo\":\"T-99103\","
                + "\"curso\":\"Curso\",\"turno\":\"manha\",\"unidadeId\":" + unidadeId + "},"
                + "{\"id\":99104,\"nome\":\"\",\"codigo\":\"\",\"curso\":\"\","
                + "\"turno\":\"\",\"unidadeId\":" + unidadeId + "}]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest());

        org.assertj.core.api.Assertions.assertThat(turmas.findById(99103L)).isEmpty();

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"alteracoes\":{\"turmas\":[]}}"))
                .andExpect(status().isOk());
    }

    @Test
    void sincRejeitaChaveDuplicadaComMensagemDeNegocio() throws Exception {
        long unidadeId = criarUnidade("Unidade chave sinc", "71000-004");
        String sala = mockMvc.perform(post("/api/salas").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Sala chave sinc\",\"tipo\":\"Sala\",\"capacidade\":20,"
                                + "\"unidadeId\":" + unidadeId + ",\"turnosDisponiveis\":[\"manha\"],"
                                + "\"turnos\":[\"manha\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long salaId = new tools.jackson.databind.ObjectMapper().readTree(sala).get("id").asLong();
        String chave = "{\"codigo\":\"CH-SINC-DUP\",\"salaId\":" + salaId
                + ",\"unidadeId\":" + unidadeId + "}";

        mockMvc.perform(post("/api/chaves").contentType(MediaType.APPLICATION_JSON).content(chave))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                .content("{\"criados\":{\"chaves\":[{\"id\":99105,"
                                + chave.substring(1) + "]}}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Ja existe uma chave com este codigo"));
    }

    @Test
    void sincAceitaTurmaValida() throws Exception {
        long unidadeId = criarUnidade("Unidade turma valida", "71000-005");
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                .content("{\"criados\":{\"turmas\":[{\"id\":99106,"
                                + "\"nome\":\"Turma valida sinc\",\"codigo\":\"T-99106\","
                                + "\"curso\":\"Curso\",\"turno\":\"manha\","
                                + "\"unidadeId\":" + unidadeId + "}]}}"))
                .andExpect(status().isOk());
    }

    @Test
    void coordenadorNaoRemoveSalaDeOutraUnidadeMesmoComPayloadManipulado() throws Exception {
        long unidadeDona = criarUnidade("Unidade dona remocao", "71000-007");
        long unidadeUsuario = criarUnidade("Unidade usuario remocao", "71000-008");

        Sala sala = new Sala();
        sala.setId(99201L);
        sala.setNome("Sala protegida");
        sala.setTipo("Sala");
        sala.setCapacidade(10);
        sala.setUnidadeId(unidadeDona);
        sala.setTurnos(java.util.List.of("manha"));
        sala.setTurnosDisponiveis(java.util.List.of("manha"));
        salas.saveAndFlush(sala);

        Usuario coordenador = new Usuario();
        coordenador.setId(99202L);
        coordenador.setNome("Coordenador teste");
        coordenador.setEmail("coordenador.remocao@senac.test");
        coordenador.setSenha("$2a$10$hash");
        coordenador.setPerfil(Perfil.COORDENADOR);
        coordenador.setUnidadeId(unidadeUsuario);
        usuarios.saveAndFlush(coordenador);

        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(
                coordenador.getEmail(), "n/a", "ROLE_COORDENADOR"));
        try {
            assertThrows(AcessoNegadoException.class, () -> sinc.sincronizar(Map.of(
                    "remocoes", Map.of("salas", List.of(99201L)))));
            assertThat(salas.existsById(99201L)).isTrue();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void sincRejeitaIdTextoComResposta400() throws Exception {
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"alteracoes\":{\"turmas\":[{\"id\":\"abc\",\"codigo\":\"T-INVALIDO\"}]}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("turmas.id"));
    }

    @Test
    void sincRejeitaDataInvalidaComResposta400() throws Exception {
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criados\":{\"reservas\":[{\"id\":99110,\"dataInicio\":\"31-02-2026\"}]}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("reservas.dataInicio"));
    }

    @Test
    void sincRejeitaStatusDeSolicitacaoDesconhecidoComResposta400() throws Exception {
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criados\":{\"solicitacoes\":[{\"id\":99111,\"status\":\"nao-existe\"}]}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("solicitacoes.status"));
    }

    @Test
    void sincRejeitaStatusDeChaveDesconhecidoComResposta400() throws Exception {
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criados\":{\"chaves\":[{\"id\":99112,\"status\":\"quebrada\"}]}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("chaves.status"));
    }

    @Test
    void sincRejeitaNotificacaoComUnidadeInexistente() throws Exception {
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criados\":{\"notificacoes\":[{\"id\":99113,\"tipo\":\"info\","
                                + "\"titulo\":\"Aviso\",\"msg\":\"Mensagem\",\"unidadeId\":999999}]}}"))
                .andExpect(status().isConflict());
    }

    @Test
    void sincRejeitaTimestampInvalidoComResposta400() throws Exception {
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criados\":{\"notificacoes\":[{\"id\":99114,\"tipo\":\"info\","
                                + "\"titulo\":\"Aviso\",\"msg\":\"Mensagem\",\"criadaEm\":\"ontem\"}]}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("notificacoes.criadaEm"));
    }

    @Test
    void sincRejeitaItemCriadoSemId() throws Exception {
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criados\":{\"turmas\":[{\"nome\":\"Sem id\"}]}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("turmas.id"));
    }

    @Test
    void sincRejeitaStatusDeReservaDesconhecido() throws Exception {
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criados\":{\"reservas\":[{\"id\":99115,\"status\":\"invalida\"}]}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("reservas.status"));
    }

    @Test
    void coordenadorNaoCriaNotificacaoEmOutraUnidade() throws Exception {
        long unidadeUsuario = criarUnidade("Unidade coord notificacao", "71000-009");
        long unidadeAlheia = criarUnidade("Unidade alheia notificacao", "71000-010");
        Usuario coordenador = new Usuario();
        coordenador.setId(99203L);
        coordenador.setNome("Coordenador notificacao");
        coordenador.setEmail("coordenador.notificacao@senac.test");
        coordenador.setSenha("$2a$10$hash");
        coordenador.setPerfil(Perfil.COORDENADOR);
        coordenador.setUnidadeId(unidadeUsuario);
        usuarios.saveAndFlush(coordenador);
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(
                coordenador.getEmail(), "n/a", "ROLE_COORDENADOR"));
        try {
            assertThrows(AcessoNegadoException.class, () -> sinc.sincronizar(Map.of(
                    "criados", Map.of("notificacoes", List.of(Map.of(
                            "id", 99204L, "tipo", "info", "titulo", "Privada", "msg", "Mensagem",
                            "unidadeId", unidadeAlheia))))));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void sincRemapeiaReferenciaDeUnidadeCriadaNoMesmoLote() throws Exception {
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criados\":{\"unidades\":[{\"id\":88001,\"nome\":\"Unidade lote\","
                                + "\"cep\":\"72000-001\",\"cidade\":\"Brasilia\",\"endereco\":\"SCS\"}],"
                                + "\"salas\":[{\"id\":88002,\"nome\":\"Sala lote\",\"tipo\":\"Sala\","
                                + "\"capacidade\":10,\"unidadeId\":88001,\"turnos\":[\"manha\"],"
                                + "\"turnosDisponiveis\":[\"manha\"]}]}}"))
                .andExpect(status().isOk());
        long unidadeReal = unidades.findByNomeIgnoreCase("Unidade lote").get(0).getId();
        assertThat(salas.findAll().stream().filter(s -> "Sala lote".equals(s.getNome())).findFirst()
                .orElseThrow().getUnidadeId()).isEqualTo(unidadeReal);
    }

    private long criarUnidade(String nome, String cep) throws Exception {
        String corpo = mockMvc.perform(post("/api/unidades").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"" + nome + "\",\"cep\":\"" + cep
                                + "\",\"cidade\":\"Brasilia/DF\",\"endereco\":\"SCS\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return new tools.jackson.databind.ObjectMapper().readTree(corpo).get("id").asLong();
    }
}
