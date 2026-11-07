package conecta.demo;

import conecta.demo.service.IdAllocatorService;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class IdAllocatorConcurrencyTest {
    @Autowired
    private IdAllocatorService allocator;

    @Test
    void duasAlocacoesConcorrentesDaMesmaColecaoNaoColidem() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch inicio = new CountDownLatch(1);
        try {
            Future<Long> primeira = pool.submit(() -> {
                inicio.await();
                return allocator.next("usuarios", () -> 0L);
            });
            Future<Long> segunda = pool.submit(() -> {
                inicio.await();
                return allocator.next("usuarios", () -> 0L);
            });
            inicio.countDown();
            Set<Long> ids = Set.of(primeira.get(), segunda.get());
            assertThat(ids).hasSize(2);
        } finally {
            pool.shutdownNow();
        }
    }
}
