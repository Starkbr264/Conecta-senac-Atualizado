package conecta.demo.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "salas")
public class Sala {
    @Id
    private Long id;

    @NotBlank
    @Column(nullable = false)
    private String nome;

    @NotBlank
    private String tipo;

    @Positive
    private Integer capacidade;

    private String andar;

    private String bloco;

    @Column(nullable = false)
    private Long unidadeId;

    private boolean ativa = true;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "sala_turnos", joinColumns = @JoinColumn(name = "sala_id"))
    @Column(name = "turno")
    private List<String> turnosDisponiveis = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "sala_turnos_legado", joinColumns = @JoinColumn(name = "sala_id"))
    @Column(name = "turno")
    private List<String> turnos = new ArrayList<>();

    private String statusManual;

    private String motivoManual;

    private String manualPor;

    private Instant manualCriadaEm;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public Integer getCapacidade() {
        return capacidade;
    }

    public void setCapacidade(Integer capacidade) {
        this.capacidade = capacidade;
    }

    public String getAndar() {
        return andar;
    }

    public void setAndar(String andar) {
        this.andar = andar;
    }

    public String getBloco() {
        return bloco;
    }

    public void setBloco(String bloco) {
        this.bloco = bloco;
    }

    public Long getUnidadeId() {
        return unidadeId;
    }

    public void setUnidadeId(Long unidadeId) {
        this.unidadeId = unidadeId;
    }

    public boolean isAtiva() {
        return ativa;
    }

    public void setAtiva(boolean ativa) {
        this.ativa = ativa;
    }

    public List<String> getTurnosDisponiveis() {
        return turnosDisponiveis;
    }

    public void setTurnosDisponiveis(List<String> turnosDisponiveis) {
        this.turnosDisponiveis = turnosDisponiveis == null ? new ArrayList<>() : new ArrayList<>(turnosDisponiveis);
    }

    public List<String> getTurnos() {
        return turnos;
    }

    public void setTurnos(List<String> turnos) {
        this.turnos = turnos == null ? new ArrayList<>() : new ArrayList<>(turnos);
    }

    public String getStatusManual() {
        return statusManual;
    }

    public void setStatusManual(String statusManual) {
        this.statusManual = statusManual;
    }

    public String getMotivoManual() {
        return motivoManual;
    }

    public void setMotivoManual(String motivoManual) {
        this.motivoManual = motivoManual;
    }

    public String getManualPor() {
        return manualPor;
    }

    public void setManualPor(String manualPor) {
        this.manualPor = manualPor;
    }

    public Instant getManualCriadaEm() {
        return manualCriadaEm;
    }

    public void setManualCriadaEm(Instant manualCriadaEm) {
        this.manualCriadaEm = manualCriadaEm;
    }
}
