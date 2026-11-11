package conecta.demo;

import conecta.demo.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Health check publico do Render (secao 10 da limpeza tecnica).
 *
 * <p>GET /health deve responder 200 sem token (permitAll) com resposta
 * minima e previsivel. /api/dados continua protegido: 401 sem token e
 * comportamento normal com token valido.</p>
 */
@SpringBootTest(properties = {
        "JWT_SECRET=teste-seguro-com-pelo-menos-32-caracteres-123456",
        "spring.datasource.url=jdbc:h2:mem:health-check;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("integration")
class HealthSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwt;

    @Test
    @DisplayName("GET /health sem token responde 200 com status UP")
    void healthPublicoResponde200SemToken() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("GET /api/dados sem token responde 401")
    void dadosSemTokenResponde401() throws Exception {
        mockMvc.perform(get("/api/dados"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/dados com token valido responde 200")
    void dadosComTokenResponde200() throws Exception {
        String token = jwt.gerar("health@edu.df.senac.br", "ADMIN");
        mockMvc.perform(get("/api/dados").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }
}
