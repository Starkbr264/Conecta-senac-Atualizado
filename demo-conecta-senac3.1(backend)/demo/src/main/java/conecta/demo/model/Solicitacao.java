package conecta.demo.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "solicitacoes")
public class Solicitacao {
    @Id
    private Long id;

    @Column(nullable = false)
    private Long salaId;

    @Column(nullable = false)
    private Long instrutorId;

    private Long turmaId;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "solicitacao_turnos", joinColumns = @JoinColumn(name = "solicitacao_id"))
    @Column(name = "turno")
    private Set<String> turnos = new LinkedHashSet<>();

    @Column(nullable = false)
    private LocalDate data;

    private LocalDate dataInicio;

    private LocalDate dataFim;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "solicitacao_dias_semana", joinColumns = @JoinColumn(name = "solicitacao_id"))
    @Column(name = "dia_semana")
    private Set<String> diasSemana = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "solicitacao_datas_especificas", joinColumns = @JoinColumn(name = "solicitacao_id"))
    @Column(name = "data_especifica")
    private List<String> datasEspecificas = new ArrayList<>();

    private String horaInicio;

    private String horaFim;

    private String modo;

    private String turno;

    @Column(length = 1000)
    private String motivo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusSolicitacao status = StatusSolicitacao.PENDENTE;

    @Column(nullable = false)
    private Long unidadeId;

    @Column(nullable = false)
    private Instant criadaEm = Instant.now();

    private Instant respondidaEm;

    @Column(length = 1000)
    private String resposta;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSalaId() {
        return salaId;
    }

    public void setSalaId(Long salaId) {
        this.salaId = salaId;
    }

    public Long getInstrutorId() {
        return instrutorId;
    }

    public void setInstrutorId(Long instrutorId) {
        this.instrutorId = instrutorId;
    }

    public Long getTurmaId() {
        return turmaId;
    }

    public void setTurmaId(Long turmaId) {
        this.turmaId = turmaId;
    }

    public Set<String> getTurnos() {
        return turnos;
    }

    public void setTurnos(Set<String> turnos) {
        this.turnos = turnos == null ? new LinkedHashSet<>() : new LinkedHashSet<>(turnos);
    }

    public LocalDate getData() {
        return data;
    }

    public void setData(LocalDate data) {
        this.data = data;
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

    public Set<String> getDiasSemana() {
        return diasSemana;
    }

    public void setDiasSemana(Set<String> diasSemana) {
        this.diasSemana = diasSemana == null ? new LinkedHashSet<>() : new LinkedHashSet<>(diasSemana);
    }

    public List<String> getDatasEspecificas() {
        return datasEspecificas;
    }

    public void setDatasEspecificas(List<String> datasEspecificas) {
        this.datasEspecificas = datasEspecificas == null ? new ArrayList<>() : new ArrayList<>(datasEspecificas);
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

    public String getModo() {
        return modo;
    }

    public void setModo(String modo) {
        this.modo = modo;
    }

    public String getTurno() {
        return turno;
    }

    public void setTurno(String turno) {
        this.turno = turno;
    }

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }

    public StatusSolicitacao getStatus() {
        return status;
    }

    public void setStatus(StatusSolicitacao status) {
        this.status = status;
    }

    public Long getUnidadeId() {
        return unidadeId;
    }

    public void setUnidadeId(Long unidadeId) {
        this.unidadeId = unidadeId;
    }

    public Instant getCriadaEm() {
        return criadaEm;
    }

    public void setCriadaEm(Instant criadaEm) {
        this.criadaEm = criadaEm;
    }

    public Instant getRespondidaEm() {
        return respondidaEm;
    }

    public void setRespondidaEm(Instant respondidaEm) {
        this.respondidaEm = respondidaEm;
    }

    public String getResposta() {
        return resposta;
    }

    public void setResposta(String resposta) {
        this.resposta = resposta;
    }
}
