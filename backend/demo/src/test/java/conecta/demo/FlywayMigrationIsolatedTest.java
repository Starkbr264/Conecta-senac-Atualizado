package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * Valida V1 em um PostgreSQL descartavel com o formato legado da tabela.
 * Nao usa o datasource dos testes de aplicacao nem qualquer banco compartilhado.
 */
class FlywayMigrationIsolatedTest {
    private static EmbeddedPostgres postgres;
    private static JdbcTemplate jdbc;
    private static String jdbcUrl;

    @BeforeAll
    static void criarSchemaLegado() throws Exception {
        postgres = EmbeddedPostgres.start();
        jdbcUrl = postgres.getJdbcUrl("postgres", "postgres");
        try (ConfigurableApplicationContext ignored = contexto("create")) {
            // Hibernate cria o schema completo representativo da aplicacao.
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource(jdbcUrl, "postgres", "postgres");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("ALTER TABLE sinc_operacoes DROP COLUMN usuario_id");
        jdbc.update("INSERT INTO sinc_operacoes (id, resposta_json, criada_em) "
                + "VALUES (?, ?, CURRENT_TIMESTAMP)", "legacy-op", "{}");
    }

    @AfterAll
    static void fecharPostgres() throws Exception {
        if (postgres != null) postgres.close();
    }

    @Test
    void aplicaV1PreservaLegadoCriaOwnerIndexEForeignKeyNaoValidada() {
        Flyway.configure()
                .dataSource(jdbc.getDataSource())
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load()
                .migrate();

        assertThat(jdbc.queryForObject(
                "SELECT usuario_id FROM sinc_operacoes WHERE id = 'legacy-op'", Long.class))
                .isNull();
        assertThat(jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns "
                        + "WHERE table_name = 'sinc_operacoes' AND column_name = 'usuario_id'",
                String.class)).isEqualTo("bigint");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM pg_indexes WHERE tablename = 'sinc_operacoes' "
                        + "AND indexname = 'ux_sinc_operacoes_id_global'", Integer.class))
                .isEqualTo(0);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.table_constraints "
                        + "WHERE table_name = 'sinc_operacoes' AND constraint_type = 'PRIMARY KEY'",
                Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM pg_indexes WHERE tablename = 'sinc_operacoes' "
                        + "AND indexname = 'ix_sinc_operacoes_usuario_id'", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT convalidated FROM pg_constraint "
                        + "WHERE conname = 'fk_sinc_operacoes_usuario'", Boolean.class))
                .isFalse();

        jdbc.update("INSERT INTO usuarios "
                + "(id, nome, email, senha, perfil, unidade_id) "
                + "VALUES (?, ?, ?, ?, ?, ?)",
                42L, "Migration User", "migration@edu.df.senac.br",
                "Senha.123", "ADMIN", 1001L);
        jdbc.update("INSERT INTO sinc_operacoes (id, resposta_json, usuario_id, criada_em) "
                + "VALUES (?, ?, ?, CURRENT_TIMESTAMP)", "owned-op", "{}", 42L);
        assertThat(jdbc.queryForObject(
                "SELECT usuario_id FROM sinc_operacoes WHERE id = 'owned-op'", Long.class))
                .isEqualTo(42L);

        try (ConfigurableApplicationContext ignored = contexto("validate")) {
            // A inicializacao so conclui se ddl-auto=validate aceitar o schema migrado.
        }
    }

    private static ConfigurableApplicationContext contexto(String ddlAuto) {
        return new SpringApplicationBuilder(DemoApplication.class)
                .web(WebApplicationType.NONE)
                .initializers(context -> context.getEnvironment().getPropertySources().addFirst(
                        new MapPropertySource("isolatedMigration", java.util.Map.of(
                                "spring.datasource.url", jdbcUrl,
                                "spring.datasource.username", "postgres",
                                "spring.datasource.password", "postgres",
                                "spring.datasource.driver-class-name", "org.postgresql.Driver",
                                "spring.flyway.enabled", "false",
                                "spring.jpa.hibernate.ddl-auto", ddlAuto,
                                "JWT_SECRET", "teste-seguro-com-pelo-menos-32-caracteres-123456"))))
                .run();
    }
}
