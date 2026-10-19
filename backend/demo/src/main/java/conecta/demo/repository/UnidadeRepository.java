package conecta.demo.repository;
import conecta.demo.model.Unidade;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface UnidadeRepository extends JpaRepository<Unidade, Long> {

	/**
	 * Unidades com o mesmo nome (comparacao sem diferenciar maiusculas).
	 *
	 * <p>Adicionado para impedir duas unidades homonimas: a tabela nao tem
	 * restricao de unicidade em {@code nome}, e o nome e a chave que o usuario
	 * enxerga no seletor do login.
	 */
	List<Unidade> findByNomeIgnoreCase(String nome);

}
