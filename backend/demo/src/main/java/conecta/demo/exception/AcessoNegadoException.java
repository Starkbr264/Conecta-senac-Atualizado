package conecta.demo.exception;

/**
 * Lancada quando o usuario autenticado tenta aceder ou alterar um recurso que
 * pertence a outra unidade.
 *
 * <p>Mapeada para HTTP 403 por {@link ApiExceptionHandler}.</p>
 */
public class AcessoNegadoException extends RuntimeException {

    public AcessoNegadoException(String message) {
        super(message);
    }
}
