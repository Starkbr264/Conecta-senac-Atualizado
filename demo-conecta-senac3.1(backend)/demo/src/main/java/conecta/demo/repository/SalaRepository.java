package conecta.demo.repository;
import conecta.demo.model.Sala;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SalaRepository extends JpaRepository<Sala, Long> {

	List<Sala> findByUnidadeId(Long unidadeId);

}
