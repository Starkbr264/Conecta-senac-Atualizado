package conecta.demo.service;

import conecta.demo.dto.LoginRequest;
import conecta.demo.dto.UsuarioResponse;
import conecta.demo.model.Sessao;
import conecta.demo.repository.SessaoRepository;
import conecta.demo.security.JwtService;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Autenticacao e sessao.
 *
 * <p>Extraido de {@code AuthController} (que so montava o envelope de resposta)
 * e dos helpers {@code sessaoJson}/{@code setSessao} que estavam dentro de
 * {@code SincController}. Nenhum endpoint, verbo ou corpo de resposta mudou:
 * {@code POST /api/login} continua devolvendo {@code {"usuario": ...}} e
 * {@code GET/POST /api/sessao} e {@code POST /api/logout} continuam os mesmos.
 */
@Service
public class AuthService {

    /** A sessao e global e unica: a tabela {@code sessao} tem sempre a linha {@code id = 1}. */
    private static final Long ID_SESSAO_UNICA = 1L;

    private final UsuarioService usuarios;
    private final SessaoRepository sessoes;
    private final JwtService jwt;

    public AuthService(UsuarioService usuarios, SessaoRepository sessoes, JwtService jwt) {
        this.usuarios = usuarios;
        this.sessoes = sessoes;
        this.jwt = jwt;
    }

    /**
     * Autentica por e-mail e senha.
     *
     * @throws conecta.demo.exception.RegraDeNegocioException quando o par nao
     *         existe; o {@code ApiExceptionHandler} traduz para HTTP 409.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> login(LoginRequest request) {
        UsuarioResponse user = usuarios.login(request);
        String token = jwt.gerar(user.email(), user.perfil());
        return Map.of("usuario", user, "token", token);
    }

    /**
     * @return o JSON da sessao ativa, ou {@code null} quando ninguem esta logado.
     */
    public Object sessaoAtual() {
        return sessoes.findById(ID_SESSAO_UNICA).map(Sessao::getUsuarioJson).orElse(null);
    }

    /**
     * Grava (ou apaga, quando {@code usuarioJson} e {@code null}) a sessao global.
     */
    public void salvarSessao(String usuarioJson) {
        Sessao s = sessoes.findById(ID_SESSAO_UNICA).orElseGet(Sessao::new);
        s.setId(ID_SESSAO_UNICA);
        s.setUsuarioJson(usuarioJson);
        sessoes.save(s);
    }

    /** Encerra a sessao. */
    public void logout() {
        salvarSessao(null);
    }
}