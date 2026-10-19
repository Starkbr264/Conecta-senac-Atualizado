package conecta.demo.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

@Entity
@Table(name = "notificacoes")
public class Notificacao {
    @Id
    private Long id;

    @NotBlank
    private String tipo;

    @NotBlank
    private String titulo;

    @NotBlank
    @Column(length = 1000)
    private String msg;

    private String paraPerfil;

    private Long paraId;

    private Long unidadeId;

    private boolean lida;

    @Column(nullable = false)
    private Instant criadaEm = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getMsg() {
        return msg;
    }

    public void setMsg(String msg) {
        this.msg = msg;
    }

    public String getParaPerfil() {
        return paraPerfil;
    }

    public void setParaPerfil(String paraPerfil) {
        this.paraPerfil = paraPerfil;
    }

    public Long getParaId() {
        return paraId;
    }

    public void setParaId(Long paraId) {
        this.paraId = paraId;
    }

    public Long getUnidadeId() {
        return unidadeId;
    }

    public void setUnidadeId(Long unidadeId) {
        this.unidadeId = unidadeId;
    }

    public boolean isLida() {
        return lida;
    }

    public void setLida(boolean lida) {
        this.lida = lida;
    }

    public Instant getCriadaEm() {
        return criadaEm;
    }

    public void setCriadaEm(Instant criadaEm) {
        this.criadaEm = criadaEm;
    }
}
