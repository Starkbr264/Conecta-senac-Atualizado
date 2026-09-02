package conecta.demo.controller;

import conecta.demo.repository.*;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DadosController {

    private final UsuarioRepository usuarios;
    private final UnidadeRepository unidades;
    private final SalaRepository salas;
    private final TurmaRepository turmas;
    private final ReservaRepository reservas;
    private final ChaveRepository chaves;
    private final NotificacaoRepository notificacoes;
    private final SolicitacaoRepository solicitacoes;

    public DadosController(UsuarioRepository usuarios, UnidadeRepository unidades, SalaRepository salas, TurmaRepository turmas, ReservaRepository reservas, ChaveRepository chaves, NotificacaoRepository notificacoes, SolicitacaoRepository solicitacoes) {
        this.usuarios = usuarios;
        this.unidades = unidades;
        this.salas = salas;
        this.turmas = turmas;
        this.reservas = reservas;
        this.chaves = chaves;
        this.notificacoes = notificacoes;
        this.solicitacoes = solicitacoes;
    }

    @GetMapping("/dados")
    public Map<String, Object> dados() {
        return Map.of(
                "usuarios", usuarios.findAll(),
                "unidades", unidades.findAll(),
                "salas", salas.findAll(),
                "turmas", turmas.findAll(),
                "reservas", reservas.findAll(),
                "chaves", chaves.findAll(),
                "notificacoes", notificacoes.findAll(),
                "solicitacoes", solicitacoes.findAll()
        );
    }

}
