package conecta.demo;

import conecta.demo.model.Usuario;
import conecta.demo.repository.UsuarioRepository;
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
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reproduz e valida a correcao do HTTP 500 ao sincronizar usuarios.
 *
 * <p>Cenario real do frontend: a senha NUNCA volta em GET /api/dados porque
 * {@code Usuario.getSenha()} tem {@code @JsonIgnore}. Logo, o cache do cliente
 * envia a colecao inteira de usuarios em POST /api/sinc SEM o campo senha para os
 * ja existentes (e COM senha para o usuario novo). Antes da correcao,
 * {@code SincService.salvar("usuarios")} gravava {@code senha = null} para os
 * existentes, violando {@code @NotBlank}/{@code nullable=false} — a transacao
 * inteira era revertida e a resposta era HTTP 500, nunca salvando o novo usuario.
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@Import(conecta.demo.config.TestSecurityConfig.class)
class SincUsuariosTest {

    @BeforeEach
    void autenticarAdminParaSincronizacao() {
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
    private UsuarioRepository usuarios;

    @Test
    void sincColecaoDeUsuariosSemSenhaNosExistentesNaoDerrubaECompraONovoUsuario() throws Exception {
        tools.jackson.databind.ObjectMapper mapper = new tools.jackson.databind.ObjectMapper();

        // 0) unidade base — exigida por UsuarioService.validar() antes de criar usuario.
        String unidadeCriada = mockMvc.perform(post("/api/unidades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Unidade Sinc Test\",\"cep\":\"70000-000\","
                                + "\"cidade\":\"Brasilia/DF\",\"endereco\":\"SCS Q.1\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long unidadeId = mapper.readTree(unidadeCriada).get("id").asLong();

        // 1) usuario existente, criado pela API normal (senha hasheada no banco).
        String criado = mockMvc.perform(post("/api/usuarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Existente\",\"email\":\"existente@sinc.test\","
                                + "\"senha\":\"Senha.123\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long existenteId = mapper.readTree(criado).get("id").asLong();

        // 2) o frontend envia a colecao INTEIRA: existente SEM senha (cache, @JsonIgnore)
        //    + novo usuario COM senha (recem-criado no formulario).
        String payload = "{\"alteracoes\":{\"usuarios\":["
                + "{\"id\":" + existenteId + ",\"nome\":\"Existente\","
                + "\"email\":\"existente@sinc.test\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}"
                + " ]},\"criados\":{\"usuarios\":["
                + "{\"id\":99001,\"nome\":\"Novo Usuario\",\"email\":\"novo@sinc.test\","
                + "\"senha\":\"Nova.123\",\"perfil\":\"coordenador\",\"unidadeId\":" + unidadeId + "}]}}";

        // 3) SEM a correcao isto retorna 500 (rollback); COM a correcao retorna 200.
        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk());

        // 4) o novo usuario foi persistido.
        org.assertj.core.api.Assertions.assertThat(usuarios.findByEmailIgnoreCase("novo@sinc.test")).isPresent();

        // 5) a senha do existente foi PRESERVADA (nem anulada, nem re-hasheada por engano).
        String senhaOriginal = usuarios.findById(existenteId).orElseThrow().getSenha();
        org.assertj.core.api.Assertions.assertThat(senhaOriginal)
                .isNotNull()
                .isNotBlank()
                .startsWith("$2");
    }

    @Test
    void criarUsuarioComEmailJaCadastradoRetorna409SemDuplicarRegistro() throws Exception {
        tools.jackson.databind.ObjectMapper mapper = new tools.jackson.databind.ObjectMapper();
        String unidadeCriada = mockMvc.perform(post("/api/unidades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Unidade Dup Test\",\"cep\":\"70001-000\","
                                + "\"cidade\":\"Brasilia/DF\",\"endereco\":\"SCS Q.2\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long unidadeId = mapper.readTree(unidadeCriada).get("id").asLong();

        String body = "{\"nome\":\"Duplicado\",\"email\":\"duplicado@sinc.test\","
                + "\"senha\":\"Senha.123\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}";
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        long antes = usuarios.count();

        // repeticao do mesmo e-mail: 409 coerente, sem criar segundo registro.
        mockMvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
        org.assertj.core.api.Assertions.assertThat(usuarios.count()).isEqualTo(antes);
    }

    @Test
    void sincRejeitaEmailInvalidoEReverteLoteSemDerrubarCom500() throws Exception {
        tools.jackson.databind.ObjectMapper mapper = new tools.jackson.databind.ObjectMapper();
        String unidadeCriada = mockMvc.perform(post("/api/unidades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Unidade Colisao Test\",\"cep\":\"70002-000\","
                                + "\"cidade\":\"Brasilia/DF\",\"endereco\":\"SCS Q.3\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long unidadeId = mapper.readTree(unidadeCriada).get("id").asLong();

        String criado = mockMvc.perform(post("/api/usuarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Coord A\",\"email\":\"coord.a@sinc.test\","
                                + "\"senha\":\"Senha.123\",\"perfil\":\"coordenador\",\"unidadeId\":" + unidadeId + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long idExistente = mapper.readTree(criado).get("id").asLong();

        // Cliente defasado envia novo coordenador colidindo no mesmo idExistente + registro com e-mail invalido
        String payload = "{\"alteracoes\":{\"usuarios\":["
                + "{\"id\":" + idExistente + ",\"nome\":\"Coord B Colisao\",\"email\":\"coord.b@sinc.test\","
                + "\"senha\":\"Nova.123\",\"perfil\":\"coordenador\",\"unidadeId\":" + unidadeId + "}],"
                + "\"criados\":{\"usuarios\":[{\"id\":99099,\"nome\":\"Invalido\",\"email\":\"email.invalido@senac.\","
                + "\"senha\":\"Nova.123\",\"perfil\":\"coordenador\",\"unidadeId\":" + unidadeId + "}]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isBadRequest());

        org.assertj.core.api.Assertions.assertThat(usuarios.findByEmailIgnoreCase("coord.a@sinc.test")).isPresent();
        org.assertj.core.api.Assertions.assertThat(usuarios.findByEmailIgnoreCase("coord.b@sinc.test")).isEmpty();
        org.assertj.core.api.Assertions.assertThat(usuarios.findByEmailIgnoreCase("email.invalido@senac.")).isEmpty();
    }
}
