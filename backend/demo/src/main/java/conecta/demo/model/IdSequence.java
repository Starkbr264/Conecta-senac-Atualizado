package conecta.demo.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "id_sequences")
public class IdSequence {
    @Id
    @Column(name = "collection_key", length = 64)
    private String collectionKey;

    @Column(name = "next_id", nullable = false)
    private long nextId;

    @Version
    private long version;

    protected IdSequence() { }

    public IdSequence(String collectionKey, long nextId) {
        this.collectionKey = collectionKey;
        this.nextId = nextId;
    }

    public String getCollectionKey() {
        return collectionKey;
    }

    public long getNextId() {
        return nextId;
    }

    public void setNextId(long nextId) {
        this.nextId = nextId;
    }
}
