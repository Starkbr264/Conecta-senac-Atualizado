package conecta.demo.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Registro de idempotencia para reenvios seguros do cliente. */
@Entity
@Table(name = "sinc_operacoes")
public class SincOperacao {
    @Id
    @Column(length = 120, nullable = false)
    private String id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String respostaJson;

    @Column(nullable = false)
    private Instant criadaEm = Instant.now();

    public SincOperacao() {
    }

    public SincOperacao(String id, String respostaJson) {
        this.id = id;
        this.respostaJson = respostaJson;
    }

    public String getId() {
        return id;
    }

    public String getRespostaJson() {
        return respostaJson;
    }

    public Instant getCriadaEm() {
        return criadaEm;
    }
}
