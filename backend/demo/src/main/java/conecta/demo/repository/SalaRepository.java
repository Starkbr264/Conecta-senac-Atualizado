package conecta.demo.repository;
import conecta.demo.model.Sala;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
public interface SalaRepository extends JpaRepository<Sala, Long> {

	List<Sala> findByUnidadeId(Long unidadeId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from Sala s where s.id = :id")
	java.util.Optional<Sala> findForUpdate(@Param("id") Long id);

}
