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

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // allowedOriginPatterns permite curinga no meio do host — necessario
        // porque os deploys de preview do Vercel recebem URLs dinamicas
        // (conecta-senac-test-yw11-<hash>-stark-0f9a.vercel.app).
        registry.addMapping("/api/**")
                .allowedOriginPatterns(
                        "https://conecta-senac-test-yw11*.vercel.app",
                        "http://localhost:*",
                        "http://127.0.0.1:*"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false);
    }
}