package conecta.demo.service;

import conecta.demo.exception.AcessoNegadoException;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Sala;
import conecta.demo.model.Usuario;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SalaService {

    private final SalaRepository salas;
    private final UnidadeRepository unidades;
    private final UsuarioRepository usuarios;
    private final ReservaRepository reservas;
    private final IdAllocatorService ids;
    private final UsuarioAtual usuarioAtual;

    public SalaService(SalaRepository salas, UnidadeRepository unidades, UsuarioRepository usuarios) {
        this(salas, unidades, usuarios, null, null);
    }

    public SalaService(SalaRepository salas, UnidadeRepository unidades, UsuarioRepository usuarios,
                       ReservaRepository reservas) {
        this(salas, unidades, usuarios, reservas, null);
    }

    public SalaService(SalaRepository salas, UnidadeRepository unidades, UsuarioRepository usuarios,
                       ReservaRepository reservas, IdAllocatorService ids) {
        this(salas, unidades, usuarios, reservas, ids, null);
    }

    @Autowired
    public SalaService(SalaRepository salas, UnidadeRepository unidades, UsuarioRepository usuarios,
                       ReservaRepository reservas, IdAllocatorService ids, UsuarioAtual usuarioAtual) {
        this.salas = salas;
        this.unidades = unidades;
        this.usuarios = usuarios;
        this.reservas = reservas;
        this.ids = ids;
        this.usuarioAtual = usuarioAtual;
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

    /** Valida uma sala sincronizada sem persisti-la. */
    void validarParaSincronizacao(Sala sala) {
        validar(sala);
    }

    /**
     * Atualiza uma sala usando um identificador resolvido pelo chamador interno.
     * O endpoint HTTP usa a sobrecarga que obtem a identidade autenticada.
     *
     * <p>So e permitido alterar salas da propria unidade do usuario; caso
     * contrario, {@link AcessoNegadoException} (HTTP 403).</p>
     */
    public Sala atualizar(Long id, Long usuarioId, Sala entrada) {
        Sala atual = buscar(id);
        // Autorizacao ANTES da validacao do payload: um usuario que nao e
        // dono da sala deve receber 403 independente de a unidade de destino
        // existir — e nao 409, que revelaria informacao de outra unidade.
        exigirMesmaUnidade(atual, usuarioId);
        validar(entrada);

        atual.setNome(entrada.getNome());
        atual.setTipo(entrada.getTipo());
        atual.setCapacidade(entrada.getCapacidade());
        atual.setAndar(entrada.getAndar());
        atual.setBloco(entrada.getBloco());
        atual.setUnidadeId(entrada.getUnidadeId());
        atual.setAtiva(entrada.isAtiva());
        return salas.save(atual);
    }

    /** Atualiza usando exclusivamente a identidade autenticada do backend. */
    public Sala atualizar(Long id, Sala entrada) {
        Long usuarioId = usuarioAtual == null
                ? null
                : usuarioAtual.buscar().map(Usuario::getId).orElse(null);
        return atualizar(id, usuarioId, entrada);
    }

    public void excluir(Long id) {
        Sala sala = buscar(id);
        if (reservas != null && reservas.existsBySalaId(id))
            throw new RegraDeNegocioException("Sala possui reservas vinculadas; remova-as primeiro");
        salas.delete(sala);
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
        // Sem este guarda, `unidades.existsById(null)` estoura
        // InvalidDataAccessApiUsageException (HTTP 500) em vez de 409.
        if (sala.getUnidadeId() == null)
            throw new RegraDeNegocioException("Informe a unidade da sala");
        if (!unidades.existsById(sala.getUnidadeId()))
            throw new RegraDeNegocioException("Unidade informada nao existe");
        boolean temTurnos = (sala.getTurnosDisponiveis() != null && !sala.getTurnosDisponiveis().isEmpty())
                || (sala.getTurnos() != null && !sala.getTurnos().isEmpty());
        if (!temTurnos)
            throw new RegraDeNegocioException("Informe ao menos um turno da sala");
    }

    private Long proximoId() {
        if (ids != null) return ids.next("salas", () -> salas.findAll().stream().mapToLong(Sala::getId).max().orElse(0L));
        return salas.findAll().stream().mapToLong(Sala::getId).max().orElse(0L) + 1;
    }
}
