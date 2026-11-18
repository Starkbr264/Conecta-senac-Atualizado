package conecta.demo.dto;

/**
 * Estado efetivo de uma sala. O campo {@code status} é o estado usado para a
 * consulta (agora ou no período solicitado); {@code statusAtual} permite que
 * clientes que consultam um período futuro também exibam o estado presente.
 */
public record SalaStatusResponse(
        Long id,
        String nome,
        String status,
        String reason,
        String inicio,
        String fim,
        String turma,
        String statusAtual
) {}
