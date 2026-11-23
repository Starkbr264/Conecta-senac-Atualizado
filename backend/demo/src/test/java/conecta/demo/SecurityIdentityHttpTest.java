package conecta.demo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import conecta.demo.model.SincOperacao;
import conecta.demo.repository.SincOperacaoRepository;
import conecta.demo.security.JwtService;
import conecta.demo.service.SeedService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "JWT_SECRET=teste-seguro-com-pelo-menos-32-caracteres-123456",
        "spring.datasource.url=jdbc:h2:mem:security-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("integration")
class SecurityIdentityHttpTest {
    private static final String SECRET = "teste-seguro-com-pelo-menos-32-caracteres-123456";

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtService jwt;
    @Autowired private SeedService seed;
    @Autowired private SincOperacaoRepository operacoes;

    @BeforeEach
    void semear() {
        seed.semear();
    }

    @Test
    void tokenAntigoSemUidRecebe401ESemEfeito() throws Exception {
        String token = tokenSemUid();

        mockMvc.perform(post("/api/sinc")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operacaoId\":\"http-sem-uid\",\"criados\":{\"unidades\":["
                                + "{\"id\":97101,\"nome\":\"Nao Deve Criar\",\"cep\":\"70000-001\","
                                + "\"cidade\":\"Brasilia\",\"endereco\":\"SCS Q.1\"}]}}"))
                .andExpect(status().isUnauthorized());

        assertTrue(operacoes.findById("http-sem-uid").isEmpty());
    }

    @Test
    void usuarioBNaoPodeOperarComUserIdDeA() throws Exception {
        String tokenB = jwt.gerar(2L, "coord.asanorte@senacdf.com", "COORDENADOR");

        mockMvc.perform(post("/api/sinc")
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operacaoId\":\"http-b-versus-a\",\"userId\":1,"
                                + "\"criados\":{\"unidades\":[{\"id\":97102,\"nome\":\"Nao Deve Criar\","
                                + "\"cep\":\"70000-002\",\"cidade\":\"Brasilia\","
                                + "\"endereco\":\"SCS Q.2\"}]}}"))
                .andExpect(status().isForbidden());

        assertTrue(operacoes.findById("http-b-versus-a").isEmpty());
    }

    @Test
    void usuarioLegitimoRecebeSucessoEOperacaoFicaComSeuOwner() throws Exception {
        String tokenA = jwt.gerar(1L, "Senac_GDF@Hotmail.com", "ADMIN");

        mockMvc.perform(post("/api/sinc")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operacaoId\":\"http-legitimo\",\"userId\":1}"))
                .andExpect(status().isOk());

        SincOperacao salvo = operacoes.findById("http-legitimo").orElseThrow();
        assertEquals(1L, salvo.getUsuarioId());
    }

    @Test
    void headerXUsuarioIdNaoEscalaAIdentidadeDaSala() throws Exception {
        String tokenA = jwt.gerar(2L, "coord.asanorte@senacdf.com", "COORDENADOR");

        mockMvc.perform(put("/api/salas/5006")
                        .header("Authorization", "Bearer " + tokenA)
                        .header("X-Usuario-Id", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Tentativa indevida\",\"tipo\":\"Sala Comum\","
                                + "\"capacidade\":30,\"andar\":\"Terreo\",\"bloco\":\"A\","
                                + "\"unidadeId\":1002}"))
                .andExpect(status().isForbidden());
    }

    private String tokenSemUid() {
        Date agora = new Date();
        return Jwts.builder()
                .subject("Senac_GDF@Hotmail.com")
                .claim("perfil", "ADMIN")
                .issuedAt(agora)
                .expiration(new Date(agora.getTime() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }
}
