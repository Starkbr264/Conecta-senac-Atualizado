package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;

import conecta.demo.dto.ReservaRequest;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Sala;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.service.ReservaService;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * Verifica a disputa entre duas instancias independentes do servico.
 *
 * <p>Cada contexto possui seu proprio proxy transacional e seu proprio
 * {@code synchronized}; portanto, o resultado nao pode depender do monitor de
 * uma unica instancia Java. As duas operacoes usam o mesmo PostgreSQL e a
 * mesma linha de sala, adquirindo o bloqueio pessimista antes da consulta de
 * conflito.</p>
 */
class PostgresReservationConcurrencyTest {

    private static EmbeddedPostgres postgres;
    private static String jdbcUrl;

    @BeforeAll
    static void iniciarPostgres() throws Exception {
        postgres = EmbeddedPostgres.start();
        jdbcUrl = postgres.getJdbcUrl("postgres", "postgres");
    }

    @AfterAll
    static void encerrarPostgres() throws Exception {
        if (postgres != null) postgres.close();
    }

    @Test
    void duasTransacoesIndependentesNaoPersistemReservasConflitantes() throws Exception {
        ConfigurableApplicationContext contextoA = contexto();
        ConfigurableApplicationContext contextoB = contexto();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch inicio = new CountDownLatch(1);

        try {
            Sala sala = new Sala();
            sala.setId(97001L);
            sala.setNome("Sala concorrencia");
            sala.setTipo("Sala");
            sala.setCapacidade(20);
            sala.setUnidadeId(97001L);
            sala.setAtiva(true);
            sala.setTurnosDisponiveis(List.of("Matutino"));
            contextoA.getBean(SalaRepository.class).saveAndFlush(sala);

            ReservaRequest request = new ReservaRequest(
                    sala.getId(), null, "Matutino", Set.of("seg"),
                    LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 7),
                    "08:00", "10:00", null, sala.getUnidadeId());

            ReservaService serviceA = contextoA.getBean(ReservaService.class);
            ReservaService serviceB = contextoB.getBean(ReservaService.class);

            Future<Boolean> resultadoA = executor.submit(() -> executar(serviceA, request, inicio));
            Future<Boolean> resultadoB = executor.submit(() -> executar(serviceB, request, inicio));
            inicio.countDown();

            assertThat(resultadoA.get(30, TimeUnit.SECONDS))
                    .isNotEqualTo(resultadoB.get(30, TimeUnit.SECONDS));

            long persistidas = contextoA.getBean(ReservaRepository.class)
                    .findBySalaIdAndDataInicioLessThanEqualAndDataFimGreaterThanEqual(
                            sala.getId(), request.dataFim(), request.dataInicio())
                    .stream()
                    .filter(r -> "Matutino".equalsIgnoreCase(r.getTurno()))
                    .count();
            assertThat(persistidas).isEqualTo(1);
        } finally {
            executor.shutdownNow();
            contextoB.close();
            contextoA.close();
        }
    }

    private boolean executar(ReservaService service, ReservaRequest request,
                             CountDownLatch inicio) {
        try {
            inicio.await(10, TimeUnit.SECONDS);
            service.criar(request);
            return true;
        } catch (RegraDeNegocioException ex) {
            return false;
        } catch (Exception ex) {
            throw new IllegalStateException("Falha na operacao concorrente", ex);
        }
    }

    private ConfigurableApplicationContext contexto() {
        return new SpringApplicationBuilder(DemoApplication.class)
                .web(WebApplicationType.NONE)
                .profiles("test")
                .properties(
                        "spring.datasource.url=" + jdbcUrl,
                        "spring.datasource.username=postgres",
                        "spring.datasource.password=postgres",
                        "spring.datasource.driver-class-name=org.postgresql.Driver",
                        "spring.jpa.hibernate.ddl-auto=update",
                        "spring.main.web-application-type=none")
                .run();
    }
}
