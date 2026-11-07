package conecta.demo.exception;

/**
 * Payload malformado recebido do cliente: datas/numeros/status fora do formato
 * esperado. Mapeada para HTTP 400 pelo {@link ApiExceptionHandler}, sem vazar
 * stack trace. Diferente de {@link RegraDeNegocioException} (409), esta excecao
 * indica problema de FORMA nos dados enviados, nao violacao de regra.
 */
public class DadosInvalidosException extends RuntimeException {
    private final String campo;

    public DadosInvalidosException(String campo, String detalhe) {
        super("Campo " + campo + ": " + detalhe);
        this.campo = campo;
    }

    public String getCampo() {
        return campo;
    }
}
