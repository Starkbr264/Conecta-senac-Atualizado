package conecta.demo.dto;

import jakarta.validation.constraints.NotBlank;

public record RespostaSolicitacaoRequest(@NotBlank String decisao, String resposta) { }
