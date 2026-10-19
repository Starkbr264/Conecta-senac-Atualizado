package conecta.demo.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum Perfil {
    ADMIN, COORDENADOR, INSTRUTOR, RECEPCAO;

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static Perfil from(String valor) {
        if (valor == null) {
            return null;
        }
        return Perfil.valueOf(valor.trim().toUpperCase(Locale.ROOT));
    }
}
