package conecta.demo.repository;

import conecta.demo.model.SincOperacao;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import org.hibernate.Session;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Reserva um id global antes dos efeitos. Em PostgreSQL usa advisory lock
 * transacional, que funciona entre instancias do backend. H2 usa um lock local
 * apenas para manter os testes deterministas.
 */
@Repository
public class SincOperacaoRepositoryImpl implements SincOperacaoRepositoryCustom {
    private static final Map<String, ReentrantLock> LOCKS = new ConcurrentHashMap<>();
    private static final ThreadLocal<Set<String>> LOCKS_DA_THREAD =
            ThreadLocal.withInitial(java.util.HashSet::new);

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public int reservar(String id, Long usuarioId, String respostaInicial) {
        if (id == null || id.isBlank() || usuarioId == null || usuarioId <= 0) return 0;
        if (isPostgres()) {
            entityManager.unwrap(Session.class).doWork(connection -> {
                try (var statement = connection.prepareStatement(
                        "SELECT pg_advisory_xact_lock(hashtext(?))")) {
                    statement.setString(1, id);
                    statement.execute();
                }
            });
        } else {
            adquirirLockLocal(id);
        }

        if (entityManager.find(SincOperacao.class, id) != null) return 0;
        entityManager.persist(new SincOperacao(id, usuarioId, respostaInicial));
        entityManager.flush();
        return 1;
    }

    private boolean isPostgres() {
        return entityManager.unwrap(Session.class).doReturningWork(
                connection -> "PostgreSQL".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName()));
    }

    private void adquirirLockLocal(String id) {
        Set<String> meus = LOCKS_DA_THREAD.get();
        if (!meus.add(id)) return;
        ReentrantLock lock = LOCKS.computeIfAbsent(id, ignored -> new ReentrantLock());
        lock.lock();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    lock.unlock();
                    meus.remove(id);
                    if (meus.isEmpty()) LOCKS_DA_THREAD.remove();
                }
            });
        } else {
            lock.unlock();
            meus.remove(id);
        }
    }
}
