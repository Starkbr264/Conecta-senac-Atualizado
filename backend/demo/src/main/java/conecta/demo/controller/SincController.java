package conecta.demo.controller;

import conecta.demo.service.AuthService;
import conecta.demo.service.SincService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sincronizacao e sessao.
 *
 * <p>Os 381 linhas de logica foram movidas para {@link SincService} e
 * {@link AuthService}. Os cinco endpoints abaixo mantem verbo, caminho, parametro
 * e corpo de resposta exatamente como eram.
 *
 * <p>{@code @Transactional} saiu daqui e foi para os metodos do service — o
 * limite transacional nao muda, porque o service e injetado pelo proxy do
 * Spring.
 */
@RestController
@RequestMapping("/api")
public class SincController {

    private final SincService sinc;
    private final AuthService auth;

    public SincController(SincService sinc, AuthService auth) {
        this.sinc = sinc;
        this.auth = auth;
    }

    @PostMapping("/sinc")
    public Map<String, Object> sinc(@RequestBody(required = false) Map<String, Object> corpo) {
        return sinc.sincronizar(corpo);
    }

    @PostMapping("/reset")
    public Map<String, Object> reset() {
        return sinc.resetar();
    }

    @GetMapping("/sessao")
    public ResponseEntity<?> sessao() {
        return ResponseEntity.ok(auth.sessaoAtual());
    }

    @PostMapping("/sessao")
    public Map<String, Object> gravarSessao(@RequestBody(required = false) Map<String, Object> corpo) {
        Object valor = corpo == null ? null : corpo.get("sessao");
        auth.salvarSessao(valor == null ? null : valor.toString());
        return Map.of("ok", true);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout() {
        auth.logout();
        return Map.of("ok", true);
    }
}