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
        return usuarios.findByEmailIgnoreCase(auth.getName());
    }
}
