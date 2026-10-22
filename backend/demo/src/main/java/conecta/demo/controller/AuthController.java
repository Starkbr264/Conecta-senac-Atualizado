package conecta.demo.controller;

import conecta.demo.dto.LoginRequest;
import conecta.demo.service.AuthService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;

/**
 * Autenticacao.
 *
 * <p>A logica vive em {@link AuthService}; aqui fica apenas o contrato HTTP.
 * O envelope {@code {"usuario": ...}} e o status 200 sao os mesmos de antes.
 */
@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(auth.login(request));
    }
}