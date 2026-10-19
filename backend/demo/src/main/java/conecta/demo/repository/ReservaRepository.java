package conecta.demo.repository;
import conecta.demo.model.Reserva;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ReservaRepository extends JpaRepository<Reserva, Long> {

    List<Reserva> findBySalaIdAndDataInicioLessThanEqualAndDataFimGreaterThanEqual(Long salaId, LocalDate dataFim, LocalDate dataInicio);

    List<Reserva> findByUnidadeId(Long unidadeId);

}
