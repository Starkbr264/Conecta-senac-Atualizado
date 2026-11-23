package conecta.demo.service;

import conecta.demo.model.Usuario;
import conecta.demo.repository.UsuarioRepository;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** Resolve o usuario real a partir do e-mail autenticado pelo JWT. */
@Component
public class UsuarioAtual {
    private final UsuarioRepository usuarios;

    public UsuarioAtual(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    public Optional<Usuario> buscar() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName()))
            return Optional.empty();
        if (auth.getDetails() instanceof java.util.Map<?, ?> details
                && details.get("userId") instanceof Number id) {
            return usuarios.findById(id.longValue());
        }
        // O e-mail e um atributo mutavel e nao pode funcionar como fallback de
        // identidade. Tokens sem uid sao rejeitados pelo filtro JWT.
        return Optional.empty();
    }
}
