package conecta.demo.model;

import jakarta.persistence.Embeddable;
import java.time.Instant;
import java.time.LocalDate;

/** Histórico imutável da expiração individual de uma data específica. */
@Embeddable
public class SolicitacaoDataExpirada {
    private LocalDate data;
    private Instant expiradaEm;
    private String origem;
    private String motivo;

    protected SolicitacaoDataExpirada() {
    }

    public SolicitacaoDataExpirada(LocalDate data, Instant expiradaEm, String origem, String motivo) {
        this.data = data;
        this.expiradaEm = expiradaEm;
        this.origem = origem;
        this.motivo = motivo;
    }

    public LocalDate getData() {
        return data;
    }

    public Instant getExpiradaEm() {
        return expiradaEm;
    }

    public String getOrigem() {
        return origem;
    }

    public String getMotivo() {
        return motivo;
    }
}
