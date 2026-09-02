package conecta.demo.controller;

import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Notificacao;
import conecta.demo.repository.NotificacaoRepository;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notificacoes")
public class NotificacaoController {
    private final NotificacaoRepository notificacoes;
    public NotificacaoController(NotificacaoRepository notificacoes) { this.notificacoes = notificacoes; }
    @GetMapping
    public List<Notificacao> listar(@RequestParam(required = false) Long paraId) {
        return paraId == null ? notificacoes.findAll() : notificacoes.findByParaIdOrderByCriadaEmDesc(paraId);
    }

    @PostMapping("/{id}/lida")
    public Notificacao marcarComoLida(@PathVariable Long id) {
        Notificacao notificacao = notificacoes.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Notificacao", id));
        notificacao.setLida(true);
        return notificacoes.save(notificacao);
    }
}
