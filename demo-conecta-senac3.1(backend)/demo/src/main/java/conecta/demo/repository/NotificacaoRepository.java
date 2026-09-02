package conecta.demo.repository;

import conecta.demo.model.Notificacao;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificacaoRepository extends JpaRepository<Notificacao, Long> {

	List<Notificacao> findByParaIdOrderByCriadaEmDesc(Long paraId);

}
