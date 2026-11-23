package conecta.demo.repository;
import conecta.demo.model.Solicitacao;
import conecta.demo.model.StatusSolicitacao;
import java.util.List;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SolicitacaoRepository extends JpaRepository<Solicitacao, Long> {

	List<Solicitacao> findByUnidadeId(Long unidadeId);

	List<Solicitacao> findByInstrutorId(Long instrutorId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select s from Solicitacao s where s.status = :status")
    List<Solicitacao> findByStatusForUpdate(@Param("status") StatusSolicitacao status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select s from Solicitacao s where s.id = :id")
    java.util.Optional<Solicitacao> findByIdForUpdate(@Param("id") Long id);

}
