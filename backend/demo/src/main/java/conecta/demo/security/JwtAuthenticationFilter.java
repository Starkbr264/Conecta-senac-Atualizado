package conecta.demo.security;

import conecta.demo.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Filtro que extrai o JWT do header {@code Authorization: Bearer <token>}
 * e popula o {@link SecurityContextHolder} com a autenticacao do usuario.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final UsuarioRepository usuarios;

    public JwtAuthenticationFilter(JwtService jwt, UsuarioRepository usuarios) {
        this.jwt = jwt;
        this.usuarios = usuarios;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                String email = jwt.email(token);
                String perfil = jwt.perfil(token);
                Long userId = jwt.exigirUserId(token);
                if (!usuarios.existsById(userId)) throw new IllegalArgumentException("Usuario JWT inexistente");
                var authorities = java.util.List.of(new SimpleGrantedAuthority("ROLE_" + perfil.toUpperCase()));
                var auth = new UsernamePasswordAuthenticationToken(email, null, authorities);
                if (userId != null) auth.setDetails(java.util.Map.of("userId", userId));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                // Token invalido ou expirado — segue sem autenticacao (401 sera retornado pelo SecurityFilterChain)
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }
}
