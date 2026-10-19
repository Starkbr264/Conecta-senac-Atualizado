package conecta.demo.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

@Entity
@Table(name = "chaves", uniqueConstraints = @UniqueConstraint(columnNames = "codigo"))
public class Chave {
    @Id
    private Long id;

    @NotBlank
    @Column(nullable = false)
    private String codigo;

    @Column(nullable = false)
    private Long salaId;

    private String andar;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusChave status = StatusChave.DISPONIVEL;

    private Long instrutorId;

    private Instant pegaEm;

    @Column(nullable = false)
    private Long unidadeId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCodigo() {
        return codigo;
    }

    public void setCodigo(String codigo) {
        this.codigo = codigo;
    }

    public Long getSalaId() {
        return salaId;
    }

    public void setSalaId(Long salaId) {
        this.salaId = salaId;
    }

    public String getAndar() {
        return andar;
    }

    public void setAndar(String andar) {
        this.andar = andar;
    }

    public StatusChave getStatus() {
        return status;
    }

    public void setStatus(StatusChave status) {
        this.status = status;
    }

    public Long getInstrutorId() {
        return instrutorId;
    }

    public void setInstrutorId(Long instrutorId) {
        this.instrutorId = instrutorId;
    }

    public Instant getPegaEm() {
        return pegaEm;
    }

    public void setPegaEm(Instant pegaEm) {
        this.pegaEm = pegaEm;
    }

    public Long getUnidadeId() {
        return unidadeId;
    }

    public void setUnidadeId(Long unidadeId) {
        this.unidadeId = unidadeId;
    }
}
