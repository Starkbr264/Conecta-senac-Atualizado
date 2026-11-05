package conecta.demo.service;

import conecta.demo.repository.ChaveRepository;
import conecta.demo.repository.NotificacaoRepository;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.model.Perfil;
import conecta.demo.model.Usuario;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Leitura do banco completo.
 *
 * <p>Existia duplicado: {@code DadosController} montava o mapa com
 * {@code Map.of(...)} e {@code SincController.banco()} montava o mesmo mapa
 * com {@code LinkedHashMap}. As duas versoes devolvem exatamente as mesmas
 * oito colecoes; unificadas aqui, usando {@link LinkedHashMap} para que a
 * ordem das chaves no JSON seja deterministica.
 *
 * <p>Nenhum endpoint, verbo ou nome de chave foi alterado.
 */
@Service
public class DadosService {

    private final UsuarioRepository usuarios;
    private final UnidadeRepository unidades;
    private final SalaRepository salas;
    private final TurmaRepository turmas;
    private final ReservaRepository reservas;
    private final ChaveRepository chaves;
    private final NotificacaoRepository notificacoes;
    private final SolicitacaoRepository solicitacoes;

    public DadosService(UsuarioRepository usuarios, UnidadeRepository unidades, SalaRepository salas,
                        TurmaRepository turmas, ReservaRepository reservas, ChaveRepository chaves,
                        NotificacaoRepository notificacoes, SolicitacaoRepository solicitacoes) {
        this.usuarios = usuarios;
        this.unidades = unidades;
        this.salas = salas;
        this.turmas = turmas;
        this.reservas = reservas;
        this.chaves = chaves;
        this.notificacoes = notificacoes;
        this.solicitacoes = solicitacoes;
    }

    /**
     * Snapshot completo das oito colecoes de dominio.
     *
     * @return mapa com as chaves usuarios, unidades, salas, turmas, reservas,
     *         chaves, notificacoes e solicitacoes.
     */
    public Map<String, Object> banco() {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("usuarios", usuarios.findAll());
        b.put("unidades", unidades.findAll());
        b.put("salas", salas.findAll());
        b.put("turmas", turmas.findAll());
        b.put("reservas", reservas.findAll());
        b.put("chaves", chaves.findAll());
        b.put("notificacoes", notificacoes.findAll());
        b.put("solicitacoes", solicitacoes.findAll());
        return b;
    }

    /** Snapshot com escopo: ADMIN ve tudo; os demais perfis veem sua unidade. */
    public Map<String, Object> banco(Usuario atual) {
        if (atual == null || atual.getPerfil() == Perfil.ADMIN) return banco();
        Long unidadeId = atual.getUnidadeId();
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("usuarios", usuarios.findAll().stream()
                .filter(u -> unidadeId.equals(u.getUnidadeId())).toList());
        b.put("unidades", unidades.findAll());
        b.put("salas", salas.findAll().stream()
                .filter(s -> unidadeId.equals(s.getUnidadeId())).toList());
        b.put("turmas", turmas.findAll().stream()
                .filter(t -> unidadeId.equals(t.getUnidadeId())).toList());
        b.put("reservas", reservas.findAll().stream()
                .filter(r -> unidadeId.equals(r.getUnidadeId())).toList());
        b.put("chaves", chaves.findAll().stream()
                .filter(c -> unidadeId.equals(c.getUnidadeId())).toList());
        b.put("notificacoes", notificacoes.findAll().stream()
                .filter(n -> unidadeId.equals(n.getUnidadeId())
                        || atual.getId().equals(n.getParaId())).toList());
        b.put("solicitacoes", solicitacoes.findAll().stream()
                .filter(s -> unidadeId.equals(s.getUnidadeId())).toList());
        return b;
    }
}
