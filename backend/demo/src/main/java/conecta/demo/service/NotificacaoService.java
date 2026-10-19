package conecta.demo.service;

import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Notificacao;
import conecta.demo.repository.NotificacaoRepository;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Regras de notificacao.
 *
 * <p>Extraido de {@code NotificacaoController}. Comportamento preservado:
 * sem {@code paraId} a listagem devolve tudo; com {@code paraId}, ordena por
 * data de criacao decrescente; marcar como lida sobre registro inexistente
 * continua lancando {@link RecursoNaoEncontradoException}, que o
 * {@code ApiExceptionHandler} traduz para HTTP 404.
 */
@Service
public class NotificacaoService {

    private final NotificacaoRepository notificacoes;

    public NotificacaoService(NotificacaoRepository notificacoes) {
        this.notificacoes = notificacoes;
    }

    /**
     * @param paraId destino das notificacoes ou {@code null} para listar todas.
     */
    public List<Notificacao> listar(Long paraId) {
        return paraId == null
                ? notificacoes.findAll()
                : notificacoes.findByParaIdOrderByCriadaEmDesc(paraId);
    }

    /**
     * Marca uma notificacao como lida.
     *
     * @throws RecursoNaoEncontradoException se o id nao existir (-> HTTP 404).
     */
    public Notificacao marcarLida(Long id) {
        Notificacao n = notificacoes.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Notificacao", id));
        n.setLida(true);
        return notificacoes.save(n);
    }
}