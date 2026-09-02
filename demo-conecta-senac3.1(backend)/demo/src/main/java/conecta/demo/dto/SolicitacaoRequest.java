package conecta.demo.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.Set;

public record SolicitacaoRequest(
	@NotNull Long salaId,
	@NotNull Long instrutorId,
	Long turmaId,
	@NotNull Set<String> turnos,
	LocalDate data,
	LocalDate dataInicio,
	LocalDate dataFim,
	Set<String> diasSemana,
	java.util.List<String> datasEspecificas,
	String horaInicio,
	String horaFim,
	String modo,
	String turno,
	String motivo,
	@NotNull Long unidadeId
) { }
