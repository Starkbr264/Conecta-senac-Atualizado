package conecta.demo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuracao web unica.
 *
 * <p>Consolida o que estava duplicado em {@code CorsConfig.java} e
 * {@code WebConfig.java}. As duas classes registravam a <b>mesma</b> mapping
 * {@code /api/**}; como o {@code WebMvcConfigurerComposite} aplica todos os
 * configuradores em sequencia, a segunda sobrescrevia a primeira e o
 * comportamento efetivo era o deste arquivo. Aqui fica a unica versao
 * declarativa, com a mesma configuracao efetiva:
 *
 * <ul>
 *   <li>origens: {@code *}</li>
 *   <li>metodos: GET, POST, PUT, DELETE, OPTIONS</li>
 *   <li>cabecalhos: {@code *}</li>
 * </ul>
 *
 * <p>Nenhum handler de recursos estaticos e registrado: vale o comportamento
 * padrao do Spring Boot ({@code classpath:/static/}), que e o que permite ao
 * {@code Dockerfile} injetar o frontend compilado em
 * {@code BOOT-INF/classes/static/} sem tocar no backend.
 *
 * <p>Ver {@code docs/ARQUITETURA_ATUALIZADA.md} para o risco de seguranca
 * dessa politica.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}