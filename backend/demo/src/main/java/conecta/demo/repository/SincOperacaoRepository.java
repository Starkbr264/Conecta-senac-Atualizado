package conecta.demo.repository;

import conecta.demo.model.SincOperacao;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SincOperacaoRepository extends JpaRepository<SincOperacao, String>,
        SincOperacaoRepositoryCustom {
    java.util.Optional<SincOperacao> findByIdAndUsuarioId(String id, Long usuarioId);
}
