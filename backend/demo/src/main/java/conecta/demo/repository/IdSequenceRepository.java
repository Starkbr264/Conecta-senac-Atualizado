package conecta.demo.repository;

import conecta.demo.model.IdSequence;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface IdSequenceRepository extends JpaRepository<IdSequence, String> {
    @Modifying
    @Query(value = "INSERT INTO id_sequences (collection_key, next_id, version) "
            + "SELECT :key, :nextId, 0 WHERE NOT EXISTS "
            + "(SELECT 1 FROM id_sequences WHERE collection_key = :key)", nativeQuery = true)
    int insertIfAbsent(@Param("key") String key, @Param("nextId") long nextId);

    @Modifying
    @Query(value = "INSERT INTO id_sequences (collection_key, next_id, version) "
            + "VALUES (:key, :nextId, 0) ON CONFLICT (collection_key) DO NOTHING", nativeQuery = true)
    int insertIfAbsentPostgres(@Param("key") String key, @Param("nextId") long nextId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from IdSequence s where s.collectionKey = :key")
    Optional<IdSequence> findForUpdate(@Param("key") String key);
}
