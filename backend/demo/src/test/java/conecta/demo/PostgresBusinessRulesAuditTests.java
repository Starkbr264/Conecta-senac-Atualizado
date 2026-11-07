package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import conecta.demo.config.TestSecurityConfig;
import conecta.demo.service.SeedService;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * ETAPA 3 da auditoria — regras de negocio contra PostgreSQL VERDADEIRO (zonky),
 * cobrindo os 7 grupos do kickoff com codigo HTTP e estado final no banco:
 *
 * <ul>
 *   <li>Usuarios (6 cenarios)</li>
 *   <li>Unidades (4 cenarios)</li>
 *   <li>Salas e turmas (5 cenarios)</li>
 *   <li>Reservas (5 cenarios)</li>
 *   <li>Chaves (4 cenarios)</li>
 *   <li>Solicitacoes e notificacoes (8 cenarios)</li>
 *   <li>Seguranca e autorizacao (5 cenarios)</li>
 * </ul>
 *
 * <p>Padrao igual ao {@code SincBusinessRulesTest} (MockMvc sem filtros de seguranca
 * + {@code TestingAuthenticationToken} no {@code SecurityContextHolder}), porem com
 * Embedded Postgres no lugar do H2. Nao toca no Supabase de producao.
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PostgresBusinessRulesAuditTests {

    private static EmbeddedPostgres postgres;
    private static String jdbcUrl;

    /** Inicio lazy: o @DynamicPropertySource roda antes de qualquer @BeforeAll. */
    private static synchronized EmbeddedPostgres postgresOuIniciar() throws Exception {
        if (postgres == null) {
            postgres = EmbeddedPostgres.start();
        }
        return postgres;
    }

    @DynamicPropertySource
    static void apontarParaPostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> {
            try {
                jdbcUrl = postgresOuIniciar().getJdbcUrl("postgres", "postgres");
                return jdbcUrl;
            } catch (Exception ex) {
                throw new IllegalStateException("Falha ao obter URL do Embedded Postgres", ex);
            }
        });
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private SeedService seed;

    private JdbcTemplate jdbc;
    private final tools.jackson.databind.ObjectMapper mapper =
            new tools.jackson.databind.ObjectMapper();

    @BeforeEach
    void preparar() {
        SecurityContextHolder.clearContext();
        if (jdbc == null) {
            jdbc = new JdbcTemplate(dataSource);
        }
        seed.semear();
        // Limpa registros criados por cenarios anteriores (ids acima dos seeds).
        // Tabelas colecao (FK) antes das pais.
        jdbc.update("DELETE FROM solicitacao_turnos WHERE solicitacao_id > 10004");
        jdbc.update("DELETE FROM solicitacao_dias_semana WHERE solicitacao_id > 10004");
        jdbc.update("DELETE FROM solicitacao_datas_especificas WHERE solicitacao_id > 10004");
        jdbc.update("DELETE FROM reserva_dias_semana WHERE reserva_id > 7031");
        jdbc.update("DELETE FROM sala_turnos WHERE sala_id > 5050");
        jdbc.update("DELETE FROM sala_turnos_legado WHERE sala_id > 5050");
        jdbc.update("DELETE FROM usuarios WHERE id > 42");
        jdbc.update("DELETE FROM unidades WHERE id > 1010");
        jdbc.update("DELETE FROM salas WHERE id > 5050");
        jdbc.update("DELETE FROM turmas WHERE id > 6040");
        jdbc.update("DELETE FROM reservas WHERE id > 7031");
        jdbc.update("DELETE FROM chaves WHERE id > 8020");
        jdbc.update("DELETE FROM notificacoes WHERE id > 9004");
        jdbc.update("DELETE FROM solicitacoes WHERE id > 10004");
        // Padrao do grupo: autenticar como ADMIN por omissao.
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
    }

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private Map<String, Object> obj(Object... pares) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pares.length; i += 2) {
            m.put(String.valueOf(pares[i]), pares[i + 1]);
        }
        return m;
    }

    private Map<String, Object> lote(String acao, String colecao, List<Map<String, Object>> itens) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put(acao, new LinkedHashMap<>(Map.of(colecao, itens)));
        return corpo;
    }

    private ResultActions sinc(String papel, String email, Map<String, Object> corpo) throws Exception {
        if (papel == null) {
            SecurityContextHolder.getContext().setAuthentication(
                    new TestingAuthenticationToken(email, "n/a"));
        } else {
            SecurityContextHolder.getContext().setAuthentication(
                    new TestingAuthenticationToken(email, "n/a", "ROLE_" + papel));
        }
        return mockMvc.perform(post("/api/sinc")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(corpo)));
    }

    private ResultActions admin(Map<String, Object> corpo) throws Exception {
        return sinc("ADMIN", "admin@senac.test", corpo);
    }

    private int contar(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    /** Recupera o id oficial realocado pela id_sequence a partir da resposta. */
    private Long idOficial(ResultActions ra, String colecao, long provisorio) throws Exception {
        return idOficialDoJson(ra.andReturn().getResponse().getContentAsString(),
                colecao, provisorio);
    }

    @SuppressWarnings("unchecked")
    private Long idOficialDoJson(String json, String colecao, long provisorio) throws Exception {
        Map<String, Object> resposta = mapper.readValue(json, Map.class);
        Object ids = resposta.get("idsNovos");
        if (!(ids instanceof Map<?, ?> porColecao)) return null;
        Object interno = porColecao.get(colecao);
        if (!(interno instanceof Map<?, ?> mapa)) return null;
        Object oficial = mapa.get(String.valueOf(provisorio));
        return oficial == null ? null : ((Number) oficial).longValue();
    }

    // ==================================================================
    // GRUPO 1 — USUARIOS
    // ==================================================================

    @Test
    void usuarioCadastroValido() throws Exception {
        ResultActions ra = admin(lote("criados", "usuarios", List.of(obj(
                "id", 97001L, "nome", "Auditor E2E", "email", "auditor.etapa3@senac.test",
                "senha", "SenhaForte123", "perfil", "ADMIN", "unidadeId", 1001L))));
        ra.andExpect(status().isOk());

        Long oficial = idOficial(ra, "usuarios", 97001L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM usuarios WHERE id = ?", oficial)).isEqualTo(1);
        // Senha gravada com hash BCrypt (login usa encoder.matches).
        String hash = jdbc.queryForObject(
                "SELECT senha FROM usuarios WHERE id = ?", String.class, oficial);
        assertThat(hash).matches("\\$2[aby]\\$.+");
        assertThat(contar("SELECT count(*) FROM usuarios WHERE email = ?",
                "auditor.etapa3@senac.test")).isEqualTo(1);
    }

    @Test
    void usuarioSenhaInferiorA8Caracteres() throws Exception {
        admin(lote("criados", "usuarios", List.of(obj(
                        "id", 97002L, "nome", "Senha Curta", "email", "senha.curta@senac.test",
                        "senha", "1234567", "perfil", "ADMIN", "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("A senha deve ter pelo menos 8 caracteres"));

        assertThat(contar("SELECT count(*) FROM usuarios WHERE email = ?",
                "senha.curta@senac.test")).isZero();
    }

    @Test
    void usuarioEmailDuplicado() throws Exception {
        admin(lote("criados", "usuarios", List.of(obj(
                        "id", 97003L, "nome", "Duplicado", "email", "Senac_GDF@Hotmail.com",
                        "senha", "SenhaForte123", "perfil", "ADMIN", "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Ja existe um usuario com este e-mail"));

        // Estado final: o usuario original permanece unico.
        assertThat(contar("SELECT count(*) FROM usuarios WHERE email = ?",
                "Senac_GDF@Hotmail.com")).isEqualTo(1);
    }

    @Test
    void usuarioEdicao() throws Exception {
        ResultActions criado = admin(lote("criados", "usuarios", List.of(obj(
                "id", 97004L, "nome", "Nome Original", "email", "edicao.etapa3@senac.test",
                "senha", "SenhaForte123", "perfil", "RECEPCAO", "unidadeId", 1001L))));
        criado.andExpect(status().isOk());
        Long id = idOficial(criado, "usuarios", 97004L);
        assertThat(id).isNotNull();

        // Edicao sem senha no payload: a senha atual deve ser preservada.
        admin(lote("alteracoes", "usuarios", List.of(obj(
                        "id", id, "nome", "Nome Editado", "email", "edicao.etapa3@senac.test",
                        "perfil", "RECEPCAO", "unidadeId", 1001L))))
                .andExpect(status().isOk());

        String nome = jdbc.queryForObject(
                "SELECT nome FROM usuarios WHERE id = ?", String.class, id);
        assertThat(nome).isEqualTo("Nome Editado");
        String hash = jdbc.queryForObject(
                "SELECT senha FROM usuarios WHERE id = ?", String.class, id);
        assertThat(hash).matches("\\$2[aby]\\$.+");
    }

    @Test
    void usuarioPerfilAusente() throws Exception {
        admin(lote("criados", "usuarios", List.of(obj(
                        "id", 97005L, "nome", "Sem Perfil", "email", "sem.perfil@senac.test",
                        "senha", "SenhaForte123", "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Dados do usuario invalidos"));

        assertThat(contar("SELECT count(*) FROM usuarios WHERE email = ?",
                "sem.perfil@senac.test")).isZero();
    }

    @Test
    void usuarioPerfilDesconhecido() throws Exception {
        admin(lote("criados", "usuarios", List.of(obj(
                        "id", 97006L, "nome", "Perfil Errado", "email", "perfil.errado@senac.test",
                        "senha", "SenhaForte123", "perfil", "SUPERVISOR", "unidadeId", 1001L))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("usuarios.perfil"));

        assertThat(contar("SELECT count(*) FROM usuarios WHERE email = ?",
                "perfil.errado@senac.test")).isZero();
    }

    // ==================================================================
    // GRUPO 2 — UNIDADES
    // ==================================================================

    @Test
    void unidadeCadastroValido() throws Exception {
        ResultActions ra = admin(lote("criados", "unidades", List.of(obj(
                "id", 97010L, "nome", "Unidade Auditoria E2E", "cep", "70000-001",
                "cidade", "Brasilia", "endereco", "SCS Quadra 01"))));
        ra.andExpect(status().isOk());

        Long oficial = idOficial(ra, "unidades", 97010L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM unidades WHERE id = ?", oficial)).isEqualTo(1);
        String cep = jdbc.queryForObject(
                "SELECT cep FROM unidades WHERE id = ?", String.class, oficial);
        assertThat(cep).isEqualTo("70000-001");
    }

    @Test
    void unidadeDadosIncompletos() throws Exception {
        admin(lote("criados", "unidades", List.of(obj(
                        "id", 97011L, "nome", "", "cep", "70000-002",
                        "cidade", "Brasilia", "endereco", "Rua X"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("nome"));

        assertThat(contar("SELECT count(*) FROM unidades WHERE id = ?", 97011L)).isZero();
        assertThat(contar("SELECT count(*) FROM unidades WHERE id > 1010")).isZero();
    }

    @Test
    void unidadeDuplicidadeDeNome() throws Exception {
        admin(lote("criados", "unidades", List.of(obj(
                        "id", 97012L, "nome", "SENAC Asa Norte", "cep", "70000-003",
                        "cidade", "Brasilia", "endereco", "Rua Y"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Ja existe uma unidade com este nome"));

        assertThat(contar("SELECT count(*) FROM unidades WHERE nome = ?",
                "SENAC Asa Norte")).isEqualTo(1); // apenas o seed
    }

    @Test
    void unidadeReferenciaInvalidaCepMalformado() throws Exception {
        admin(lote("criados", "unidades", List.of(obj(
                        "id", 97013L, "nome", "Unidade CEP Ruim", "cep", "123",
                        "cidade", "Brasilia", "endereco", "Rua Z"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("CEP deve conter 8 digitos"));

        assertThat(contar("SELECT count(*) FROM unidades WHERE nome = ?",
                "Unidade CEP Ruim")).isZero();
    }

    // ==================================================================
    // GRUPO 3 — SALAS E TURMAS
    // ==================================================================

    @Test
    void salaECadastroValido() throws Exception {
        ResultActions ra = admin(lote("criados", "salas", List.of(obj(
                "id", 97020L, "nome", "Sala Auditoria E2E 01", "tipo", "Laboratorio",
                "capacidade", 25, "andar", "1o Andar", "unidadeId", 1001L,
                "turnos", List.of("Matutino", "Vespertino")))));
        ra.andExpect(status().isOk());

        Long oficial = idOficial(ra, "salas", 97020L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM salas WHERE id = ?", oficial)).isEqualTo(1);
    }

    @Test
    void salaCapacidadeInvalida() throws Exception {
        admin(lote("criados", "salas", List.of(obj(
                        "id", 97021L, "nome", "Sala Cap Zero", "tipo", "Sala Comum",
                        "capacidade", 0, "unidadeId", 1001L, "turnos", List.of("Matutino")))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("capacidade"));

        assertThat(contar("SELECT count(*) FROM salas WHERE nome = ?", "Sala Cap Zero")).isZero();
    }

    @Test
    void salaTurnoInvalidoAusente() throws Exception {
        admin(lote("criados", "salas", List.of(obj(
                        "id", 97022L, "nome", "Sala Sem Turno", "tipo", "Sala Comum",
                        "capacidade", 20, "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Informe ao menos um turno da sala"));

        assertThat(contar("SELECT count(*) FROM salas WHERE nome = ?", "Sala Sem Turno")).isZero();
    }

    @Test
    void turmaInstrutorInexistente() throws Exception {
        admin(lote("criados", "turmas", List.of(obj(
                        "id", 97030L, "nome", "Turma E2E Instrutor", "codigo", "PG-E2E-01",
                        "curso", "Auditoria", "turno", "Matutino",
                        "dataInicio", LocalDate.now().plusDays(10).toString(),
                        "dataFim", LocalDate.now().plusDays(100).toString(),
                        "instrutorId", 999999L, "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Instrutor informado nao existe"));

        assertThat(contar("SELECT count(*) FROM turmas WHERE codigo = ?", "PG-E2E-01")).isZero();
    }

    @Test
    void turmaInstrutorDeOutraUnidade() throws Exception {
        // instrutor 15 (Leonardo Cruz) pertence a unidade 1002; turma em 1001.
        admin(lote("criados", "turmas", List.of(obj(
                        "id", 97031L, "nome", "Turma E2E Unidade", "codigo", "PG-E2E-02",
                        "curso", "Auditoria", "turno", "Matutino",
                        "dataInicio", LocalDate.now().plusDays(10).toString(),
                        "dataFim", LocalDate.now().plusDays(100).toString(),
                        "instrutorId", 15L, "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro")
                        .value("Instrutor deve pertencer a mesma unidade da turma"));

        assertThat(contar("SELECT count(*) FROM turmas WHERE codigo = ?", "PG-E2E-02")).isZero();
    }

    @Test
    void turmaCadastroValido() throws Exception {
        ResultActions ra = admin(lote("criados", "turmas", List.of(obj(
                "id", 97032L, "nome", "2026.01.902", "codigo", "PG-E2E-OK",
                "curso", "Auditoria", "turno", "Matutino",
                "dataInicio", LocalDate.now().plusDays(10).toString(),
                "dataFim", LocalDate.now().plusDays(100).toString(),
                "instrutorId", 13L, "unidadeId", 1001L))));
        ra.andExpect(status().isOk());

        Long oficial = idOficial(ra, "turmas", 97032L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM turmas WHERE id = ?", oficial)).isEqualTo(1);
    }

    // ==================================================================
    // GRUPO 4 — RESERVAS
    // ==================================================================

    @Test
    void reservaCadastroValido() throws Exception {
        // Sala 5004 (unidade 1001, turnos Matutino/Vespertino/Noturno) sem reserva seed;
        // turma 6003 e Noturno e termina em hoje+120.
        ResultActions ra = admin(lote("criados", "reservas", List.of(obj(
                "id", 97040L, "salaId", 5004L, "turmaId", 6003L, "turno", "Noturno",
                "diasSemana", List.of("sab"),
                "dataInicio", LocalDate.now().plusDays(30).toString(),
                "dataFim", LocalDate.now().plusDays(35).toString(),
                "horaInicio", "08:00", "horaFim", "12:00",
                "instrutorId", 13L, "unidadeId", 1001L, "status", "ATIVA"))));
        ra.andExpect(status().isOk());

        Long oficial = idOficial(ra, "reservas", 97040L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM reservas WHERE id = ?", oficial)).isEqualTo(1);
    }

    @Test
    void reservaConflitoDeHorario() throws Exception {
        // Sala 5001/Matutino ja reservada pela seed 7001 (mesmo periodo e dias).
        admin(lote("criados", "reservas", List.of(obj(
                        "id", 97041L, "salaId", 5001L, "turmaId", 6001L, "turno", "Matutino",
                        "diasSemana", List.of("seg", "ter", "qua", "qui", "sex"),
                        "dataInicio", LocalDate.now().minusDays(10).toString(),
                        "dataFim", LocalDate.now().plusDays(10).toString(),
                        "instrutorId", 13L, "unidadeId", 1001L, "status", "ATIVA"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro")
                        .value("Ja existe reserva para esta sala, periodo e turno"));

        // Estado final: apenas a reserva original da seed continua na sala/turno.
        assertThat(contar("SELECT count(*) FROM reservas WHERE sala_id = 5001 "
                + "AND turno = 'Matutino' AND status = 'ATIVA'")).isEqualTo(1);
    }

    @Test
    void reservaSalaInexistente() throws Exception {
        admin(lote("criados", "reservas", List.of(obj(
                        "id", 97042L, "salaId", 999999L, "turno", "Matutino",
                        "diasSemana", List.of("seg"),
                        "dataInicio", LocalDate.now().plusDays(5).toString(),
                        "dataFim", LocalDate.now().plusDays(6).toString(),
                        "unidadeId", 1001L))))
                .andExpect(status().isNotFound());

        assertThat(contar("SELECT count(*) FROM reservas WHERE id > 7031")).isZero();
    }

    @Test
    void reservaUnidadeIncompativel() throws Exception {
        // Sala 5006 pertence a unidade 1002; payload afirma unidade 1001.
        admin(lote("criados", "reservas", List.of(obj(
                        "id", 97043L, "salaId", 5006L, "turno", "Matutino",
                        "diasSemana", List.of("seg"),
                        "dataInicio", LocalDate.now().plusDays(5).toString(),
                        "dataFim", LocalDate.now().plusDays(6).toString(),
                        "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("A sala nao pertence a unidade informada"));

        assertThat(contar("SELECT count(*) FROM reservas WHERE id > 7031")).isZero();
    }

    @Test
    void reservaStatusInvalido() throws Exception {
        admin(lote("criados", "reservas", List.of(obj(
                        "id", 97044L, "salaId", 5004L, "turno", "Noturno",
                        "diasSemana", List.of("sab"),
                        "dataInicio", LocalDate.now().plusDays(40).toString(),
                        "dataFim", LocalDate.now().plusDays(41).toString(),
                        "unidadeId", 1001L, "status", "EMPRESTADA"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("reservas.status"));

        assertThat(contar("SELECT count(*) FROM reservas WHERE id > 7031")).isZero();
    }

    // ==================================================================
    // GRUPO 5 — CHAVES
    // ==================================================================

    @Test
    void chaveCadastroValido() throws Exception {
        ResultActions ra = admin(lote("criados", "chaves", List.of(obj(
                "id", 97050L, "codigo", "CH-E2E-01", "salaId", 5001L,
                "andar", "1o Andar", "unidadeId", 1001L))));
        ra.andExpect(status().isOk());

        Long oficial = idOficial(ra, "chaves", 97050L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM chaves WHERE id = ?", oficial)).isEqualTo(1);
        String status = jdbc.queryForObject(
                "SELECT status FROM chaves WHERE id = ?", String.class, oficial);
        assertThat(status).isEqualTo("DISPONIVEL"); // padrao do modelo
    }

    @Test
    void chaveCodigoDuplicado() throws Exception {
        admin(lote("criados", "chaves", List.of(obj(
                        "id", 97051L, "codigo", "CH-011", "salaId", 5002L,
                        "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Ja existe uma chave com este codigo"));

        assertThat(contar("SELECT count(*) FROM chaves WHERE codigo = ?", "CH-011"))
                .isEqualTo(1); // apenas o seed 8001
    }

    @Test
    void chaveSalaInexistente() throws Exception {
        admin(lote("criados", "chaves", List.of(obj(
                        "id", 97052L, "codigo", "CH-E2E-02", "salaId", 999999L,
                        "unidadeId", 1001L))))
                .andExpect(status().isNotFound());

        assertThat(contar("SELECT count(*) FROM chaves WHERE codigo = ?", "CH-E2E-02")).isZero();
    }

    @Test
    void chaveUtilizacaoNaoAutorizada() throws Exception {
        // Perfil INSTRUTOR so pode sincronizar solicitacoes e notificacoes.
        sinc("INSTRUTOR", "katia.barros@senacdf.com",
                lote("criados", "chaves", List.of(obj(
                        "id", 97053L, "codigo", "CH-E2E-03", "salaId", 5001L,
                        "unidadeId", 1001L))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.erro")
                        .value("Perfil nao pode sincronizar a colecao chaves"));

        assertThat(contar("SELECT count(*) FROM chaves WHERE codigo = ?", "CH-E2E-03")).isZero();
    }

    // ==================================================================
    // GRUPO 6 — SOLICITACOES E NOTIFICACOES
    // ==================================================================

    @Test
    void solicitacaoCadastroValido() throws Exception {
        Map<String, Object> corpo = lote("criados", "solicitacoes", List.of(obj(
                "id", 97060L, "salaId", 5001L, "instrutorId", 13L, "unidadeId", 1001L,
                "data", LocalDate.now().plusDays(2).toString(),
                "criadaEm", java.time.Instant.now().toString(),
                "turnos", List.of("Matutino"), "motivo", "Aula extra de auditoria",
                "status", "pendente")));
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN"));
        var resp = mockMvc.perform(post("/api/sinc")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(corpo))).andReturn().getResponse();
        assertThat(resp.getStatus())
                .as("corpo resposta: %s", resp.getContentAsString())
                .isEqualTo(200);

        Long oficial = idOficialDoJson(resp.getContentAsString(), "solicitacoes", 97060L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM solicitacoes WHERE id = ?", oficial)).isEqualTo(1);
    }

    @Test
    void solicitacaoSalaInexistente() throws Exception {
        admin(lote("criados", "solicitacoes", List.of(obj(
                        "id", 97061L, "salaId", 999999L, "instrutorId", 13L,
                        "unidadeId", 1001L, "data", LocalDate.now().plusDays(2).toString(),
                        "turnos", List.of("Matutino"), "motivo", "Sala invalida"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Sala da solicitacao nao existe"));

        assertThat(contar("SELECT count(*) FROM solicitacoes WHERE id > 10004")).isZero();
    }

    @Test
    void solicitacaoTurmaInexistente() throws Exception {
        admin(lote("criados", "solicitacoes", List.of(obj(
                        "id", 97062L, "salaId", 5001L, "instrutorId", 13L,
                        "turmaId", 999999L, "unidadeId", 1001L,
                        "data", LocalDate.now().plusDays(2).toString(),
                        "turnos", List.of("Matutino"), "motivo", "Turma invalida"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Turma da solicitacao nao existe"));

        assertThat(contar("SELECT count(*) FROM solicitacoes WHERE id > 10004")).isZero();
    }

    @Test
    void solicitacaoInstrutorDeOutraUnidade() throws Exception {
        // instrutor 15 pertence a 1002; sala 5001 e unidade 1001.
        admin(lote("criados", "solicitacoes", List.of(obj(
                        "id", 97063L, "salaId", 5001L, "instrutorId", 15L,
                        "unidadeId", 1001L, "data", LocalDate.now().plusDays(2).toString(),
                        "turnos", List.of("Matutino"), "motivo", "Instrutor de outra unidade"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro")
                        .value("Solicitacao deve usar instrutor, sala e unidade compativeis"));

        assertThat(contar("SELECT count(*) FROM solicitacoes WHERE id > 10004")).isZero();
    }

    @Test
    void solicitacaoUnidadeInvalida() throws Exception {
        admin(lote("criados", "solicitacoes", List.of(obj(
                        "id", 97064L, "salaId", 5001L, "instrutorId", 13L,
                        "unidadeId", 999999L, "data", LocalDate.now().plusDays(2).toString(),
                        "turnos", List.of("Matutino"), "motivo", "Unidade invalida"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("Unidade da solicitacao nao existe"));

        assertThat(contar("SELECT count(*) FROM solicitacoes WHERE id > 10004")).isZero();
    }

    @Test
    void solicitacaoDataMalformada() throws Exception {
        admin(lote("criados", "solicitacoes", List.of(obj(
                        "id", 97065L, "salaId", 5001L, "instrutorId", 13L,
                        "unidadeId", 1001L, "data", "02/31/2026",
                        "turnos", List.of("Matutino"), "motivo", "Data invalida"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campo").value("solicitacoes.data"));

        assertThat(contar("SELECT count(*) FROM solicitacoes WHERE id > 10004")).isZero();
    }

    /**
     * ACHADO ETAPA-3-1 (documentado): payload de solicitacao SEM {@code criadaEm}
     * viola a coluna NOT NULL {@code criada_em} e o handler devolve 409 generico
     * "Conflito de integridade de dados" — sem campo e sem dizer qual dado falta.
     * O frontend real envia {@code criadaEm} (web/src/core/storage.ts:851), entao o
     * fluxo de producao nao cai aqui, mas um cliente API que omita o campo leva
     * 409 generico em vez de 400 com o campo indicado.
     */
    @Test
    void solicitacaoSemCriadaEmRecebeCriadaEmDoServidor() throws Exception {
        ResultActions resposta = admin(lote("criados", "solicitacoes", List.of(obj(
                        "id", 97066L, "salaId", 5001L, "instrutorId", 13L,
                        "unidadeId", 1001L, "data", LocalDate.now().plusDays(2).toString(),
                        "turnos", List.of("Matutino"), "motivo", "Sem criadaEm"))))
                .andExpect(status().isOk());

        Long oficial = idOficial(resposta, "solicitacoes", 97066L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM solicitacoes WHERE id = ? AND criada_em IS NOT NULL", oficial))
                .isEqualTo(1);
    }

    @Test
    void notificacaoCadastroValido() throws Exception {
        ResultActions ra = admin(lote("criados", "notificacoes", List.of(obj(
                "id", 97070L, "tipo", "info", "titulo", "Notificacao Auditoria",
                "msg", "Criada pelo teste da Etapa 3", "paraPerfil", "instrutor",
                "paraId", 13L, "unidadeId", 1001L, "lida", false))));
        ra.andExpect(status().isOk());

        Long oficial = idOficial(ra, "notificacoes", 97070L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM notificacoes WHERE id = ?", oficial)).isEqualTo(1);
    }

    @Test
    void notificacaoDestinatarioDeOutraUnidade() throws Exception {
        // destinatario 15 pertence a unidade 1002; notificacao declara 1001.
        admin(lote("criados", "notificacoes", List.of(obj(
                        "id", 97071L, "tipo", "aviso", "titulo", "Notificacao Cruzada",
                        "msg", "Destinatario de outra unidade", "paraPerfil", "instrutor",
                        "paraId", 15L, "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro")
                        .value("Notificacao e usuario destinatario devem pertencer a mesma unidade"));

        assertThat(contar("SELECT count(*) FROM notificacoes WHERE id > 9004")).isZero();
    }

    // ==================================================================
    // GRUPO 7 — SEGURANCA E AUTORIZACAO
    // ==================================================================

    @Test
    void segurancaRemoverRegistroDeOutraUnidade() throws Exception {
        // Recepcao da unidade 1001 tentando remover a chave 8003 (unidade 1002).
        sinc("RECEPCAO", "recep.asanorte@senacdf.com",
                lote("remocoes", "chaves", List.of(obj("id", 8003L)))
                        .isEmpty() ? Map.of() : corpoRemocao("chaves", 8003L))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.erro")
                        .value("Usuario nao pode remover registro de outra unidade"));

        assertThat(contar("SELECT count(*) FROM chaves WHERE id = ?", 8003L)).isEqualTo(1);
    }

    @Test
    void segurancaSincronizarSemPerfilValido() throws Exception {
        sinc(null, "anonimo@senac.test",
                lote("criados", "notificacoes", List.of(obj(
                        "id", 97080L, "tipo", "info", "titulo", "Sem perfil",
                        "msg", "sem autoridade", "unidadeId", 1001L))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.erro")
                        .value("Perfil nao autorizado para sincronizacao"));

        assertThat(contar("SELECT count(*) FROM notificacoes WHERE id > 9004")).isZero();
    }

    @Test
    void segurancaColecaoNaoAutorizadaParaOPerfil() throws Exception {
        // Recepcao so pode chaves e notificacoes.
        sinc("RECEPCAO", "recep.asanorte@senacdf.com",
                lote("criados", "turmas", List.of(obj(
                        "id", 97081L, "nome", "Turma Hackeada", "codigo", "PG-E2E-HACK",
                        "curso", "Auditoria", "turno", "Matutino",
                        "dataInicio", LocalDate.now().plusDays(1).toString(),
                        "dataFim", LocalDate.now().plusDays(2).toString(),
                        "unidadeId", 1001L))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.erro")
                        .value("Perfil nao pode sincronizar a colecao turmas"));

        assertThat(contar("SELECT count(*) FROM turmas WHERE codigo = ?", "PG-E2E-HACK")).isZero();
    }

    @Test
    void segurancaColecaoDesconhecidaNoPayload() throws Exception {
        sinc("RECEPCAO", "recep.asanorte@senacdf.com",
                lote("criados", "hackeres", List.of(obj("id", 97082L))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.erro")
                        .value("Perfil nao autorizado para sincronizacao"));
    }

    @Test
    void segurancaContornarValidacoesAlterandoIdsNoPayload() throws Exception {
        // Recepcao 1001 edita a propria chave 8001 trocando salaId para a sala 5006
        // (unidade 1002): a validacao de servidor deve recusar e nada muda no banco.
        sinc("RECEPCAO", "recep.asanorte@senacdf.com",
                lote("alteracoes", "chaves", List.of(obj(
                        "id", 8001L, "codigo", "CH-011", "salaId", 5006L,
                        "andar", "1o Andar", "unidadeId", 1001L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("A sala nao pertence a unidade informada"));

        Long salaAtual = jdbc.queryForObject(
                "SELECT sala_id FROM chaves WHERE id = ?", Long.class, 8001L);
        assertThat(salaAtual).isEqualTo(5001L); // inalterado
        assertThat(contar("SELECT count(*) FROM chaves WHERE id = ?", 8001L)).isEqualTo(1);
    }

    @Test
    void criacaoComIdProvisorioColidenteNaoSobrescreveChaveDeOutraUnidade() throws Exception {
        String codigoOriginal = jdbc.queryForObject(
                "SELECT codigo FROM chaves WHERE id = ?", String.class, 8003L);

        ResultActions resposta = sinc("RECEPCAO", "recep.asanorte@senacdf.com",
                lote("criados", "chaves", List.of(obj(
                        "id", 8003L, "codigo", "CH-PROVISORIO-COLISAO",
                        "salaId", 5001L, "andar", "1o Andar", "status", "disponivel",
                        "unidadeId", 1001L))));

        resposta.andExpect(status().isOk());
        Long oficial = idOficial(resposta, "chaves", 8003L);
        assertThat(oficial).isNotNull().isNotEqualTo(8003L);
        assertThat(jdbc.queryForObject("SELECT codigo FROM chaves WHERE id = ?", String.class, 8003L))
                .isEqualTo(codigoOriginal);
        assertThat(contar("SELECT count(*) FROM chaves WHERE codigo = ?", "CH-PROVISORIO-COLISAO"))
                .isEqualTo(1);
    }

    @Test
    void atualizacaoDeChaveDaMesmaUnidadeCarregaRegistroPersistido() throws Exception {
        sinc("RECEPCAO", "recep.asanorte@senacdf.com",
                lote("alteracoes", "chaves", List.of(obj(
                        "id", 8001L, "codigo", "CH-ATUALIZADA-PG", "salaId", 5001L,
                        "andar", "1o Andar", "status", "disponivel", "unidadeId", 1001L))))
                .andExpect(status().isOk());

        assertThat(jdbc.queryForObject("SELECT codigo FROM chaves WHERE id = ?", String.class, 8001L))
                .isEqualTo("CH-ATUALIZADA-PG");
    }

    @Test
    void atualizacaoDeChaveDeOutraUnidadeERejeitadaPelaUnidadeReal() throws Exception {
        sinc("RECEPCAO", "recep.asanorte@senacdf.com",
                lote("alteracoes", "chaves", List.of(obj(
                        "id", 8003L, "codigo", "CH-NAO-AUTORIZADA", "salaId", 5001L,
                        "andar", "1o Andar", "status", "disponivel", "unidadeId", 1001L))))
                .andExpect(status().isForbidden());

        assertThat(jdbc.queryForObject("SELECT codigo FROM chaves WHERE id = ?", String.class, 8003L))
                .isNotEqualTo("CH-NAO-AUTORIZADA");
    }

    @Test
    void alteracaoDeIdInexistenteNaoViraCriacao() throws Exception {
        sinc("ADMIN", "Senac_GDF@Hotmail.com",
                lote("alteracoes", "chaves", List.of(obj(
                        "id", 98999L, "codigo", "CH-ID-INEXISTENTE", "salaId", 5001L,
                        "andar", "1o Andar", "status", "disponivel", "unidadeId", 1001L))))
                .andExpect(status().isNotFound());

        assertThat(contar("SELECT count(*) FROM chaves WHERE codigo = ?", "CH-ID-INEXISTENTE"))
                .isZero();
    }

    @Test
    void solicitacaoSemCriadaEmRecebeTimestampDoServidor() throws Exception {
        ResultActions resposta = sinc("INSTRUTOR", "katia.barros@senacdf.com",
                lote("criados", "solicitacoes", List.of(obj(
                        "id", 98001L, "salaId", 5001L, "instrutorId", 13L,
                        "turmaId", 6001L, "unidadeId", 1001L,
                        "data", LocalDate.now().plusDays(10).toString(),
                        "turnos", List.of("Matutino"), "modo", "periodo",
                        "motivo", "Teste sem timestamp"))));

        resposta.andExpect(status().isOk());
        Long oficial = idOficial(resposta, "solicitacoes", 98001L);
        assertThat(oficial).isNotNull();
        assertThat(contar("SELECT count(*) FROM solicitacoes WHERE id = ? AND criada_em IS NOT NULL", oficial))
                .isEqualTo(1);
    }

    @Test
    void reenvioDaMesmaOperacaoNaoDuplicaCriacao() throws Exception {
        Map<String, Object> corpo = lote("criados", "chaves", List.of(obj(
                "id", 98002L, "codigo", "CH-OPERACAO-IDEMPOTENTE", "salaId", 5001L,
                "andar", "1o Andar", "status", "disponivel", "unidadeId", 1001L)));
        corpo.put("operacaoId", "audit-op-chave-98002");

        ResultActions primeira = admin(corpo).andExpect(status().isOk());
        ResultActions segunda = admin(corpo).andExpect(status().isOk());

        assertThat(idOficial(primeira, "chaves", 98002L))
                .isEqualTo(idOficial(segunda, "chaves", 98002L));
        assertThat(contar("SELECT count(*) FROM chaves WHERE codigo = ?", "CH-OPERACAO-IDEMPOTENTE"))
                .isEqualTo(1);
    }

    /** Corpo de remocao: {"remocoes": {"<colecao>": [id]}}. */
    private Map<String, Object> corpoRemocao(String colecao, long id) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("remocoes", new LinkedHashMap<>(Map.of(colecao, List.of(id))));
        return corpo;
    }
}
