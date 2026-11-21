package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;

/** Garante que a aplicação JWT não crie o fallback in-memory do Spring Boot. */
@SpringBootTest(properties = {
        "JWT_SECRET=teste-seguro-com-pelo-menos-32-caracteres-123456",
        "spring.datasource.url=jdbc:h2:mem:security-auto-config;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("integration")
class SecurityAutoConfigurationTest {

    @Autowired
    private org.springframework.context.ApplicationContext applicationContext;

    @Test
    void naoCriaUserDetailsServiceInMemoryAutomatico() {
        assertThat(applicationContext.getBeansOfType(UserDetailsService.class))
                .as("a autenticação da aplicação é feita exclusivamente por JWT")
                .isEmpty();
    }
}
