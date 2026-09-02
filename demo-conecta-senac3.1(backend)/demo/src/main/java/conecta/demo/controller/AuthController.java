package conecta.demo.controller;

import conecta.demo.dto.LoginRequest;
import conecta.demo.dto.UsuarioResponse;
import conecta.demo.service.UsuarioService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final UsuarioService usuarios;

    public AuthController(UsuarioService usuarios) {
        this.usuarios = usuarios;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, UsuarioResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(Map.of("usuario", usuarios.login(request)));
    }

}
