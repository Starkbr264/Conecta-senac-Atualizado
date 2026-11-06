package conecta.demo.service;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Turma;
import conecta.demo.model.Perfil;
import conecta.demo.model.Usuario;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TurmaService {
    private final TurmaRepository turmas;
    private final UnidadeRepository unidades;
    private final UsuarioRepository usuarios;
    private final ReservaRepository reservas;
    private final IdAllocatorService ids;

    @org.springframework.beans.factory.annotation.Autowired
    public TurmaService(TurmaRepository turmas, UnidadeRepository unidades, UsuarioRepository usuarios,
                        ReservaRepository reservas) {
        this(turmas, unidades, usuarios, reservas, null);
    }

    public TurmaService(TurmaRepository turmas, UnidadeRepository unidades, UsuarioRepository usuarios,
                        ReservaRepository reservas, IdAllocatorService ids) {
        this.turmas = turmas;
        this.unidades = unidades;
        this.usuarios = usuarios;
        this.reservas = reservas;
        this.ids = ids;
    }

    @Transactional(readOnly = true)
    public List<Turma> listar(Long unidadeId) {
        return unidadeId == null ? turmas.findAll() : turmas.findByUnidadeId(unidadeId);
    }

    @Transactional(readOnly = true)
    public Turma buscar(Long id) {
        return turmas.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Turma", id));
    }

    public Turma criar(Turma turma) {
        validar(turma, null);
        turma.setId(proximoId());
        return turmas.save(turma);
    }

    /** Valida uma turma sincronizada sem persisti-la. */
    void validarParaSincronizacao(Turma turma, Long ignorarId) {
        validar(turma, ignorarId);
    }

    private Long proximoId() {
        if (ids != null) return ids.next("turmas", () -> turmas.findAll().stream().mapToLong(Turma::getId).max().orElse(0L));
        return turmas.findAll().stream().mapToLong(Turma::getId).max().orElse(0L) + 1;
    }

    public Turma atualizar(Long id, Turma entrada) {
        Turma atual = buscar(id);
        validar(entrada, id);
        atual.setNome(entrada.getNome());
        atual.setCodigo(entrada.getCodigo());
        atual.setCurso(entrada.getCurso());
        atual.setTurno(entrada.getTurno());
        atual.setDataInicio(entrada.getDataInicio());
        atual.setDataFim(entrada.getDataFim());
        atual.setInstrutorId(entrada.getInstrutorId());
        atual.setUnidadeId(entrada.getUnidadeId());
        return turmas.save(atual);
    }

    public void excluir(Long id) {
        Turma turma = buscar(id);
        reservas.deleteAll(reservas.findByTurmaId(id));
        turmas.delete(turma);
    }

    private void validar(Turma turma, Long ignorarId) {
        if (turma.getDataInicio() != null && turma.getDataFim() != null && turma.getDataFim().isBefore(turma.getDataInicio()))
            throw new RegraDeNegocioException("A data final deve ser posterior a data inicial");
        if (turma.getUnidadeId() == null || !unidades.existsById(turma.getUnidadeId()))
            throw new RegraDeNegocioException("Unidade informada nao existe");
        if (turma.getCodigo() == null || turma.getCodigo().isBlank())
            throw new RegraDeNegocioException("Codigo da turma e obrigatorio");
        if (turmas.findByCodigo(turma.getCodigo()).stream()
                .anyMatch(t -> ignorarId == null || !t.getId().equals(ignorarId)))
            throw new RegraDeNegocioException("Ja existe turma com este codigo");
        if (turma.getInstrutorId() != null) {
            Usuario instrutor = usuarios.findById(turma.getInstrutorId())
                    .orElseThrow(() -> new RegraDeNegocioException("Instrutor informado nao existe"));
            if (instrutor.getPerfil() != Perfil.INSTRUTOR)
                throw new RegraDeNegocioException("Usuario vinculado nao possui perfil INSTRUTOR");
            if (!instrutor.getUnidadeId().equals(turma.getUnidadeId()))
                throw new RegraDeNegocioException("Instrutor deve pertencer a mesma unidade da turma");
        }
    }
}
