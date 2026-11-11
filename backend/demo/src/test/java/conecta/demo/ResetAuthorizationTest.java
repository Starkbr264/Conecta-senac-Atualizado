package conecta.demo;

import conecta.demo.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Autorizacao de POST /api/reset com a cadeia real do Spring Security
 * (perfil "integration": SecurityConfig + JwtAuthenticationFilter ativos,
 * sem TestSecurityConfig).
 *
 * <p>Requisitos verificados:</p>
 * <ul>
 *   <li>sem token -> 401;</li>
 *   <li>token COORDENADOR/INSTRUTOR/RECEPCAO -> 403;</li>
 *   <li>token ADMIN -> comportamento autorizado (200 + ok), somente em
 *       banco H2 isolado desta classe (nunca em producao).</li>
 * </ul>
 *
 * <p>O banco H2 {@code reset-authz} e exclusivo desta classe de teste:
 * o reset executado no caso ADMIN apaga e resemeia apenas essa memoria.</p>
 */
@SpringBootTest(properties = {
        "JWT_SECRET=teste-seguro-com-pelo-menos-32-caracteres-123456",
        "spring.datasource.url=jdbc:h2:mem:reset-authz;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("integration")
class ResetAuthorizationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwt;

    @Test
    @DisplayName("POST /api/reset sem token responde 401")
    void resetSemTokenResponde401() throws Exception {
        mockMvc.perform(post("/api/reset"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/reset com token COORDENADOR responde 403")
    void resetCoordenadorResponde403() throws Exception {
        String token = jwt.gerar("coord@edu.df.senac.br", "COORDENADOR");
        mockMvc.perform(post("/api/reset").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/reset com token INSTRUTOR responde 403")
    void resetInstrutorResponde403() throws Exception {
        String token = jwt.gerar("inst@edu.df.senac.br", "INSTRUTOR");
        mockMvc.perform(post("/api/reset").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/reset com token RECEPCAO responde 403")
    void resetRecepcaoResponde403() throws Exception {
        String token = jwt.gerar("recep@edu.df.senac.br", "RECEPCAO");
        mockMvc.perform(post("/api/reset").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/reset com token ADMIN executa o reset (H2 isolado)")
    void resetAdminExecutaComportamentoAutorizado() throws Exception {
        String token = jwt.gerar("admin@edu.df.senac.br", "ADMIN");
        mockMvc.perform(post("/api/reset").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true));
    }

    @Test
    @DisplayName("GET /health continua publico (nao regredido pelo ajuste)")
    void healthContinuaPublico() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
