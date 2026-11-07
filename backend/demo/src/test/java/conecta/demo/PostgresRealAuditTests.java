package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import conecta.demo.config.TestSecurityConfig;
import conecta.demo.service.IdAllocatorService;
import conecta.demo.service.SeedService;
import conecta.demo.service.SincService;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.annotation.Import;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * ETAPA 2 da auditoria — testes com PostgreSQL VERDADEIRO (Embedded Postgres / zonky),
 * e nao com H2 em modo de compatibilidade.
 *
 * <p>Cobertura:
 * <ul>
 *   <li>2.1 estrutura do banco (tabelas, tipos, PK, UNIQUE, transacoes/rollback);</li>
 *   <li>2.2 tabela id_sequences (criacao, init, coexistencia com IDs existentes,
 *       ausencia de colisao, bloqueio transacional e liberacao apos commit/rollback,
 *       concorrencia com multiplas conexoes reais);</li>
 *   <li>2.3 transacoes do lote de sincronizacao (5 cenarios pedidos no kickoff).</li>
 * </ul>
 *
 * <p>Nao toca no Supabase de producao: o banco e temporario e morre com a JVM.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PostgresRealAuditTests {

    private static EmbeddedPostgres postgres;
    private static String jdbcUrlPersistido;

    /**
     * Inicio lazy: o {@code @DynamicPropertySource} e avaliado durante a criacao do
     * contexto, ANTES do {@code @BeforeAll}; portanto o Embedded Postgres sobe dentro
     * do proprio supplier (thread-safe, uma unica instancia por JVM de teste).
     */
    private static synchronized EmbeddedPostgres postgresOuIniciar() throws Exception {
        if (postgres == null) {
            postgres = EmbeddedPostgres.start();
        }
        return postgres;
    }

    @AfterAll
    static void encerrarPostgresEmbutido() throws Exception {
        synchronized (PostgresRealAuditTests.class) {
            if (postgres != null) {
                postgres.close();
                postgres = null;
            }
        }
    }

    @DynamicPropertySource
    static void apontarDatasourceParaPostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> {
            try {
                jdbcUrlPersistido = postgresOuIniciar().getJdbcUrl("postgres", "postgres");
                return jdbcUrlPersistido;
            } catch (Exception ex) {
                throw new IllegalStateException("Falha ao obter URL do Embedded Postgres", ex);
            }
        });
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @Autowired
    private DataSource dataSource;

    @Autowired
    private IdAllocatorService allocator;

    @Autowired
    private SincService sinc;

    @Autowired
    private SeedService seed;

    private JdbcTemplate jdbc;

    @BeforeEach
    void autenticarAdminEBancarDados() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
        if (jdbc == null) {
            jdbc = new JdbcTemplate(dataSource);
        }
        seed.semear(); // banco novo do zonky; idempotente (sai se unidades.count() > 0)
    }

    // ------------------------------------------------------------------
    // 2.1 — Estrutura do banco
    // ------------------------------------------------------------------

    @Test
    void ehPostgresDeVerdadeComTodasAsTabelas() {
        String produto = jdbc.queryForObject(
                "SELECT current_setting('server_version')", String.class);
        List<String> tabelas = jdbc.queryForList(
                "SELECT table_name FROM information_schema.tables "
                        + "WHERE table_schema='public' ORDER BY table_name", String.class);

        assertThat(produto).doesNotContain("2.0"); // sanity: nao e H2
        assertThat(tabelas).contains("usuarios", "unidades", "salas", "turmas",
                "reservas", "chaves", "notificacoes", "solicitacoes", "id_sequences");
        System.out.println("[ETAPA2] PostgreSQL server_version=" + produto
                + " tabelas=" + tabelas);
    }

    @Test
    void chavesPrimariasEUniquesExistemNoPostgres() {
        // PK na tabela turmas
        Long pks = jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.table_constraints "
                        + "WHERE table_schema='public' AND table_name='turmas' "
                        + "AND constraint_type='PRIMARY KEY'", Long.class);
        assertThat(pks).isEqualTo(1);

        // UNIQUE no e-mail de usuarios (constraint real no banco)
        Long uniques = jdbc.queryForObject(
                "SELECT count(*) FROM pg_constraint c "
                        + "JOIN pg_class t ON t.oid = c.conrelid "
                        + "WHERE t.relname='usuarios' AND c.contype='u'", Long.class);
        assertThat(uniques).isGreaterThanOrEqualTo(1);

        // Tipos das colunas principais
        String tipoData = jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns "
                        + "WHERE table_name='turmas' AND column_name='data_inicio'", String.class);
        assertThat(tipoData).isEqualTo("date");
        String tipoNextId = jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns "
                        + "WHERE table_name='id_sequences' AND column_name='next_id'", String.class);
        assertThat(tipoNextId).isEqualTo("bigint");
    }

    @Test
    void transacaoCommitPersisteERollbackNaoPersiste() throws Exception {
        jdbc.update("DELETE FROM unidades WHERE id = 99001");
        try (Connection conn = dataSource.getConnection()) {
            // rollback apaga
            conn.setAutoCommit(false);
            try (Statement st = conn.createStatement()) {
                st.executeUpdate("INSERT INTO unidades (id, nome, cep, cidade, endereco) "
                        + "VALUES (99001, 'Rollback Test', '00000-000', 'Cidade', 'Rua X')");
            }
            conn.rollback();
            conn.setAutoCommit(true);
            Integer aposRollback = jdbc.queryForObject(
                    "SELECT count(*) FROM unidades WHERE id = 99001", Integer.class);
            assertThat(aposRollback).isZero();

            // commit persiste
            conn.setAutoCommit(false);
            try (Statement st = conn.createStatement()) {
                st.executeUpdate("INSERT INTO unidades (id, nome, cep, cidade, endereco) "
                        + "VALUES (99001, 'Commit Test', '00000-000', 'Cidade', 'Rua X')");
            }
            conn.commit();
            conn.setAutoCommit(true);
        }
        Integer aposCommit = jdbc.queryForObject(
                "SELECT count(*) FROM unidades WHERE id = 99001", Integer.class);
        assertThat(aposCommit).isEqualTo(1);
        jdbc.update("DELETE FROM unidades WHERE id = 99001"); // limpeza do banco temporario
    }

    // ------------------------------------------------------------------
    // 2.2 — id_sequences
    // ------------------------------------------------------------------

    @Test
    void idSequencesCriadaEInicializadaNoPostgres() {
        List<String> colecoes = jdbc.queryForList(
                "SELECT collection_key FROM id_sequences ORDER BY collection_key", String.class);
        assertThat(colecoes).containsExactlyInAnyOrder("usuarios", "unidades", "salas",
                "turmas", "reservas", "chaves", "notificacoes", "solicitacoes");

        List<Long> nextIds = jdbc.queryForList(
                "SELECT next_id FROM id_sequences", Long.class);
        assertThat(nextIds).allMatch(v -> v >= 1L);

        // inicializacao usa INSERT ... ON CONFLICT DO NOTHING (caminho Postgres)
        // e nunca regrava sequencias existentes:
        long antes = jdbc.queryForObject(
                "SELECT next_id FROM id_sequences WHERE collection_key='turmas'", Long.class);
        // nova "inicializacao" nao altera o valor corrente
        allocator.initializeCollections();
        long depois = jdbc.queryForObject(
                "SELECT next_id FROM id_sequences WHERE collection_key='turmas'", Long.class);
        assertThat(depois).isEqualTo(antes);
    }

    @Test
    void coexistenciaComRegistrosJaExistentesNaoColide() {
        // registro manual com ID alto (como os dados legados do Supabase)
        jdbc.update("DELETE FROM unidades WHERE id IN (99010, 99011, 99012)");
        jdbc.update("INSERT INTO unidades (id, nome, cep, cidade, endereco) "
                + "VALUES (99010, 'Legada Alta', '00000-001', 'C', 'R')");

        // o allocator usa max(id)+1 como piso: proximo id livre e 99011
        long id = allocator.next("unidades", () -> 99010L);
        assertThat(id).isGreaterThanOrEqualTo(99011L);

        // proxima alocacao continua monotonica, sem repetir
        long id2 = allocator.next("unidades", () -> 99010L);
        assertThat(id2).isGreaterThan(id);

        jdbc.update("DELETE FROM unidades WHERE id IN (99010)");
    }

    @Test
    void alocacaoConcorrenteComMultiplasConexoesNaoDuplicaNemPerdeId() throws Exception {
        int threads = 8;
        int porThread = 5;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch inicio = new CountDownLatch(1);
        Set<Long> ids = ConcurrentHashMap.newKeySet();
        List<Future<?>> tarefas = new ArrayList<>();

        for (int t = 0; t < threads; t++) {
            tarefas.add(pool.submit(() -> {
                inicio.await();
                for (int i = 0; i < porThread; i++) {
                    // supplier real: max(id) atual da tabela no banco
                    long maxAtual = jdbc.queryForObject(
                            "SELECT coalesce(max(id), 0) FROM turmas", Long.class);
                    ids.add(allocator.next("turmas", () -> maxAtual));
                }
                return null;
            }));
        }
        inicio.countDown();
        for (Future<?> f : tarefas) {
            f.get(60, TimeUnit.SECONDS);
        }
        pool.shutdownNow();

        assertThat(ids).hasSize(threads * porThread); // nenhum id duplicado
        System.out.println("[ETAPA2] " + threads + " conexoes x " + porThread
                + " alocacoes = " + ids.size() + " IDs unicos");
    }

    @Test
    void lockTransacionalBloqueiaSegundaConexaoELiberaAposCommit() throws Exception {
        jdbc.update("DELETE FROM unidades WHERE id IN (99020)");
        jdbc.update("INSERT INTO unidades (id, nome, cep, cidade, endereco) "
                + "VALUES (99020, 'Lock Test', '00000-002', 'C', 'R')");
        long maxFalso = 99020L;

        ExecutorService pool = Executors.newSingleThreadExecutor();
        try (Connection connBloqueante = dataSource.getConnection()) {
            connBloqueante.setAutoCommit(false);
            try (Statement st = connBloqueante.createStatement()) {
                st.executeQuery("SELECT next_id FROM id_sequences "
                        + "WHERE collection_key='unidades' FOR UPDATE");
                // segurando o lock, a 2a conexao DEVE bloquear
                Future<Long> pendente = pool.submit(
                        () -> allocator.next("unidades", () -> maxFalso));
                boolean bloqueou = false;
                try {
                    pendente.get(1, TimeUnit.SECONDS);
                } catch (TimeoutException esperado) {
                    bloqueou = true; // nao completou = lock funcionando
                }
                assertThat(bloqueou)
                        .as("proxima alocacao deve bloquear enquanto o lock esta segurado")
                        .isTrue();

                // commit libera o lock e a segunda conexao conclui
                connBloqueante.commit();
                Long alocado = pendente.get(15, TimeUnit.SECONDS);
                assertThat(alocado).isGreaterThan(maxFalso);
            }
        } finally {
            pool.shutdownNow();
            jdbc.update("DELETE FROM unidades WHERE id IN (99020)");
        }
    }

    @Test
    void lockTransacionalBloqueiaSegundaConexaoELiberaAposRollback() throws Exception {
        jdbc.update("DELETE FROM unidades WHERE id IN (99021)");
        jdbc.update("INSERT INTO unidades (id, nome, cep, cidade, endereco) "
                + "VALUES (99021, 'Rollback Lock', '00000-003', 'C', 'R')");
        long maxFalso = 99021L;

        ExecutorService pool = Executors.newSingleThreadExecutor();
        try (Connection connBloqueante = dataSource.getConnection()) {
            connBloqueante.setAutoCommit(false);
            try (Statement st = connBloqueante.createStatement()) {
                st.executeQuery("SELECT next_id FROM id_sequences "
                        + "WHERE collection_key='unidades' FOR UPDATE");
                Future<Long> pendente = pool.submit(
                        () -> allocator.next("unidades", () -> maxFalso));
                boolean bloqueou = false;
                try {
                    pendente.get(1, TimeUnit.SECONDS);
                } catch (TimeoutException esperado) {
                    bloqueou = true;
                }
                assertThat(bloqueou).isTrue();

                // rollback tambem deve liberar o lock (nao vaza bloqueio morto)
                connBloqueante.rollback();
                Long alocado = pendente.get(15, TimeUnit.SECONDS);
                assertThat(alocado).isGreaterThan(maxFalso);
            }
        } finally {
            pool.shutdownNow();
            jdbc.update("DELETE FROM unidades WHERE id IN (99021)");
        }
    }

    // ------------------------------------------------------------------
    // 2.3 — Transacoes do lote de sincronizacao (5 cenarios)
    // ------------------------------------------------------------------

    private Map<String, Object> corpoTurmas(List<Map<String, Object>> turmas) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("criados", Map.of("turmas", turmas));
        return corpo;
    }

    private Map<String, Object> turma(long id, String codigo, String curso, long unidadeId) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("id", id);
        t.put("nome", "Turma " + codigo);
        t.put("codigo", codigo);
        t.put("curso", curso);
        t.put("turno", "Matutino");
        t.put("dataInicio", "2026-02-01");
        t.put("dataFim", "2026-06-30");
        t.put("instrutorId", null);
        t.put("unidadeId", unidadeId);
        return t;
    }

    /** Turma invalida: sem nome/codigo/curso/turno (violacao de @NotBlank). */
    private Map<String, Object> turmaInvalida(long id, long unidadeId) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("id", id);
        t.put("nome", "");
        t.put("codigo", "");
        t.put("curso", "");
        t.put("turno", "");
        t.put("unidadeId", unidadeId);
        return t;
    }

    private boolean turmaExistePorCodigo(String codigo) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM turmas WHERE codigo = ?", Integer.class, codigo);
        return n != null && n > 0;
    }

    /** Recupera o id oficial realocado pela id_sequence a partir da resposta de /api/sinc. */
    @SuppressWarnings("unchecked")
    private Long idOficialDaResposta(Map<String, Object> resposta, String colecao, long provisorio) {
        Object ids = resposta.get("idsNovos");
        if (!(ids instanceof Map<?, ?> mapa)) {
            return null;
        }
        Object porColecao = mapa.get(colecao);
        if (!(porColecao instanceof Map<?, ?> turmas)) {
            return null;
        }
        Object oficial = turmas.get(String.valueOf(provisorio));
        return oficial == null ? null : ((Number) oficial).longValue();
    }

    @Test
    void cenario1_loteValidoPersisteTudo() {
        long idProvisorio = 96101L;
        String codigo = "PG2301";
        jdbc.update("DELETE FROM turmas WHERE codigo = ?", codigo);
        Map<String, Object> resposta = sinc.sincronizar(
                corpoTurmas(List.of(turma(idProvisorio, codigo, "Curso PG Valido", 1001L))));

        assertThat(resposta.get("ok")).isEqualTo(Boolean.TRUE);
        // o servico SEMPRE realoca o id de "criados" para o proximo da id_sequence;
        // o id oficial vem em "idsNovos" e deve existir de verdade no banco.
        Long oficial = idOficialDaResposta(resposta, "turmas", idProvisorio);
        assertThat(oficial).as("idsNovos.turmas.96101 presente").isNotNull();
        assertThat(oficial).isNotEqualTo(idProvisorio);
        assertThat(turmaExistePorCodigo(codigo)).isTrue();
        Integer banco = jdbc.queryForObject(
                "SELECT count(*) FROM turmas WHERE id = ?", Integer.class, oficial);
        assertThat(banco).isEqualTo(1);
        jdbc.update("DELETE FROM turmas WHERE codigo = ?", codigo);
    }

    @Test
    void cenario2_erroNoInicioDoLoteNaoDeixaGravacaoParcial() {
        String codigoValida = "PG2302";
        jdbc.update("DELETE FROM turmas WHERE codigo = ?", codigoValida);

        // primeira entidade invalida -> lote inteiro deve falhar
        assertThatThrownBy(() -> sinc.sincronizar(corpoTurmas(List.of(
                turmaInvalida(96102L, 1001L),
                turma(96103L, codigoValida, "Curso PG Meio", 1001L)))))
                .isNotNull();

        assertThat(turmaExistePorCodigo(codigoValida))
                .as("turma valida posterior nao persiste").isFalse();
        jdbc.update("DELETE FROM turmas WHERE codigo = ?", codigoValida);
    }

    @Test
    void cenario3_erroNoMeioDoLoteNaoDeixaGravacaoParcial() {
        String codigoA = "PG2303";
        String codigoB = "PG2304";
        jdbc.update("DELETE FROM turmas WHERE codigo IN (?, ?)", codigoA, codigoB);

        assertThatThrownBy(() -> sinc.sincronizar(corpoTurmas(List.of(
                turma(96104L, codigoA, "Curso PG A", 1001L),
                turmaInvalida(96105L, 1001L),
                turma(96106L, codigoB, "Curso PG B", 1001L)))))
                .isNotNull();

        assertThat(turmaExistePorCodigo(codigoA)).as("primeira turma valida foi revertida").isFalse();
        assertThat(turmaExistePorCodigo(codigoB)).as("terceira turma valida foi revertida").isFalse();
        jdbc.update("DELETE FROM turmas WHERE codigo IN (?, ?)", codigoA, codigoB);
    }

    @Test
    void cenario4_erroNaUltimaEntidadeNaoDeixaGravacaoParcial() {
        String codigoA = "PG2305";
        String codigoB = "PG2306";
        jdbc.update("DELETE FROM turmas WHERE codigo IN (?, ?)", codigoA, codigoB);

        assertThatThrownBy(() -> sinc.sincronizar(corpoTurmas(List.of(
                turma(96107L, codigoA, "Curso PG C", 1001L),
                turma(96108L, codigoB, "Curso PG D", 1001L),
                turmaInvalida(96109L, 1001L)))))
                .isNotNull();

        assertThat(turmaExistePorCodigo(codigoA)).isFalse();
        assertThat(turmaExistePorCodigo(codigoB)).isFalse();
        jdbc.update("DELETE FROM turmas WHERE codigo IN (?, ?)", codigoA, codigoB);
    }

    @Test
    void cenario5_duasSincronizacoesSimultaneasNaoDuplicamIds() throws Exception {
        // duas threads, cada uma com sua propria transacao e autenticacao.
        // IMPORTANTE: os itens devem ser MUTAVEIS — o servico faz item.put("id", oficial).
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch inicio = new CountDownLatch(1);
        List<Future<Long>> tarefas = new ArrayList<>();

        for (int t = 0; t < 2; t++) {
            final int n = t;
            tarefas.add(pool.submit(() -> {
                SecurityContextHolder.getContext().setAuthentication(
                        new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
                inicio.await();
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", 96201L + n);
                item.put("nome", "Unidade Concorrente " + n);
                item.put("cep", "70000-00" + n);
                item.put("cidade", "Brasilia");
                item.put("endereco", "SCS " + n);
                Map<String, Object> corpo = new LinkedHashMap<>();
                corpo.put("criados", new LinkedHashMap<>(Map.of("unidades", List.of(item))));
                Map<String, Object> resposta = sinc.sincronizar(corpo);
                return idOficialDaResposta(resposta, "unidades", 96201L + n);
            }));
        }
        inicio.countDown();
        List<Long> oficiais = new ArrayList<>();
        for (Future<Long> f : tarefas) {
            oficiais.add(f.get(60, TimeUnit.SECONDS)); // excecoes propagam e falham o teste
        }
        pool.shutdownNow();

        assertThat(oficiais).doesNotContainNull();
        assertThat(oficiais.get(0)).isNotEqualTo(oficiais.get(1)); // sem colisao de id
        for (Long id : oficiais) {
            Integer n = jdbc.queryForObject(
                    "SELECT count(*) FROM unidades WHERE id = ?", Integer.class, id);
            assertThat(n).isEqualTo(1);
        }
        jdbc.update("DELETE FROM unidades WHERE id IN (?, ?)", oficiais.get(0), oficiais.get(1));
        System.out.println("[ETAPA2] cenario5 OK: 2 sincronizacoes simultaneas, ids oficiais "
                + oficiais + " sem colisao");
    }

    /**
     * 2.2 — "Funcionamento com duas ou mais instancias do backend": sobe uma SEGUNDA
     * aplicacao Spring (contexto e pool de conexoes proprios, como faria uma outra
     * instancia no Render) apontando para o MESMO PostgreSQL e executa sincronizacoes
     * simultaneas entre as duas instancias. O coordenador de IDs e o lock no banco,
     * nao a memoria da JVM.
     */
    @Test
    void duasInstanciasDoBackendCompartilhamIdSequencesSemColidir() throws Exception {
        assertThat(jdbcUrlPersistido).as("URL do banco disponivel").isNotBlank();

        // NOTA: SpringApplicationBuilder.properties() adiciona os valores com BAIXA
        // precedencia (defaultProperties) — o src/test/resources/application.properties
        // (H2) vencia e a instancia 2 conectava no H2 em vez do zonky. O initializer
        // abaixo injeta as properties com addFirst (maior precedencia).
        try (ConfigurableApplicationContext segunda = new SpringApplicationBuilder(
                DemoApplication.class)
                .web(WebApplicationType.NONE)
                .profiles("test")
                .initializers((ApplicationContextInitializer<ConfigurableApplicationContext>) ctx -> {
                    ctx.getEnvironment().getPropertySources().addFirst(
                            new MapPropertySource("zonkyAudit", Map.of(
                                    "spring.datasource.url", jdbcUrlPersistido,
                                    "spring.datasource.username", "postgres",
                                    "spring.datasource.password", "postgres",
                                    "spring.datasource.driver-class-name", "org.postgresql.Driver")));
                })
                .run()) {

            SincService sincInstancia2 = segunda.getBean(SincService.class);
            assertThat(sincInstancia2).isNotNull();

            ExecutorService pool = Executors.newFixedThreadPool(2);
            CountDownLatch inicio = new CountDownLatch(1);
            List<Future<Long>> respostas = new ArrayList<>();

            // instancia 1 (este contexto de teste)
            respostas.add(pool.submit(() -> {
                SecurityContextHolder.getContext().setAuthentication(
                        new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
                inicio.await();
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", 96301L);
                item.put("nome", "Unidade Instancia 1");
                item.put("cep", "70000-101");
                item.put("cidade", "Brasilia");
                item.put("endereco", "SCS Q.1");
                Map<String, Object> corpo = new LinkedHashMap<>();
                corpo.put("criados", new LinkedHashMap<>(Map.of("unidades", List.of(item))));
                return idOficialDaResposta(sinc.sincronizar(corpo), "unidades", 96301L);
            }));

            // instancia 2 (contexto Spring separado, pool proprio)
            respostas.add(pool.submit(() -> {
                SecurityContextHolder.getContext().setAuthentication(
                        new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
                inicio.await();
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", 96302L);
                item.put("nome", "Unidade Instancia 2");
                item.put("cep", "70000-102");
                item.put("cidade", "Brasilia");
                item.put("endereco", "SCS Q.2");
                Map<String, Object> corpo = new LinkedHashMap<>();
                corpo.put("criados", new LinkedHashMap<>(Map.of("unidades", List.of(item))));
                return idOficialDaResposta(sincInstancia2.sincronizar(corpo), "unidades", 96302L);
            }));

            inicio.countDown();
            List<Long> oficiais = new ArrayList<>();
            for (Future<Long> f : respostas) {
                oficiais.add(f.get(90, TimeUnit.SECONDS));
            }
            pool.shutdownNow();

            assertThat(oficiais).doesNotContainNull();
            assertThat(oficiais.get(0)).isNotEqualTo(oficiais.get(1));
            System.out.println("[ETAPA2] duasInstancias oficiais=" + oficiais
                    + " unidadesNoBanco=" + jdbc.queryForList(
                            "SELECT id, nome FROM unidades WHERE nome LIKE 'Unidade Instancia%'"));
            for (Long id : oficiais) {
                assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM unidades WHERE id = ?", Integer.class, id))
                        .as("id oficial %s deve existir (oficiais=%s)", id, oficiais)
                        .isEqualTo(1);
            }
            jdbc.update("DELETE FROM unidades WHERE id IN (?, ?)", oficiais.get(0), oficiais.get(1));
            System.out.println("[ETAPA2] duas instancias do backend OK: ids oficiais "
                    + oficiais + " sem colisao (pools de conexao separados, mesmo banco)");
        }
    }
}
