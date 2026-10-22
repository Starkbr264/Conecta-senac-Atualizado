package conecta.demo.config;

import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuracao web unica.
 *
 * <p>Origens permitidas: apenas a Vercel (producao) e localhost (dev).
 * Antes era {@code *} — qualquer site podia chamar a API do navegador de um
 * visitante (CSRF via fetch). Ver docs/ARQUITETURA_ATUALIZADA.md §7.
 *
 * <p>Nenhum handler de recursos estaticos e registrado: vale o comportamento
 * padrao do Spring Boot ({@code classpath:/static/}), que e o que permite ao
 * {@code Dockerfile} injetar o frontend compilado em
 * {@code BOOT-INF/classes/static/} sem tocar no backend.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private static final List<String> ORIGENS_PERMITIDAS = List.of(
            "https://conecta-senac-test-yw11.vercel.app",
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000"
    );

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(ORIGENS_PERMITIDAS.toArray(new String[0]))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false);
    }
}