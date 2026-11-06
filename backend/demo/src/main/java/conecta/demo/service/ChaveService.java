package conecta.demo.service;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Chave;
import conecta.demo.model.StatusChave;
import conecta.demo.repository.ChaveRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.UsuarioRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ChaveService {
    private final ChaveRepository chaves;
    private final SalaRepository salas;
    private final UsuarioRepository usuarios;
    private final IdAllocatorService ids;

    public ChaveService(ChaveRepository chaves, SalaRepository salas, UsuarioRepository usuarios) {
        this(chaves, salas, usuarios, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ChaveService(ChaveRepository chaves, SalaRepository salas, UsuarioRepository usuarios,
                        IdAllocatorService ids) {
        this.chaves = chaves;
        this.salas = salas;
        this.usuarios = usuarios;
        this.ids = ids;
    }

    @Transactional(readOnly = true)
    public List<Chave> listar(Long unidadeId) {
        return unidadeId == null ? chaves.findAll() : chaves.findByUnidadeId(unidadeId);
    }

    @Transactional(readOnly = true)
    public Chave buscar(Long id) {
        return chaves.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Chave", id));
    }

    public Chave criar(Chave chave) {
        validar(chave, null);
        chave.setId(proximoId());
        return chaves.save(chave);
    }

    /** Valida uma chave sincronizada sem persisti-la. */
    void validarParaSincronizacao(Chave chave, Long ignorarId) {
        validar(chave, ignorarId);
    }

    private Long proximoId() {
        if (ids != null) return ids.next("chaves", () -> chaves.findAll().stream().mapToLong(Chave::getId).max().orElse(0L));
        return chaves.findAll().stream().mapToLong(Chave::getId).max().orElse(0L) + 1;
    }

    public Chave atualizar(Long id, Chave entrada) {
        Chave atual = buscar(id);
        validar(entrada, id);
        atual.setCodigo(entrada.getCodigo());
        atual.setSalaId(entrada.getSalaId());
        atual.setAndar(entrada.getAndar());
        atual.setUnidadeId(entrada.getUnidadeId());
        return chaves.save(atual);
    }

    public Chave retirar(Long id, Long instrutorId) {
        Chave chave = buscar(id);
        if (chave.getStatus() == StatusChave.RETIRADA)
            throw new RegraDeNegocioException("A chave ja esta retirada");
        var instrutor = usuarios.findById(instrutorId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Instrutor", instrutorId));
        if (instrutor.getPerfil() != conecta.demo.model.Perfil.INSTRUTOR
                && instrutor.getPerfil() != conecta.demo.model.Perfil.ADMIN)
            throw new RegraDeNegocioException("Usuario nao possui perfil de instrutor");
        if (!instrutor.getUnidadeId().equals(chave.getUnidadeId()))
            throw new RegraDeNegocioException("Instrutor pertence a outra unidade");
        chave.setStatus(StatusChave.RETIRADA);
        chave.setInstrutorId(instrutorId);
        chave.setPegaEm(Instant.now());
        return chaves.save(chave);
    }

    public Chave devolver(Long id) {
        Chave chave = buscar(id);
        chave.setStatus(StatusChave.DISPONIVEL);
        chave.setInstrutorId(null);
        chave.setPegaEm(null);
        return chaves.save(chave);
    }

    public void excluir(Long id) {
        chaves.delete(buscar(id));
    }

    private void validar(Chave chave, Long ignorarId) {
        if (chave.getCodigo() == null || chave.getCodigo().isBlank()
                || chave.getSalaId() == null || chave.getUnidadeId() == null)
            throw new RegraDeNegocioException("Codigo, sala e unidade da chave sao obrigatorios");
        chaves.findByCodigo(chave.getCodigo().trim()).ifPresent(existente -> {
            if (ignorarId == null || !existente.getId().equals(ignorarId))
                throw new RegraDeNegocioException("Ja existe uma chave com este codigo");
        });
        var sala = salas.findById(chave.getSalaId()).orElseThrow(() -> new RecursoNaoEncontradoException("Sala", chave.getSalaId()));
        if (!sala.getUnidadeId().equals(chave.getUnidadeId()))
            throw new RegraDeNegocioException("A sala nao pertence a unidade informada");
    }
}
