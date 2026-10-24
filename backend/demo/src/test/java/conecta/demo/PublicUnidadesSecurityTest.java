package conecta.demo;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "JWT_SECRET=teste-seguro-com-pelo-menos-32-caracteres-123456",
        "spring.datasource.url=jdbc:h2:mem:public-unidades;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("integration")
class PublicUnidadesSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void unidadesPodemSerConsultadasSemTokenMasDadosContinuamProtegidos() throws Exception {
        mockMvc.perform(get("/api/unidades"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/dados"))
                .andExpect(status().isUnauthorized());
    }
}
