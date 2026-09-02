package conecta.demo.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.Set;

public record ReservaRequest(
	@NotNull Long salaId,
	Long turmaId,
	@NotNull String turno,
	@NotNull Set<String> diasSemana,
	@NotNull LocalDate dataInicio,
	@NotNull LocalDate dataFim,
	String horaInicio,
	String horaFim,
	Long instrutorId,
	@NotNull Long unidadeId
) { }
