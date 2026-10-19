package conecta.demo.controller;

import conecta.demo.model.Notificacao;
import conecta.demo.service.NotificacaoService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Notificacoes.
 *
 * <p>A logica (filtro por destinatario e marcacao como lida) foi movida para
 * {@link NotificacaoService}. Endpoints, verbos e respostas permanecem
 * identicos; {@code RecursoNaoEncontradoException} continua sendo traduzida em
 * 404 pelo {@code ApiExceptionHandler}.
 */
@RestController
@RequestMapping("/api/notificacoes")
public class NotificacaoController {

    private final NotificacaoService notificacoes;

    public NotificacaoController(NotificacaoService notificacoes) {
        this.notificacoes = notificacoes;
    }

    /** Sem {@code paraId} devolve todas — comportamento original, mantido. */
    @GetMapping
    public List<Notificacao> listar(@RequestParam(required = false) Long paraId) {
        return notificacoes.listar(paraId);
    }

    @PostMapping("/{id}/lida")
    public Notificacao marcarLida(@PathVariable Long id) {
        return notificacoes.marcarLida(id);
    }
}