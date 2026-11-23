package conecta.demo;

import static org.junit.jupiter.api.Assertions.assertEquals;

import conecta.demo.repository.SincOperacaoRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.service.SincService;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class SincIdempotencyConcurrencyTest {

    @Autowired
    private SincService sinc;

    @Autowired
    private UnidadeRepository unidades;

    @Autowired
    private SincOperacaoRepository operacoes;

    @Test
    void duasRequisicoesConcorrentesExecutamUmaUnicaOperacao() throws Exception {
        String nome = "Unidade concorrente " + System.nanoTime();
        Map<String, Object> item = new HashMap<>();
        item.put("id", 99881L);
        item.put("nome", nome);
        item.put("cep", "70000-001");
        item.put("cidade", "Brasilia/DF");
        item.put("endereco", "SCS");
        Map<String, Object> criados = new HashMap<>();
        criados.put("unidades", new ArrayList<>(List.of(item)));
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("operacaoId", "concorrente-" + System.nanoTime());
        corpo.put("userId", 1L);
        corpo.put("criados", criados);
        var barreira = new CyclicBarrier(2);
        var executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> primeira = executor.submit(() -> executar(corpo, barreira));
            Future<?> segunda = executor.submit(() -> executar(corpo, barreira));
            primeira.get();
            segunda.get();
        } finally {
            executor.shutdownNow();
            SecurityContextHolder.clearContext();
        }

        assertEquals(1, unidades.findByNomeIgnoreCase(nome).size());
        assertEquals(1, operacoes.findAll().stream()
                .filter(op -> op.getId().equals(corpo.get("operacaoId")))
                .count());
    }

    private void executar(Map<String, Object> corpo, CyclicBarrier barreira) {
        var auth = new TestingAuthenticationToken("admin@senac.test", "n/a", "ROLE_ADMIN");
        auth.setDetails(Map.of("userId", 1L));
        SecurityContextHolder.getContext().setAuthentication(auth);
        try {
            barreira.await();
            sinc.sincronizar(copiar(corpo));
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> copiar(Map<String, Object> original) {
        Map<String, Object> copia = new HashMap<>(original);
        Map<String, Object> criados = new HashMap<>((Map<String, Object>) original.get("criados"));
        Map<String, Object> item = new HashMap<>(
                (Map<String, Object>) ((List<Object>) criados.get("unidades")).get(0));
        criados.put("unidades", new ArrayList<>(List.of(item)));
        copia.put("criados", criados);
        return copia;
    }
}
