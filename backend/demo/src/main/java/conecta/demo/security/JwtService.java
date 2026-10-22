package conecta.demo.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Servico de tokens JWT.
 *
 * <p>Assina tokens HS256 com a chave {@code JWT_SECRET} (definida via
 * variavel de ambiente). O token carrega o {@code email} e o {@code perfil}
 * do usuario e expira em {@code JWT_EXPIRATION_MS} milissegundos.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            @Value("${JWT_SECRET:}") String secret,
            @Value("${JWT_EXPIRATION_MS:86400000}") long expirationMs) {
        if (secret == null || secret.isBlank() || secret.length() < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET deve ter pelo menos 32 caracteres. Defina a variavel de ambiente JWT_SECRET.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    /** Gera um token JWT para o usuario informado. */
    public String gerar(String email, String perfil) {
        Date agora = new Date();
        Date expiracao = new Date(agora.getTime() + expirationMs);
        return Jwts.builder()
                .subject(email)
                .claim("perfil", perfil)
                .issuedAt(agora)
                .expiration(expiracao)
                .signWith(key)
                .compact();
    }

    /** Valida o token e retorna as claims. Lanca excecao se invalido/expirado. */
    public Claims validar(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /** Extrai o email (subject) do token. */
    public String email(String token) {
        return validar(token).getSubject();
    }

    /** Extrai o perfil do token. */
    public String perfil(String token) {
        return validar(token).get("perfil", String.class);
    }
}
