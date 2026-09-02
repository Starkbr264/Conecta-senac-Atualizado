package conecta.demo.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum StatusChave {
    DISPONIVEL, RETIRADA;

    @JsonValue
    public String json() {
        return this == DISPONIVEL ? "disponivel" : "pega";
    }

    @JsonCreator
    public static StatusChave from(String valor) {
        if (valor == null) {
            return null;
        }
        return valor.trim().equalsIgnoreCase("pega") ? RETIRADA : DISPONIVEL;
    }
}
