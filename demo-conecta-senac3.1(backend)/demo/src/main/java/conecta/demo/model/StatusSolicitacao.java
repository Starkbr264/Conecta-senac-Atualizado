package conecta.demo.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum StatusSolicitacao {
    PENDENTE, APROVADA, RECUSADA;

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static StatusSolicitacao from(String valor) {
        if (valor == null) {
            return null;
        }
        return StatusSolicitacao.valueOf(valor.trim().toUpperCase(Locale.ROOT));
    }
}
