package conecta.demo.repository;
import conecta.demo.model.Usuario;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

	Optional<Usuario> findByEmailIgnoreCase(String email);

	/**
	 * Usuarios vinculados a uma unidade.
	 *
	 * <p>Adicionado para que a exclusao de uma unidade possa detectar as
	 * referencias penduradas (a coluna {@code usuarios.unidade_id} e NOT NULL
	 * e nao tem chave estrangeira, portanto o banco nao impede o orfao).
	 */
	List<Usuario> findByUnidadeId(Long unidadeId);

}
