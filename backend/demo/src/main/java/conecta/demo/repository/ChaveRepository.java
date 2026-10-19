package conecta.demo.repository;

import conecta.demo.model.Chave;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChaveRepository extends JpaRepository<Chave, Long> {

	List<Chave> findByUnidadeId(Long unidadeId);

}
