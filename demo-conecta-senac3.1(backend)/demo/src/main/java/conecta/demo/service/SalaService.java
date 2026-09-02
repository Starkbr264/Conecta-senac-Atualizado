package conecta.demo.service;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Sala;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.UnidadeRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SalaService {
    private final SalaRepository salas;
    private final UnidadeRepository unidades;

    public SalaService(SalaRepository salas, UnidadeRepository unidades) {
        this.salas = salas;
        this.unidades = unidades;
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

    private Long proximoId() {
        return salas.findAll().stream().mapToLong(Sala::getId).max().orElse(0L) + 1;
    }

    public Sala atualizar(Long id, Sala entrada) {
        Sala atual = buscar(id);
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

    public void excluir(Long id) {
        salas.delete(buscar(id));
    }

    private void validar(Sala sala) {
        if (!unidades.existsById(sala.getUnidadeId()))
            throw new RegraDeNegocioException("Unidade informada nao existe");
    }
}
