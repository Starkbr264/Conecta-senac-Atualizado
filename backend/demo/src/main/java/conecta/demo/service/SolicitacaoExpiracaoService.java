package conecta.demo.service;

import conecta.demo.model.Solicitacao;
import conecta.demo.model.SolicitacaoDataExpirada;
import conecta.demo.model.StatusSolicitacao;
import conecta.demo.repository.SolicitacaoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Expiração autoritativa e idempotente das solicitações pendentes. */
@Service
@Transactional
public class SolicitacaoExpiracaoService {
    public static final String ORIGEM_SISTEMA = "SISTEMA";
    public static final String MOTIVO_EXPIRACAO =
            "Data solicitada atingida sem decisão do coordenador";

    private final SolicitacaoRepository solicitacoes;
    private final Clock clock;
    private final ZoneId zoneId;

    @org.springframework.beans.factory.annotation.Autowired
    public SolicitacaoExpiracaoService(
            SolicitacaoRepository solicitacoes,
            @Value("${app.timezone:America/Sao_Paulo}") String timezone) {
        this(solicitacoes, Clock.systemUTC(), ZoneId.of(timezone));
    }

    public SolicitacaoExpiracaoService(SolicitacaoRepository solicitacoes, Clock clock, ZoneId zoneId) {
        this.solicitacoes = solicitacoes;
        this.clock = clock;
        this.zoneId = zoneId;
    }

    /** Execução periódica; consultas e aprovações também fazem recuperação sob demanda. */
    @Scheduled(fixedDelayString = "${app.solicitacoes.expiracao-ms:60000}")
    public void expirarAgendadas() {
        expirarVencidas();
    }

    public LocalDate hoje() {
        return LocalDate.now(clock.withZone(zoneId));
    }

    /** Data de início da validade para pedidos de dia único ou período contínuo. */
    public LocalDate dataEfetivaDeExpiracao(Solicitacao solicitacao) {
        if (datasIndependentes(solicitacao)) return null;
        return inicio(solicitacao);
    }

    /** Expira todos os pendentes vencidos sob lock pessimista. */
    public int expirarVencidas() {
        int alteradas = 0;
        for (Solicitacao solicitacao : solicitacoes.findByStatusForUpdate(StatusSolicitacao.PENDENTE)) {
            if (expirarSeVencida(solicitacao)) alteradas++;
        }
        return alteradas;
    }

    /** Aplica a transição, se necessária, e não altera estados terminais. */
    public boolean expirarSeVencida(Solicitacao solicitacao) {
        if (solicitacao == null || solicitacao.getStatus() != StatusSolicitacao.PENDENTE) return false;
        LocalDate hoje = hoje();
        Instant agora = Instant.now(clock);
        if (datasIndependentes(solicitacao)) {
            return expirarDatasIndependentes(solicitacao, hoje, agora);
        }
        LocalDate inicio = inicio(solicitacao);
        if (inicio == null || hoje.isBefore(inicio)) return false;
        marcarExpirada(solicitacao, agora);
        solicitacoes.save(solicitacao);
        return true;
    }

    private boolean expirarDatasIndependentes(Solicitacao solicitacao, LocalDate hoje, Instant agora) {
        List<String> originais = solicitacao.getDatasEspecificas();
        if (originais == null || originais.isEmpty()) return false;
        Set<LocalDate> jaExpiradas = new HashSet<>();
        solicitacao.getDatasExpiradas().forEach(item -> jaExpiradas.add(item.getData()));
        boolean alterou = false;
        for (String valor : originais) {
            LocalDate data = LocalDate.parse(valor);
            if (!data.isAfter(hoje) && jaExpiradas.add(data)) {
                solicitacao.getDatasExpiradas().add(new SolicitacaoDataExpirada(
                        data, expiraçãoNoInstanteDaData(data), ORIGEM_SISTEMA, MOTIVO_EXPIRACAO));
                alterou = true;
            }
        }
        boolean restamFuturas = originais.stream().map(LocalDate::parse).anyMatch(data -> data.isAfter(hoje));
        if (!restamFuturas && !originais.isEmpty() && solicitacao.getStatus() == StatusSolicitacao.PENDENTE) {
            marcarExpirada(solicitacao, agora);
            alterou = true;
        }
        if (alterou) solicitacoes.save(solicitacao);
        return alterou;
    }

    private Instant expiraçãoNoInstanteDaData(LocalDate data) {
        return data.atStartOfDay(zoneId).toInstant();
    }

    private void marcarExpirada(Solicitacao solicitacao, Instant quando) {
        solicitacao.setStatus(StatusSolicitacao.EXPIRADA);
        solicitacao.setExpiradaEm(quando);
        solicitacao.setOrigemStatus(ORIGEM_SISTEMA);
        solicitacao.setMotivoStatus(MOTIVO_EXPIRACAO);
    }

    private boolean datasIndependentes(Solicitacao solicitacao) {
        return "especificas".equalsIgnoreCase(solicitacao.getModo())
                || (solicitacao.getDatasEspecificas() != null && !solicitacao.getDatasEspecificas().isEmpty());
    }

    private LocalDate inicio(Solicitacao solicitacao) {
        return solicitacao.getDataInicio() != null ? solicitacao.getDataInicio() : solicitacao.getData();
    }
}
