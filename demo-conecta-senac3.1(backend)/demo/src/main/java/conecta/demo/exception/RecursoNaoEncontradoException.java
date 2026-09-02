package conecta.demo.exception;

public class RecursoNaoEncontradoException extends RuntimeException {

	public RecursoNaoEncontradoException(String recurso, Long id) {
		super(recurso + " nao encontrado: " + id);
	}

}
