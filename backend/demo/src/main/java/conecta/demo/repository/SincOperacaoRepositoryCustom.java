package conecta.demo.repository;

/** Operacoes atomicas especificas do registro de idempotencia. */
public interface SincOperacaoRepositoryCustom {
    int reservar(String id, Long usuarioId, String respostaInicial);
}
