package conecta.demo.service;

import conecta.demo.model.IdSequence;
import conecta.demo.repository.IdSequenceRepository;
import java.util.function.LongSupplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import javax.sql.DataSource;
import java.sql.SQLException;

/** Aloca IDs monotonicos por colecao com lock no banco. */
@Service
public class IdAllocatorService {
    private final IdSequenceRepository sequences;
    private final DataSource dataSource;

    public IdAllocatorService(IdSequenceRepository sequences, DataSource dataSource) {
        this.sequences = sequences;
        this.dataSource = dataSource;
    }

    /**
     * Creates the allocator rows before the first request. Existing rows are
     * never reset, so this is safe for databases that already contain data.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void initializeCollections() {
        for (String collection : java.util.List.of("usuarios", "unidades", "salas", "turmas",
                "reservas", "chaves", "notificacoes", "solicitacoes")) {
            if (isPostgres()) sequences.insertIfAbsentPostgres(collection, 1L);
            else sequences.insertIfAbsent(collection, 1L);
        }
    }

    private boolean isPostgres() {
        try (var connection = dataSource.getConnection()) {
            return connection.getMetaData().getDatabaseProductName().toLowerCase(java.util.Locale.ROOT)
                    .contains("postgres");
        } catch (SQLException ex) {
            throw new IllegalStateException("Nao foi possivel identificar o banco de dados", ex);
        }
    }

    @Transactional
    public long next(String collection, LongSupplier currentMax) {
        long first = Math.max(1L, currentMax.getAsLong() + 1L);
        IdSequence sequence = sequences.findForUpdate(collection)
                .orElseThrow(() -> new IllegalStateException("Sequencia nao inicializada: " + collection));
        long candidate = Math.max(sequence.getNextId(), Math.max(1L, currentMax.getAsLong() + 1L));
        sequence.setNextId(candidate + 1L);
        sequences.save(sequence);
        return candidate;
    }
}
