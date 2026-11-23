package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import conecta.demo.model.Perfil;
import conecta.demo.model.Solicitacao;
import conecta.demo.model.StatusSolicitacao;
import conecta.demo.model.Usuario;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.service.SeedService;
import conecta.demo.service.UsuarioService;
import conecta.demo.security.JwtService;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Percorre login -> JWT -> filtro de seguranca -> /api/sinc -> PostgreSQL.
 *
 * <p>No GitHub Actions, TEST_POSTGRES_URL aponta para o servico postgres
 * efemero do job. Localmente, quando a variavel nao existe, o teste inicia
 * Embedded PostgreSQL; em nenhum caso usa o datasource padrao H2 ou remoto.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.jpa.hibernate.ddl-auto=update",
                "spring.flyway.enabled=false",
                "app.solicitacoes.expiracao-ms=3600000",
                "JWT_SECRET=integration-only-secret-key-with-at-least-32-characters"
        })
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SecurityIdentityPostgresIntegrationTest {
    private static EmbeddedPostgres embeddedPostgres;
    private static String embeddedUrl;

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String ciUrl = System.getenv("TEST_POSTGRES_URL");
        if (ciUrl != null && !ciUrl.isBlank()) {
            if (!ciUrl.contains("jdbc:postgresql://localhost:5432/conecta_ci")) {
                throw new IllegalStateException("TEST_POSTGRES_URL nao aponta para o PostgreSQL efemero do CI");
            }
            registry.add("spring.datasource.url", () -> ciUrl);
            registry.add("spring.datasource.username", () -> "conecta_ci");
            registry.add("spring.datasource.password", () -> "conecta_ci");
        } else {
            try {
                embeddedPostgres = EmbeddedPostgres.start();
                embeddedUrl = embeddedPostgres.getJdbcUrl("postgres", "postgres");
            } catch (Exception ex) {
                throw new IllegalStateException("Falha ao iniciar PostgreSQL descartavel", ex);
            }
            registry.add("spring.datasource.url", () -> embeddedUrl);
            registry.add("spring.datasource.username", () -> "postgres");
            registry.add("spring.datasource.password", () -> "postgres");
        }
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @AfterAll
    void fecharPostgresLocal() throws Exception {
        if (embeddedPostgres != null) embeddedPostgres.close();
    }

    @Autowired private DataSource dataSource;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private SeedService seed;
    @Autowired private UsuarioService usuarios;
    @Autowired private SolicitacaoRepository solicitacoes;
    @Autowired private JwtService jwt;
    private final ObjectMapperAdapter json = new ObjectMapperAdapter();
    @LocalServerPort private int port;

    private Usuario usuarioA;
    private Usuario usuarioB;
    private String tokenA;
    private String tokenB;
    private final HttpClient http = HttpClient.newHttpClient();

    @BeforeAll
    void prepararUsuarios() throws Exception {
        verificarPostgresTemporario();
        seed.semear();
        String sufixo = UUID.randomUUID().toString().substring(0, 8);
        usuarioA = criarUsuario("int.a." + sufixo + "@edu.df.senac.br");
        usuarioB = criarUsuario("int.b." + sufixo + "@edu.df.senac.br");
        assertThat(usuarioA.getId()).isNotEqualTo(usuarioB.getId());
    }

    @Test
    void autenticaIsolaIdempotenciaExpiracaoEConcorrenciaNoPostgres() throws Exception {
        tokenA = login(usuarioA);
        tokenB = login(usuarioB);
        assertThat(jwt.validar(tokenA).get("uid", Long.class)).isEqualTo(usuarioA.getId());
        assertThat(jwt.validar(tokenB).get("uid", Long.class)).isEqualTo(usuarioB.getId());

        String operacaoA = "http-identidade-a-" + UUID.randomUUID();
        HttpResponse<String> inicialA = sinc(tokenA, operacaoA, usuarioA.getId());
        assertEquals(200, inicialA.statusCode());
        HttpResponse<String> reenvioA = sinc(tokenA, operacaoA, usuarioA.getId());
        assertEquals(200, reenvioA.statusCode());
        assertThat(contarOperacao(operacaoA)).isEqualTo(1);
        assertThat(proprietario(operacaoA)).isEqualTo(usuarioA.getId());

        HttpResponse<String> reutilizacaoB = sinc(tokenB, operacaoA, usuarioB.getId());
        assertEquals(403, reutilizacaoB.statusCode());
        assertThat(contarOperacao(operacaoA)).isEqualTo(1);
        assertThat(proprietario(operacaoA)).isEqualTo(usuarioA.getId());

        String operacaoB = "http-identidade-b-" + UUID.randomUUID();
        assertEquals(200, sinc(tokenB, operacaoB, usuarioB.getId()).statusCode());
        assertEquals(200, sinc(tokenB, operacaoB, usuarioB.getId()).statusCode());
        assertThat(contarOperacao(operacaoB)).isEqualTo(1);
        assertThat(proprietario(operacaoB)).isEqualTo(usuarioB.getId());

        verificarConcorrencia(tokenA, usuarioA.getId(), "http-concorrente-a-" + UUID.randomUUID(), 200,
                usuarioA.getId());
        verificarConcorrencia(tokenB, usuarioB.getId(), operacaoA, 403, usuarioA.getId());

        verificarExpiracaoSomenteDosRegistrosArtificiais(tokenA, usuarioA.getId());
    }

    private void verificarPostgresTemporario() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            String produto = connection.getMetaData().getDatabaseProductName();
            String url = connection.getMetaData().getURL();
            assertThat(produto).isEqualToIgnoringCase("PostgreSQL");
            assertThat(url).startsWith("jdbc:postgresql://");
            String ciUrl = System.getenv("TEST_POSTGRES_URL");
            if (ciUrl != null && !ciUrl.isBlank()) {
                assertThat(url).contains("localhost:5432/conecta_ci");
            }
        }
    }

    private Usuario criarUsuario(String email) {
        Usuario usuario = new Usuario();
        usuario.setNome("Usuario de integracao");
        usuario.setEmail(email);
        usuario.setSenha("Senha.Integracao.123");
        usuario.setPerfil(Perfil.ADMIN);
        usuario.setUnidadeId(1001L);
        return usuarios.criar(usuario);
    }

    @SuppressWarnings("unchecked")
    private String login(Usuario usuario) throws Exception {
        HttpResponse<String> resposta = post("/api/login", null,
                json.write(Map.of("email", usuario.getEmail(), "senha", "Senha.Integracao.123")));
        assertEquals(200, resposta.statusCode(), resposta.body());
        Map<String, Object> corpo = json.read(resposta.body());
        String token = String.valueOf(corpo.get("token"));
        Map<String, Object> usuarioRetornado = (Map<String, Object>) corpo.get("usuario");
        assertThat(((Number) usuarioRetornado.get("id")).longValue()).isEqualTo(usuario.getId());
        assertThat(token).isNotBlank();
        return token;
    }

    private HttpResponse<String> sinc(String token, String operacaoId, Long userId) throws Exception {
        return post("/api/sinc", token, json.write(Map.of(
                "operacaoId", operacaoId,
                "userId", userId)));
    }

    private HttpResponse<String> post(String path, String token, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private void verificarConcorrencia(String token, Long userId, String operacaoId, int status,
            Long proprietarioEsperado)
            throws Exception {
        int quantidade = 6;
        ExecutorService executor = Executors.newFixedThreadPool(quantidade);
        CountDownLatch inicio = new CountDownLatch(1);
        List<Future<Integer>> respostas = new ArrayList<>();
        try {
            for (int i = 0; i < quantidade; i++) {
                respostas.add(executor.submit(() -> {
                    inicio.await();
                    return sinc(token, operacaoId, userId).statusCode();
                }));
            }
            inicio.countDown();
            for (Future<Integer> resposta : respostas) assertEquals(status, resposta.get());
        } finally {
            executor.shutdownNow();
        }
        assertThat(contarOperacao(operacaoId)).isEqualTo(1);
        assertThat(proprietario(operacaoId)).isEqualTo(proprietarioEsperado);
    }

    private void verificarExpiracaoSomenteDosRegistrosArtificiais(String token, Long userId)
            throws Exception {
        long vencidaId = Math.abs(System.nanoTime());
        long futuraId = vencidaId + 1;
        solicitacoes.saveAndFlush(solicitacao(vencidaId, LocalDate.now().minusDays(1)));
        solicitacoes.saveAndFlush(solicitacao(futuraId, LocalDate.now().plusDays(5)));

        Map<Long, String> antes = snapshotExceto(vencidaId, futuraId);
        assertEquals(200, sinc(token, "http-expiracao-" + UUID.randomUUID(), userId).statusCode());

        Solicitacao vencida = solicitacoes.findById(vencidaId).orElseThrow();
        Solicitacao futura = solicitacoes.findById(futuraId).orElseThrow();
        assertThat(vencida.getStatus()).isEqualTo(StatusSolicitacao.EXPIRADA);
        assertThat(vencida.getExpiradaEm()).isNotNull();
        assertThat(vencida.getOrigemStatus()).isEqualTo("SISTEMA");
        assertThat(vencida.getMotivoStatus()).isNotBlank();
        assertThat(futura.getStatus()).isEqualTo(StatusSolicitacao.PENDENTE);
        assertThat(futura.getExpiradaEm()).isNull();
        assertThat(snapshotExceto(vencidaId, futuraId)).isEqualTo(antes);
    }

    private Solicitacao solicitacao(long id, LocalDate data) {
        Solicitacao solicitacao = new Solicitacao();
        solicitacao.setId(id);
        solicitacao.setSalaId(5001L);
        solicitacao.setInstrutorId(13L);
        solicitacao.setTurmaId(null);
        solicitacao.setUnidadeId(1001L);
        solicitacao.setData(data);
        solicitacao.setDataInicio(data);
        solicitacao.setDataFim(data);
        solicitacao.setTurnos(java.util.Set.of("Matutino"));
        solicitacao.setModo("unica");
        solicitacao.setStatus(StatusSolicitacao.PENDENTE);
        return solicitacao;
    }

    private Map<Long, String> snapshotExceto(long... ids) {
        String placeholders = java.util.Arrays.stream(ids).mapToObj(i -> "?").reduce((a, b) -> a + "," + b).orElse("");
        List<Object> args = java.util.Arrays.stream(ids).boxed().map(i -> (Object) i).toList();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, status, expirada_em, origem_status, motivo_status "
                        + "FROM solicitacoes WHERE id NOT IN (" + placeholders + ") ORDER BY id",
                args.toArray());
        Map<Long, String> result = new HashMap<>();
        for (Map<String, Object> row : rows) {
            result.put(((Number) row.get("id")).longValue(), row.toString());
        }
        return result;
    }

    private int contarOperacao(String id) {
        return jdbc.queryForObject("SELECT count(*) FROM sinc_operacoes WHERE id = ?", Integer.class, id);
    }

    private Long proprietario(String id) {
        return jdbc.queryForObject("SELECT usuario_id FROM sinc_operacoes WHERE id = ?", Long.class, id);
    }

    /**
     * Pequeno adaptador para manter o teste independente da API de Jackson
     * exposta pelo Spring Boot 4 nos demais testes do projeto.
     */
    static class ObjectMapperAdapter {
        private final tools.jackson.databind.ObjectMapper mapper = new tools.jackson.databind.ObjectMapper();

        String write(Object value) throws Exception {
            return mapper.writeValueAsString(value);
        }

        @SuppressWarnings("rawtypes")
        Map<String, Object> read(String value) throws Exception {
            return mapper.readValue(value, Map.class);
        }
    }
}
