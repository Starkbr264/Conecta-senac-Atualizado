package conecta.demo.repository;
import conecta.demo.model.Solicitacao;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SolicitacaoRepository extends JpaRepository<Solicitacao, Long> {

	List<Solicitacao> findByUnidadeId(Long unidadeId);

	List<Solicitacao> findByInstrutorId(Long instrutorId);

}
