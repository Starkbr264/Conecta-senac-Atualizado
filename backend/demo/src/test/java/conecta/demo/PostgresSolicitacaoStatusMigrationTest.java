package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Valida a atualização da constraint legada em PostgreSQL real e isolado. */
class PostgresSolicitacaoStatusMigrationTest {
    private static final String MIGRATION = "sql/migrations/V20261120_01__expand_solicitacao_status.sql";
    private static EmbeddedPostgres postgres;
    private static String jdbcUrl;

    @AfterAll
    static void fecharPostgres() throws Exception {
        if (postgres != null) postgres.close();
    }

    @BeforeEach
    void prepararEstruturaLegada() throws Exception {
        if (postgres == null) {
            postgres = EmbeddedPostgres.start();
            jdbcUrl = postgres.getJdbcUrl("postgres", "postgres");
        }
        try (Connection connection = conectar(); Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS solicitacoes CASCADE");
            statement.execute("""
                    CREATE TABLE solicitacoes (
                        id BIGINT PRIMARY KEY,
                        status VARCHAR(32) NOT NULL,
                        CONSTRAINT solicitacoes_status_check
                            CHECK (status IN ('PENDENTE', 'APROVADA', 'RECUSADA'))
                    )
                    """);
            statement.execute("INSERT INTO solicitacoes (id, status) VALUES "
                    + "(1, 'PENDENTE'), (2, 'APROVADA'), (3, 'RECUSADA')");
        }
    }

    @Test
    void migrationaConstraintAceitaOsCincoEstadosEPreservaOsAntigos() throws Exception {
        aplicarMigration();

        try (Connection connection = conectar(); Statement statement = connection.createStatement()) {
            for (String status : List.of("PENDENTE", "APROVADA", "RECUSADA", "CANCELADA", "EXPIRADA")) {
                statement.executeUpdate("INSERT INTO solicitacoes (id, status) VALUES (10, '" + status + "')");
                statement.executeUpdate("DELETE FROM solicitacoes WHERE id = 10");
            }

            assertThatThrownBy(() -> statement.executeUpdate(
                    "INSERT INTO solicitacoes (id, status) VALUES (11, 'INVALIDO')"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("solicitacoes_status_check");

            assertThat(statuses(statement)).containsExactly("PENDENTE", "APROVADA", "RECUSADA");
        }
    }

    @Test
    void migrationRecusaValoresDesconhecidosSemConverterOuExcluirRegistros() throws Exception {
        try (Connection connection = conectar(); Statement statement = connection.createStatement()) {
            statement.execute("ALTER TABLE solicitacoes DROP CONSTRAINT solicitacoes_status_check");
            statement.execute("INSERT INTO solicitacoes (id, status) VALUES (4, 'LEGADO_DESCONHECIDO')");
        }

        assertThatThrownBy(this::aplicarMigration)
                .isInstanceOf(Exception.class)
                .hasMessageContaining("valores de status desconhecidos");

        try (Connection connection = conectar(); Statement statement = connection.createStatement()) {
            assertThat(statuses(statement)).containsExactly("PENDENTE", "APROVADA", "RECUSADA", "LEGADO_DESCONHECIDO");
        }
    }

    @Test
    void transicoesDosCincoEstadosPersistemNoPostgresEEstadosTerminaisNaoMudam() throws Exception {
        aplicarMigration();

        try (Connection connection = conectar(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("UPDATE solicitacoes SET status = 'EXPIRADA' WHERE id = 1");
            statement.executeUpdate("UPDATE solicitacoes SET status = 'CANCELADA' WHERE id = 1");
            statement.executeUpdate("UPDATE solicitacoes SET status = 'APROVADA' WHERE id = 1");
            statement.executeUpdate("UPDATE solicitacoes SET status = 'RECUSADA' WHERE id = 1");
            statement.executeUpdate("UPDATE solicitacoes SET status = 'EXPIRADA' WHERE id = 1");
            try (var result = statement.executeQuery("SELECT status FROM solicitacoes WHERE id = 1")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("EXPIRADA");
            }
        }
    }

    private void aplicarMigration() throws Exception {
        Path path = Path.of(MIGRATION);
        String sql = Files.readString(path, StandardCharsets.UTF_8);
        try (Connection connection = conectar(); Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private Connection conectar() throws SQLException {
        return DriverManager.getConnection(jdbcUrl, "postgres", "postgres");
    }

    private List<String> statuses(Statement statement) throws SQLException {
        try (var result = statement.executeQuery("SELECT status FROM solicitacoes ORDER BY id")) {
            return Stream.generate(() -> {
                        try {
                            return result.next() ? result.getString(1) : null;
                        } catch (SQLException exception) {
                            throw new IllegalStateException(exception);
                        }
                    })
                    .takeWhile(value -> value != null)
                    .toList();
        }
    }
}
