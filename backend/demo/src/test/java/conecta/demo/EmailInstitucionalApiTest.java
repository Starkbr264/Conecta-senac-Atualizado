package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import conecta.demo.model.Perfil;
import conecta.demo.model.Usuario;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.validation.EmailInstitucional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Politica de e-mail institucional nos endpoints HTTP: API REST de usuarios e
 * POST /api/sinc (casos 12, 13 e 14 do plano de testes).
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@Import(conecta.demo.config.TestSecurityConfig.class)
class EmailInstitucionalApiTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UsuarioRepository usuarios;

    private static final String MENSAGEM_INVALIDO = "Utilize um e-mail institucional @edu.df.senac.br.";

    @BeforeEach
    void autenticarAdmin() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
    }

    @AfterEach
    void limparAutenticacao() {
        SecurityContextHolder.clearContext();
    }

    private long criarUnidade(String nome) throws Exception {
        tools.jackson.databind.ObjectMapper mapper = new tools.jackson.databind.ObjectMapper();
        String resposta = mockMvc.perform(post("/api/unidades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"" + nome + "\",\"cep\":\"70000-000\","
                                + "\"cidade\":\"Brasilia/DF\",\"endereco\":\"SCS Q.1\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(resposta).get("id").asLong();
    }

    // 12) E-mail invalido enviado pelo /api/sinc: HTTP 400 + mensagem da politica.
    @Test
    void sincRejeitaEmailInvalidoCom400EMensagemDaPolitica() throws Exception {
        long unidadeId = criarUnidade("Unidade Email Sinc");

        String payload = "{\"criados\":{\"usuarios\":[{\"id\":99301,"
                + "\"nome\":\"Invalido Gmail\",\"email\":\"usuario@gmail.com\","
                + "\"senha\":\"Senha.123\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value(MENSAGEM_INVALIDO));

        assertThat(usuarios.findByEmailIgnoreCase("usuario@gmail.com")).isEmpty();
    }

    // 12) Mesma regra para Hotmail e para parte local longa demais.
    @Test
    void sincRejeitaEmailHotmailEParteLocalLonga() throws Exception {
        long unidadeId = criarUnidade("Unidade Email Sinc 2");

        String hotmail = "{\"criados\":{\"usuarios\":[{\"id\":99302,"
                + "\"nome\":\"Invalido Hotmail\",\"email\":\"usuario@hotmail.com\","
                + "\"senha\":\"Senha.123\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}]}}";
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(hotmail))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value(MENSAGEM_INVALIDO));

        String longo = "{\"criados\":{\"usuarios\":[{\"id\":99303,"
                + "\"nome\":\"Nome Largo\",\"email\":\"partemuitomaiorque16@edu.df.senac.br\","
                + "\"senha\":\"Senha.123\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}]}}";
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(longo))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value(EmailInstitucional.ERRO_LIMITE));

        assertThat(usuarios.findByEmailIgnoreCase("usuario@hotmail.com")).isEmpty();
        assertThat(usuarios.findByEmailIgnoreCase("partemuitomaiorque16@edu.df.senac.br")).isEmpty();
    }

    // 13) Edicao de usuario com e-mail institucional valido (normalizado).
    @Test
    void editaUsuarioComEmailInstitucionalValido() throws Exception {
        long unidadeId = criarUnidade("Unidade Email Edicao");

        String criado = mockMvc.perform(post("/api/usuarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Original\",\"email\":\"original@edu.df.senac.br\","
                                + "\"senha\":\"Senha.123\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = new tools.jackson.databind.ObjectMapper().readTree(criado).get("id").asLong();

        mockMvc.perform(put("/api/usuarios/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Editado\",\"email\":\"  EDITADO@EDU.DF.SENAC.BR \","
                                + "\"senha\":\"Senha.123\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}"))
                .andExpect(status().isOk());

        assertThat(usuarios.findById(id)).hasValueSatisfying(u ->
                assertThat(u.getEmail()).isEqualTo("editado@edu.df.senac.br"));
    }

    // 14) Conta antiga preservada: login continua funcionando.
    @Test
    void contaAntigaContinuaLogando() throws Exception {
        Usuario legado = new Usuario();
        legado.setId(99910L);
        legado.setNome("Conta Legada");
        legado.setEmail("legado@gmail.com");
        legado.setSenha(new BCryptPasswordEncoder().encode("Senac.DF2007"));
        legado.setPerfil(Perfil.ADMIN);
        legado.setUnidadeId(1001L);
        usuarios.save(legado);

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"legado@gmail.com\",\"senha\":\"Senac.DF2007\"}"))
                .andExpect(status().isOk());
    }

    // 14) Conta antiga preservada: sincronizar sem trocar o e-mail mantem o valor.
    @Test
    void sincPreservaEmailDeContaAntigaSemTroca() throws Exception {
        long unidadeId = criarUnidade("Unidade Legada Sinc");

        Usuario legado = new Usuario();
        legado.setId(99911L);
        legado.setNome("Conta Legada Sinc");
        legado.setEmail("legado.sinc@gmail.com");
        legado.setSenha(new BCryptPasswordEncoder().encode("Senac.DF2007"));
        legado.setPerfil(Perfil.COORDENADOR);
        legado.setUnidadeId(unidadeId);
        usuarios.save(legado);

        String payload = "{\"alteracoes\":{\"usuarios\":[{\"id\":99911,"
                + "\"nome\":\"Conta Legada Sinc Editada\",\"email\":\"legado.sinc@gmail.com\","
                + "\"perfil\":\"coordenador\",\"unidadeId\":" + unidadeId + "}]}}";

        MvcResult resultado = mockMvc.perform(post("/api/sinc")
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(resultado.getResponse().getContentAsString()).contains("\"ok\":true");
        assertThat(usuarios.findById(99911L))
                .hasValueSatisfying(u -> assertThat(u.getEmail()).isEqualTo("legado.sinc@gmail.com"));
    }
}
