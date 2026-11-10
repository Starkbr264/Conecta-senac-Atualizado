package conecta.demo.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Health check publico para o Render (secao 10 da limpeza tecnica).
 *
 * <p>O Render usava {@code /api/dados} como healthCheckPath, mas {@code /api/**}
 * exige autenticacao (401), o que fazia o health check falhar. Este endpoint
 * e publico (permitAll no SecurityConfig), responde 200 quando a aplicacao
 * esta operacional e devolve apenas {@code {"status":"UP"}} — sem credenciais,
 * sem detalhes de conexao e sem dados de usuarios.</p>
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
