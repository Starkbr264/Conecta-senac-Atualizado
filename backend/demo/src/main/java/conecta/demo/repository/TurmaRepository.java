package conecta.demo.repository;
import conecta.demo.model.Turma;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface TurmaRepository extends JpaRepository<Turma, Long> {

	List<Turma> findByUnidadeId(Long unidadeId);

}
