package conecta.demo.service;

import conecta.demo.exception.AcessoNegadoException;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Sala;
import conecta.demo.model.Usuario;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SalaService {

    private final SalaRepository salas;
    private final UnidadeRepository unidades;
    private final UsuarioRepository usuarios;

    public SalaService(SalaRepository salas, UnidadeRepository unidades, UsuarioRepository usuarios) {
        this.salas = salas;
        this.unidades = unidades;
        this.usuarios = usuarios;
    }

    @Transactional(readOnly = true)
    public List<Sala> listar(Long unidadeId) {
        return unidadeId == null ? salas.findAll() : salas.findByUnidadeId(unidadeId);
    }

    @Transactional(readOnly = true)
    public Sala buscar(Long id) {
        return salas.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Sala", id));
    }

    public Sala criar(Sala sala) {
        validar(sala);
        sala.setId(proximoId());
        return salas.save(sala);
    }

    /**
     * Atualiza uma sala. O id do usuario que faz a solicitacao e obrigatorio e
     * informado pelo chamador (o controlador recebe-o do cabecalho
     * {@code X-Usuario-Id}) porque este backend ainda nao possui filtro de
     * autenticacao — nao existe contexto de seguranca de onde le-lo.
     *
     * <p>So e permitido alterar salas da propria unidade do usuario; caso
     * contrario, {@link AcessoNegadoException} (HTTP 403).</p>
     */
    public Sala atualizar(Long id, Long usuarioId, Sala entrada) {
        Sala atual = buscar(id);
        validar(entrada);
        exigirMesmaUnidade(atual, usuarioId);

        atual.setNome(entrada.getNome());
        atual.setTipo(entrada.getTipo());
        atual.setCapacidade(entrada.getCapacidade());
        atual.setAndar(entrada.getAndar());
        atual.setBloco(entrada.getBloco());
        atual.setUnidadeId(entrada.getUnidadeId());
        atual.setAtiva(entrada.isAtiva());
        return salas.save(atual);
    }

    public void excluir(Long id) {
        salas.delete(buscar(id));
    }

    /** Impede atualizacao de sala que nao pertence a unidade do usuario. */
    private void exigirMesmaUnidade(Sala atual, Long usuarioId) {
        if (usuarioId == null) {
            throw new AcessoNegadoException("Identificacao do usuario e obrigatoria para alterar sala");
        }
        Usuario usuario = usuarios.findById(usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuario", usuarioId));
        if (!usuario.getUnidadeId().equals(atual.getUnidadeId())) {
            throw new AcessoNegadoException("Nao e possivel atualizar salas de outras unidades");
        }
    }

    private void validar(Sala sala) {
        if (!unidades.existsById(sala.getUnidadeId()))
            throw new RegraDeNegocioException("Unidade informada nao existe");
    }

    private Long proximoId() {
        return salas.findAll().stream().mapToLong(Sala::getId).max().orElse(0L) + 1;
    }
}
