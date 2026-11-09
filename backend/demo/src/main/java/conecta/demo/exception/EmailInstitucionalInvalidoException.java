package conecta.demo.exception;

/**
 * E-mail fora da politica institucional {@code @edu.df.senac.br}.
 *
 * <p>Erro de FORMATO nos dados enviados: mapeada para HTTP 400 pelo
 * {@link ApiExceptionHandler}, ao contrario de {@link RegraDeNegocioException}
 * (409), que representa violacao de regra de negocio (duplicidade, senha
 * curta etc.).
 */
public class EmailInstitucionalInvalidoException extends RuntimeException {

    public EmailInstitucionalInvalidoException(String message) {
        super(message);
    }
}
