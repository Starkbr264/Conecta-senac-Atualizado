package conecta.demo.controller;

import conecta.demo.service.DadosService;
import conecta.demo.service.UsuarioAtual;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 *Snapshot completo do banco para os frontends.
 *
 * <p>Mesmas 8 chaves e mesmo endpoint do original ({@code GET /api/dados}).
 * A montagem foi movida para {@link DadosService}, que tambem e usada por
 * {@code SincService}.
 */
@RestController
@RequestMapping("/api")
public class DadosController {

    private final DadosService dados;
    private final UsuarioAtual usuarioAtual;

    public DadosController(DadosService dados, UsuarioAtual usuarioAtual) {
        this.dados = dados;
        this.usuarioAtual = usuarioAtual;
    }

    @GetMapping("/dados")
    public Map<String, Object> dados() {
        return usuarioAtual.buscar().map(dados::banco).orElseGet(dados::banco);
    }
}
