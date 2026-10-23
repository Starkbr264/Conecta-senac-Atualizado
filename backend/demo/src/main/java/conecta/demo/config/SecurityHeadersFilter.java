package conecta.demo.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Adiciona cabeçalhos de segurança HTTP em todas as respostas.
 *
 * <p>Antes não havia nenhum (HSTS, CSP, X-Frame-Options, etc.), o que
 * permitia clickjacking, sniffing de MIME e downgrade para HTTP.
 */
@Component
@Order(1)
public class SecurityHeadersFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (response instanceof HttpServletResponse http) {
            http.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            http.setHeader("X-Frame-Options", "DENY");
            http.setHeader("X-Content-Type-Options", "nosniff");
            http.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
            http.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
            // CSP permissiva o suficiente para a SPA (scripts inline do Vite + CSS).
            // As origens do Google Fonts foram incluidas porque `variables.css`
            // importa Outfit/DM Mono via @import de fonts.googleapis.com; sem
            // elas o navegador bloqueava a folha no deploy do Render (mesma
            // origem do filtro). Nenhum outro host e permitido.
            http.setHeader("Content-Security-Policy",
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline'; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                    "img-src 'self' data:; " +
                    "font-src 'self' data: https://fonts.gstatic.com; " +
                    "connect-src 'self' https://conecta-senac-test.onrender.com");
        }
        chain.doFilter(request, response);
    }
}
