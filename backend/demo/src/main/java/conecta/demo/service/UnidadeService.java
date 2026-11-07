package conecta.demo.service;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Unidade;
import conecta.demo.repository.ChaveRepository;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Regras de negocio da entidade {@code Unidade}.
 *
 * <p>A unidade e a chave de particionamento do sistema: toda sala, turma,
 * reserva, chave, solicitacao e usuario aponta para uma unidade. As colunas
 * {@code *_unidade_id} nao tem chave estrangeira no banco, portanto o
 * proprio servico precisa garantir a integridade referencial — sem isso a
 * exclusao de uma unidade deixa registros orfaos, invisiveis para qualquer
 * filtro por unidade.
 */
@Service
@Transactional
public class UnidadeService {
    private final UnidadeRepository unidades;
    private final UsuarioRepository usuarios;
    private final SalaRepository salas;
    private final TurmaRepository turmas;
    private final ReservaRepository reservas;
    private final ChaveRepository chaves;
    private final SolicitacaoRepository solicitacoes;
    private final IdAllocatorService ids;

    @org.springframework.beans.factory.annotation.Autowired
    public UnidadeService(UnidadeRepository unidades,
                          UsuarioRepository usuarios,
                          SalaRepository salas,
                          TurmaRepository turmas,
                          ReservaRepository reservas,
                          ChaveRepository chaves,
                          SolicitacaoRepository solicitacoes) {
        this(unidades, usuarios, salas, turmas, reservas, chaves, solicitacoes, null);
    }

    public UnidadeService(UnidadeRepository unidades,
                          UsuarioRepository usuarios,
                          SalaRepository salas,
                          TurmaRepository turmas,
                          ReservaRepository reservas,
                          ChaveRepository chaves,
                          SolicitacaoRepository solicitacoes,
                          IdAllocatorService ids) {
        this.unidades = unidades;
        this.usuarios = usuarios;
        this.salas = salas;
        this.turmas = turmas;
        this.reservas = reservas;
        this.chaves = chaves;
        this.solicitacoes = solicitacoes;
        this.ids = ids;
    }

    @Transactional(readOnly = true)
    public List<Unidade> listar() {
        return unidades.findAll();
    }

    @Transactional(readOnly = true)
    public Unidade buscar(Long id) {
        return unidades.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Unidade", id));
    }

    public Unidade criar(Unidade unidade) {
        validarParaSincronizacao(unidade, null);
        unidade.setId(proximoId());
        return unidades.save(unidade);
    }

    /** Valida e normaliza uma unidade sincronizada sem persisti-la. */
    void validarParaSincronizacao(Unidade unidade, Long ignorarId) {
        exigirNomeUnico(unidade.getNome(), ignorarId);
        unidade.setCep(normalizarCep(unidade.getCep()));
    }

    private Long proximoId() {
        if (ids != null) return ids.next("unidades", () -> unidades.findAll().stream().mapToLong(Unidade::getId).max().orElse(0L));
        return unidades.findAll().stream().mapToLong(Unidade::getId).max().orElse(0L) + 1;
    }

    public Unidade atualizar(Long id, Unidade entrada) {
        Unidade atual = buscar(id);
        validarParaSincronizacao(entrada, id);
        atual.setNome(entrada.getNome());
        atual.setCep(entrada.getCep());
        atual.setCidade(entrada.getCidade());
        atual.setEndereco(entrada.getEndereco());
        return unidades.save(atual);
    }

    private String normalizarCep(String cep) {
        if (cep == null || cep.isBlank())
            throw new RegraDeNegocioException("CEP deve conter 8 digitos");
        String digitos = cep.replaceAll("\\D", "");
        if (!cep.matches("^(\\d{8}|\\d{5}-\\d{3})$"))
            throw new RegraDeNegocioException("CEP deve conter 8 digitos");
        return digitos.substring(0, 5) + "-" + digitos.substring(5);
    }

    /**
     * Exclui a unidade somente quando nenhum registro a referencia.
     *
     * @throws RegraDeNegocioException (HTTP 409) se houver referencia
     */
    public void excluir(Long id) {
        Unidade unidade = buscar(id);
        List<String> pendencias = referenciasPendentes(id);
        if (!pendencias.isEmpty())
            throw new RegraDeNegocioException(
                    "Unidade possui registros vinculados: " + String.join(", ", pendencias));
        unidades.delete(unidade);
    }

    /**
     * Lista as colecoes que ainda apontam para a unidade.
     *
     * <p>Cada item da lista e o rotulo da colecao com ao menos um registro
     * apontando para a unidade.
     */
    private List<String> referenciasPendentes(Long unidadeId) {
        List<String> pendencias = new java.util.ArrayList<>();
        if (!usuarios.findByUnidadeId(unidadeId).isEmpty()) pendencias.add("usuarios");
        if (!salas.findByUnidadeId(unidadeId).isEmpty()) pendencias.add("salas");
        if (!turmas.findByUnidadeId(unidadeId).isEmpty()) pendencias.add("turmas");
        if (!reservas.findByUnidadeId(unidadeId).isEmpty()) pendencias.add("reservas");
        if (!chaves.findByUnidadeId(unidadeId).isEmpty()) pendencias.add("chaves");
        if (!solicitacoes.findByUnidadeId(unidadeId).isEmpty()) pendencias.add("solicitacoes");
        return pendencias;
    }

    /**
     * Impede duas unidades com o mesmo nome (o nome e a chave visivel no
     * seletor de unidade do login).
     *
     * @param ignorarId id da propria unidade em atualizacao, ou {@code null}
     */
    private void exigirNomeUnico(String nome, Long ignorarId) {
        if (nome == null || nome.isBlank()) return;
        String alvo = nome.trim().toLowerCase(Locale.ROOT);
        boolean duplicada = unidades.findByNomeIgnoreCase(nome.trim()).stream()
                .anyMatch(u -> ignorarId == null || !u.getId().equals(ignorarId));
        if (duplicada)
            throw new RegraDeNegocioException("Ja existe uma unidade com este nome");
    }
}
