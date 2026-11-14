package conecta.demo;

import conecta.demo.model.Unidade;
import conecta.demo.model.Usuario;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Transferencia de unidade de usuario via POST /api/sinc.
 *
 * <p>O frontend admin coleta {@code unidadeId} no modal {@code mUUnidade} e envia
 * a colecao inteira de usuarios em {@code alteracoes}. O bug: {@code SincService.salvar()}
 * sobrescrevia o {@code unidadeId} recebido com o valor ja persistido no banco
 * (inclusive para ADMIN), descartando a troca em silencio com HTTP 200.
 *
 * <p>Tambem cobre a guarda de exclusao de unidade no caminho de sincronizacao
 * ({@code remocoes.unidades}), que usava {@code deleteById} sem checar vinculos.
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@Import(conecta.demo.config.TestSecurityConfig.class)
class SincTransferenciaUnidadeTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UsuarioRepository usuarios;

    @Autowired
    private UnidadeRepository unidades;

    private final tools.jackson.databind.ObjectMapper mapper = new tools.jackson.databind.ObjectMapper();

    @BeforeEach
    void autenticarAdmin() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
    }

    @AfterEach
    void limparAutenticacao() {
        SecurityContextHolder.clearContext();
    }

    private long criarUnidade(String nome, String cep) throws Exception {
        String body = "{\"nome\":\"" + nome + "\",\"cep\":\"" + cep + "\","
                + "\"cidade\":\"Brasilia/DF\",\"endereco\":\"SCS Q.99\"}";
        String resposta = mockMvc.perform(post("/api/unidades")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(resposta).get("id").asLong();
    }

    private long criarUsuario(String nome, String email, long unidadeId) throws Exception {
        String body = "{\"nome\":\"" + nome + "\",\"email\":\"" + email + "\","
                + "\"senha\":\"Senha.123\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}";
        String resposta = mockMvc.perform(post("/api/usuarios")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(resposta).get("id").asLong();
    }

    @Test
    void adminTransfereUsuarioParaOutraUnidadeViaSincEPersisteNoBanco() throws Exception {
        long unidadeA = criarUnidade("Unidade Transf A", "72100-001");
        long unidadeB = criarUnidade("Unidade Transf B", "72100-002");
        long usuarioId = criarUsuario("Aluno Transfer", "aluno.transf@edu.df.senac.br", unidadeA);

        // Payload identico ao do frontend: usuario existente SEM senha (cache, @JsonIgnore).
        String payload = "{\"alteracoes\":{\"usuarios\":[{\"id\":" + usuarioId
                + ",\"nome\":\"Aluno Transfer\",\"email\":\"aluno.transf@edu.df.senac.br\","
                + "\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeB + "}]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk());

        // Prova de persistencia real: o valor lido do banco, nao apenas o HTTP 200.
        Usuario salvo = usuarios.findById(usuarioId).orElseThrow();
        assertThat(salvo.getUnidadeId())
                .as("unidadeId deve ser o da Unidade B apos a transferencia do admin")
                .isEqualTo(unidadeB);
    }

    @Test
    void transferenciaParaUnidadeInexistenteRetorna409SemAlterarUsuario() throws Exception {
        long unidadeA = criarUnidade("Unidade Transf Inv A", "72100-011");
        long unidadeB = criarUnidade("Unidade Transf Inv B", "72100-012");
        long usuarioId = criarUsuario("Aluno Inexistente", "aluno.inv@edu.df.senac.br", unidadeA);

        String payload = "{\"alteracoes\":{\"usuarios\":[{\"id\":" + usuarioId
                + ",\"nome\":\"Aluno Inexistente\",\"email\":\"aluno.inv@edu.df.senac.br\","
                + "\"perfil\":\"instrutor\",\"unidadeId\":999999}]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isConflict());

        assertThat(usuarios.findById(usuarioId).orElseThrow().getUnidadeId())
                .as("usuario deve permanecer na unidade original quando a destino nao existe")
                .isEqualTo(unidadeA);
    }

    @Test
    void transferenciaPreservaNomeEmailPerfilSenhaDoUsuario() throws Exception {
        long unidadeA = criarUnidade("Unidade Transf Dados A", "72100-021");
        long unidadeB = criarUnidade("Unidade Transf Dados B", "72100-022");
        long usuarioId = criarUsuario("Nome Original", "dados.intactos@edu.df.senac.br", unidadeA);
        Usuario antes = usuarios.findById(usuarioId).orElseThrow();

        // Payload identico ao do frontend: mesmos dados originais; somente o
        // unidadeId difere (a troca de unidade e o unico campo alterado).
        String payload = "{\"alteracoes\":{\"usuarios\":[{\"id\":" + usuarioId
                + ",\"nome\":\"" + antes.getNome() + "\",\"email\":\"" + antes.getEmail() + "\","
                + "\"perfil\":\"" + antes.getPerfil().name().toLowerCase(java.util.Locale.ROOT) + "\","
                + "\"unidadeId\":" + unidadeB + "}]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk());

        Usuario salvo = usuarios.findById(usuarioId).orElseThrow();
        // Somente o unidadeId foi alterado; todos os demais campos permanecem intactos.
        assertThat(salvo.getUnidadeId())
                .as("somente o unidadeId deve mudar na transferencia")
                .isEqualTo(unidadeB);
        assertThat(salvo.getId()).isEqualTo(antes.getId());
        assertThat(salvo.getNome()).isEqualTo(antes.getNome());
        assertThat(salvo.getEmail()).isEqualTo(antes.getEmail());
        assertThat(salvo.getPerfil()).isEqualTo(antes.getPerfil());
        assertThat(salvo.getSenha()).as("senha nao deve ser alterada na transferencia").isEqualTo(antes.getSenha());
    }

    @Test
    void remocaoDeUnidadeComUsuarioVinculadoViaSincERejeitadaENaoApagada() throws Exception {
        long unidade = criarUnidade("Unidade Protegida", "72100-031");
        long usuarioId = criarUsuario("Dono da Unidade", "dono.protegida@edu.df.senac.br", unidade);

        String payload = "{\"remocoes\":{\"unidades\":[" + unidade + "]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isConflict());

        assertThat(unidades.existsById(unidade))
                .as("unidade com usuario vinculado nao pode ser excluida via /api/sinc")
                .isTrue();
        assertThat(usuarios.findById(usuarioId).orElseThrow().getUnidadeId()).isEqualTo(unidade);
    }

    @Test
    void naoAdminNaoAlteraUnidadeDeSalaDeOutraUnidadeViaSinc() throws Exception {
        long unidadeA = criarUnidade("Unidade Isolada A", "72100-041");
        long unidadeB = criarUnidade("Unidade Isolada B", "72100-042");
        long coordenadorId = criarUsuario("Coord Isolado", "coord.isolado@edu.df.senac.br", unidadeA);
        assertThat(coordenadorId).isPositive();

        String salaCriada = mockMvc.perform(post("/api/salas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Sala Isolada\",\"tipo\":\"teorica\","
                                + "\"capacidade\":40,\"turnos\":[\"manha\"],"
                                + "\"unidadeId\":" + unidadeA + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long salaId = mapper.readTree(salaCriada).get("id").asLong();

        // Coordenador autenticado tenta mover a sala para outra unidade: isolamento
        // por unidade deve continuar valendo (nao-admin nao pode trocar unidade).
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("coord.isolado@edu.df.senac.br", "n/a", "ROLE_COORDENADOR"));

        String payload = "{\"alteracoes\":{\"salas\":[{\"id\":" + salaId
                + ",\"nome\":\"Sala Isolada\",\"tipo\":\"teorica\",\"capacidade\":40,"
                + "\"unidadeId\":" + unidadeB + "}]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isForbidden());
    }

    @Test
    void coordenadorNaoAlteraUnidadeDeOutroUsuarioViaSincRetorna403SemAlterarBanco() throws Exception {
        long unidadeA = criarUnidade("Unidade Coord Alt A", "72100-051");
        long unidadeB = criarUnidade("Unidade Coord Alt B", "72100-052");
        // Vitima: usuario que o coordenador tentara mover de unidade.
        long vitimaId = criarUsuario("Vitima Coordenador", "vitima.coord@edu.df.senac.br", unidadeA);
        // O proprio coordenador (autenticado), na mesma unidade da vitima.
        long coordenadorId = criarUsuario("Coord Autor", "coord.autor@edu.df.senac.br", unidadeA);
        assertThat(coordenadorId).isPositive();

        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("coord.autor@edu.df.senac.br", "n/a", "ROLE_COORDENADOR"));

        String payload = "{\"alteracoes\":{\"usuarios\":[{\"id\":" + vitimaId
                + ",\"nome\":\"Vitima Coordenador\",\"email\":\"vitima.coord@edu.df.senac.br\","
                + "\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeB + "}]}}";

        mockMvc.perform(post("/api/sinc").contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isForbidden());

        // Nenhuma alteracao no banco: a vitima permanece na unidade original.
        Usuario salvo = usuarios.findById(vitimaId).orElseThrow();
        assertThat(salvo.getUnidadeId())
                .as("unidadeId da vitima nao pode ser alterado por usuario nao-admin")
                .isEqualTo(unidadeA);
        assertThat(salvo.getNome()).isEqualTo("Vitima Coordenador");
    }
}
