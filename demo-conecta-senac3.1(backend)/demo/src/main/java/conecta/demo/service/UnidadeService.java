package conecta.demo.service;

import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Unidade;
import conecta.demo.repository.UnidadeRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UnidadeService {
    private final UnidadeRepository unidades;

    public UnidadeService(UnidadeRepository unidades) {
        this.unidades = unidades;
    }

    @Transactional(readOnly = true)
    public List<Unidade> listar() {
        return unidades.findAll();
    }

    @Transactional(readOnly = true)
    public Unidade buscar(Long id) {
        return unidades.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Unidade", id));
    }

    public Unidade criar(Unidade unidade) {
        unidade.setId(proximoId());
        return unidades.save(unidade);
    }

    private Long proximoId() {
        return unidades.findAll().stream().mapToLong(Unidade::getId).max().orElse(0L) + 1;
    }

    public Unidade atualizar(Long id, Unidade entrada) {
        Unidade atual = buscar(id);
        atual.setNome(entrada.getNome());
        atual.setCep(entrada.getCep());
        atual.setCidade(entrada.getCidade());
        atual.setEndereco(entrada.getEndereco());
        return unidades.save(atual);
    }

    public void excluir(Long id) {
        unidades.delete(buscar(id));
    }
}
