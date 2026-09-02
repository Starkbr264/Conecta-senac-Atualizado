package conecta.demo.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "reservas")
public class Reserva {
    @Id
    private Long id;

    public void setId(Long id) {
        this.id = id;
    }

    @Column(nullable = false)
    private Long salaId;

    private Long turmaId;

    @NotBlank
    @Column(nullable = false)
    private String turno;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "reserva_dias_semana", joinColumns = @JoinColumn(name = "reserva_id"))
    @Column(name = "dia_semana")
    private Set<String> diasSemana = new LinkedHashSet<>();

    @Column(nullable = false)
    private LocalDate dataInicio;

    @Column(nullable = false)
    private LocalDate dataFim;

    private String horaInicio;

    private String horaFim;

    private Long instrutorId;

    @Column(nullable = false)
    private Long unidadeId;

    private String status = "ATIVA";

    private boolean avulsa;
    public Long getId() {
        return id;
    }

    public Long getSalaId() {
        return salaId;
    }

    public void setSalaId(Long salaId) {
        this.salaId = salaId;
    }

    public Long getTurmaId() {
        return turmaId;
    }

    public void setTurmaId(Long turmaId) {
        this.turmaId = turmaId;
    }

    public String getTurno() {
        return turno;
    }

    public void setTurno(String turno) {
        this.turno = turno;
    }

    public Set<String> getDiasSemana() {
        return diasSemana;
    }

    public void setDiasSemana(Set<String> diasSemana) {
        this.diasSemana = diasSemana == null ? new LinkedHashSet<>() : new LinkedHashSet<>(diasSemana);
    }

    public LocalDate getDataInicio() {
        return dataInicio;
    }

    public void setDataInicio(LocalDate dataInicio) {
        this.dataInicio = dataInicio;
    }

    public LocalDate getDataFim() {
        return dataFim;
    }

    public void setDataFim(LocalDate dataFim) {
        this.dataFim = dataFim;
    }

    public String getHoraInicio() {
        return horaInicio;
    }

    public void setHoraInicio(String horaInicio) {
        this.horaInicio = horaInicio;
    }

    public String getHoraFim() {
        return horaFim;
    }

    public void setHoraFim(String horaFim) {
        this.horaFim = horaFim;
    }

    public Long getInstrutorId() {
        return instrutorId;
    }

    public void setInstrutorId(Long instrutorId) {
        this.instrutorId = instrutorId;
    }

    public Long getUnidadeId() {
        return unidadeId;
    }

    public void setUnidadeId(Long unidadeId) {
        this.unidadeId = unidadeId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isAvulsa() {
        return avulsa;
    }

    public void setAvulsa(boolean avulsa) {
        this.avulsa = avulsa;
    }
}
