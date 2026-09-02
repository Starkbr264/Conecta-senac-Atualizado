package conecta.demo.service;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Turma;
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

    public TurmaService(TurmaRepository turmas, UnidadeRepository unidades, UsuarioRepository usuarios) {
        this.turmas = turmas;
        this.unidades = unidades;
        this.usuarios = usuarios;
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
        validar(turma);
        turma.setId(proximoId());
        return turmas.save(turma);
    }

    private Long proximoId() {
        return turmas.findAll().stream().mapToLong(Turma::getId).max().orElse(0L) + 1;
    }

    public Turma atualizar(Long id, Turma entrada) {
        Turma atual = buscar(id);
        validar(entrada);
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
        turmas.delete(buscar(id));
    }

    private void validar(Turma turma) {
        if (turma.getDataInicio() != null && turma.getDataFim() != null && turma.getDataFim().isBefore(turma.getDataInicio()))
            throw new RegraDeNegocioException("A data final deve ser posterior a data inicial");
        if (!unidades.existsById(turma.getUnidadeId()))
            throw new RegraDeNegocioException("Unidade informada nao existe");
        if (turma.getInstrutorId() != null && !usuarios.existsById(turma.getInstrutorId()))
            throw new RegraDeNegocioException("Instrutor informado nao existe");
    }
}
