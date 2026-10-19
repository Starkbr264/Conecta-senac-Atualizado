package conecta.demo.model;

import jakarta.persistence.*;

@Entity
@Table(name = "sessao")
public class Sessao {
    @Id
    private Long id = 1L;

    @Column(columnDefinition = "TEXT")
    private String usuarioJson;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsuarioJson() {
        return usuarioJson;
    }

    public void setUsuarioJson(String usuarioJson) {
        this.usuarioJson = usuarioJson;
    }
}
