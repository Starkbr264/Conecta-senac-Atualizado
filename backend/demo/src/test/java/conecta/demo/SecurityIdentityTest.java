package conecta.demo;

import conecta.demo.model.SincOperacao;
import conecta.demo.security.JwtService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class SecurityIdentityTest {
    @Test
    void tokenCarriesImmutableUserId() {
        JwtService jwt = new JwtService("12345678901234567890123456789012", 60_000);
        String token = jwt.gerar(42L, "a@edu.df.senac.br", "coordenador");

        assertEquals(42L, jwt.userId(token));
        assertEquals("a@edu.df.senac.br", jwt.email(token));
    }

    @Test
    void tokenWithoutUidIsNotAnIdentity() {
        JwtService jwt = new JwtService("12345678901234567890123456789012", 60_000);
        Date agora = new Date();
        String token = Jwts.builder()
                .subject("legacy@edu.df.senac.br")
                .claim("perfil", "coordenador")
                .issuedAt(agora)
                .expiration(new Date(agora.getTime() + 60_000))
                .signWith(Keys.hmacShaKeyFor(
                        "12345678901234567890123456789012".getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertNull(jwt.userId(token));
    }

    @Test
    void tokenWithInvalidUidIsNotAcceptedAsAValidUserId() {
        JwtService jwt = new JwtService("12345678901234567890123456789012", 60_000);
        String token = jwt.gerar(-1L, "invalid@edu.df.senac.br", "coordenador");

        org.junit.jupiter.api.Assertions.assertThrows(
                IllegalArgumentException.class,
                () -> jwt.exigirUserId(token));
    }

    @Test
    void legacyOperationHasNoOwnerAndCannotBeTreatedAsReplayable() {
        SincOperacao legado = new SincOperacao("legacy", "{}");

        assertNull(legado.getUsuarioId());
    }

    @Test
    void operationStoresOwnerForIdempotentReplay() {
        SincOperacao operation = new SincOperacao("op-1", 42L, "{}");

        assertEquals(42L, operation.getUsuarioId());
    }
}
