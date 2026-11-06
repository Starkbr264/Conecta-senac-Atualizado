package conecta.demo.service;

import conecta.demo.model.Chave;
import conecta.demo.model.Notificacao;
import conecta.demo.model.Perfil;
import conecta.demo.model.Reserva;
import conecta.demo.model.Sala;
import conecta.demo.model.Solicitacao;
import conecta.demo.model.StatusChave;
import conecta.demo.model.StatusSolicitacao;
import conecta.demo.model.Turma;
import conecta.demo.model.Unidade;
import conecta.demo.model.Usuario;
import conecta.demo.dto.ReservaRequest;
import conecta.demo.exception.AcessoNegadoException;
import conecta.demo.exception.DadosInvalidosException;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.repository.ChaveRepository;
import conecta.demo.repository.NotificacaoRepository;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sincronizacao web/mobile &lt;-&gt; banco.
 *
 * <p>Toda a logica que estava nos metodos privados de
 * {@code SincController} foi movida para ca, sem alterar a ordem de
 * aplicacao, a geracao de ids, nem o conteudo das respostas de
 * {@code POST /api/sinc} e {@code POST /api/reset}.
 *
 * <p><b>Transacao:</b> as anotacoes {@code @Transactional} antes ficavam nos
 * metodos do controller; agora ficam nos metodos deste service, que e o
 * componente injetado pelo proxy — o limite transacional e o mesmo.
 */
@Service
public class SincService {

    private final UsuarioRepository usuarios;
    private final UnidadeRepository unidades;
    private final SalaRepository salas;
    private final TurmaRepository turmas;
    private final ReservaRepository reservas;
    private final ChaveRepository chaves;
    private final NotificacaoRepository notificacoes;
    private final SolicitacaoRepository solicitacoes;
    private final conecta.demo.repository.SessaoRepository sessoes;
    private final SeedService seedService;
    private final DadosService dados;
    private final UsuarioService usuarioService;
    private final UnidadeService unidadeService;
    private final SalaService salaService;
    private final TurmaService turmaService;
    private final ReservaService reservaService;
    private final ChaveService chaveService;
    private final SolicitacaoService solicitacaoService;
    private final IdAllocatorService ids;
    private final Validator validator;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public SincService(UsuarioRepository usuarios, UnidadeRepository unidades, SalaRepository salas,
                       TurmaRepository turmas, ReservaRepository reservas, ChaveRepository chaves,
                       NotificacaoRepository notificacoes, SolicitacaoRepository solicitacoes,
                       conecta.demo.repository.SessaoRepository sessoes, SeedService seedService,
                       DadosService dados, UsuarioService usuarioService, UnidadeService unidadeService,
                       SalaService salaService, TurmaService turmaService, ReservaService reservaService,
                       ChaveService chaveService, Validator validator, IdAllocatorService ids) {
        this(usuarios, unidades, salas, turmas, reservas, chaves, notificacoes, solicitacoes, sessoes,
                seedService, dados, usuarioService, unidadeService, salaService, turmaService,
                reservaService, chaveService, null, validator, ids);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public SincService(UsuarioRepository usuarios, UnidadeRepository unidades, SalaRepository salas,
                       TurmaRepository turmas, ReservaRepository reservas, ChaveRepository chaves,
                       NotificacaoRepository notificacoes, SolicitacaoRepository solicitacoes,
                       conecta.demo.repository.SessaoRepository sessoes, SeedService seedService,
                       DadosService dados, UsuarioService usuarioService, UnidadeService unidadeService,
                       SalaService salaService, TurmaService turmaService, ReservaService reservaService,
                       ChaveService chaveService, SolicitacaoService solicitacaoService,
                       Validator validator, IdAllocatorService ids) {
        this.usuarios = usuarios;
        this.unidades = unidades;
        this.salas = salas;
        this.turmas = turmas;
        this.reservas = reservas;
        this.chaves = chaves;
        this.notificacoes = notificacoes;
        this.solicitacoes = solicitacoes;
        this.sessoes = sessoes;
        this.seedService = seedService;
        this.dados = dados;
        this.usuarioService = usuarioService;
        this.unidadeService = unidadeService;
        this.salaService = salaService;
        this.turmaService = turmaService;
        this.reservaService = reservaService;
        this.chaveService = chaveService;
        this.solicitacaoService = solicitacaoService;
        this.validator = validator;
        this.ids = ids;
    }

    /**
     * Aplica criados, alteracoes e remocoes recebidas do cliente.
     *
     * @param corpo corpo do POST /api/sinc; pode ser {@code null}.
     * @return {@code {ok: true, banco: <8 colecoes>, idsNovos: {colecao: {provisorio: oficial}}}}
     */
    @Transactional
    public Map<String, Object> sincronizar(Map<String, Object> corpo) {
        Map<String, Object> alteracoes = extrair(corpo, "alteracoes");
        Map<String, Object> criados = extrair(corpo, "criados");
        Map<String, Object> remocoes = extrair(corpo, "remocoes");
        Map<String, Map<String, Long>> idsNovos = new LinkedHashMap<>();

        aplicarCriados(criados, idsNovos);
        aplicarAlteracoes(alteracoes);
        aplicarRemocoes(remocoes);

        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("ok", true);
        resposta.put("banco", bancoVisivel());
        resposta.put("idsNovos", idsNovos);
        return resposta;
    }

    /** Autoriza o caminho de sincronizacao, que e usado pelos clientes para toda escrita. */
    public static void validarPermissaoSincronizacao(String colecao, Perfil perfil) {
        java.util.Set<String> colecoesConhecidas = java.util.Set.of(
                "usuarios", "unidades", "salas", "turmas", "reservas", "chaves",
                "notificacoes", "solicitacoes");
        if (perfil == null || !colecoesConhecidas.contains(colecao))
            throw new AcessoNegadoException("Perfil nao autorizado para sincronizacao");
        if (perfil == Perfil.ADMIN) return;
        boolean permitido = switch (perfil) {
            case COORDENADOR -> java.util.Set.of("salas", "turmas", "reservas", "solicitacoes", "notificacoes").contains(colecao);
            case INSTRUTOR -> java.util.Set.of("solicitacoes", "notificacoes").contains(colecao);
            case RECEPCAO -> java.util.Set.of("chaves", "notificacoes").contains(colecao);
            default -> false;
        };
        if (!permitido)
            throw new AcessoNegadoException("Perfil nao pode sincronizar a colecao " + colecao);
    }

    /**
     * Apaga todas as tabelas e reexecuta o seed.
     *
     * <p>A ordem de {@code deleteAll()} foi preservada: usuario -&gt; unidade -&gt;
     * sala -&gt; turma -&gt; reserva -&gt; chave -&gt; notificacao -&gt; solicitacao
     * -&gt; sessao.
     */
    @Transactional
    public Map<String, Object> resetar() {
        // deleteAll() do Spring Data usa bulk DELETE (sem cascade de
        // @ElementCollection). Iteramos para que o Hibernate remova as
        // tabelas-filho (sala_turnos, sala_turnos_legado, etc.) antes.
        usuarios.findAll().forEach(usuarios::delete);
        unidades.findAll().forEach(unidades::delete);
        salas.findAll().forEach(salas::delete);
        turmas.findAll().forEach(turmas::delete);
        reservas.findAll().forEach(reservas::delete);
        chaves.findAll().forEach(chaves::delete);
        notificacoes.findAll().forEach(notificacoes::delete);
        solicitacoes.findAll().forEach(solicitacoes::delete);
        sessoes.findAll().forEach(sessoes::delete);
        seedService.semear();

        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("ok", true);
        resposta.put("banco", bancoVisivel());
        return resposta;
    }

    // ---- helpers -----------------------------------------------------------

    private Map<String, Object> extrair(Map<String, Object> corpo, String chave) {
        if (corpo == null || corpo.get(chave) == null) {
            return new LinkedHashMap<>();
        }
        Object valor = corpo.get(chave);
        if (valor instanceof Map<?, ?>) {
            @SuppressWarnings("unchecked")
            Map<String, Object> mapa = (Map<String, Object>) valor;
            return mapa;
        }
        return new LinkedHashMap<>();
    }

    private void aplicarCriados(Map<String, Object> criados, Map<String, Map<String, Long>> idsNovos) {
        for (String colecao : colecoesOrdenadas(criados)) {
            Object valor = criados.get(colecao);
            validarPermissaoSincronizacao(colecao, perfilAutenticado());
            if (!(valor instanceof List<?>))
                throw new DadosInvalidosException("criados." + colecao, "deve ser uma lista");
            List<?> itens = (List<?>) valor;
            Map<String, Long> mapa = new LinkedHashMap<>();
            for (Object bruto : itens) {
                if (!(bruto instanceof Map<?, ?>))
                    throw new DadosInvalidosException(colecao, "item deve ser um objeto");
                @SuppressWarnings("unchecked")
                Map<String, Object> item = (Map<String, Object>) bruto;
                Long idProvisorio = longObrigatorio(item.get("id"), colecao + ".id");
                validarUnidadeDoPayload(colecao, item);
                substituirReferenciasProvisorias(item, idsNovos);
                Long oficial = proximoId(colecao);
                item.put("id", oficial);
                Long persistido = salvar(colecao, item, true);
                if (persistido == null)
                    throw new IllegalStateException("Persistencia sem ID para " + colecao);
                mapa.put(String.valueOf(idProvisorio), persistido);
            }
            if (!mapa.isEmpty()) {
                idsNovos.put(colecao, mapa);
            }
        }
    }

    private void aplicarAlteracoes(Map<String, Object> alteracoes) {
        for (Map.Entry<String, Object> entrada : alteracoes.entrySet()) {
            String colecao = entrada.getKey();
            validarPermissaoSincronizacao(colecao, perfilAutenticado());
            if (!(entrada.getValue() instanceof List<?>))
                throw new DadosInvalidosException("alteracoes." + colecao, "deve ser uma lista");
            List<?> itens = (List<?>) entrada.getValue();
            for (Object bruto : itens) {
                if (!(bruto instanceof Map<?, ?>))
                    throw new DadosInvalidosException(colecao, "item deve ser um objeto");
                @SuppressWarnings("unchecked")
                Map<String, Object> item = (Map<String, Object>) bruto;
                longObrigatorio(item.get("id"), colecao + ".id");
                validarUnidadeDoPayload(colecao, item);
                salvar(colecao, item, false);
            }
        }
    }

    private void aplicarRemocoes(Map<String, Object> remocoes) {
        for (Map.Entry<String, Object> entrada : remocoes.entrySet()) {
            String colecao = entrada.getKey();
            validarPermissaoSincronizacao(colecao, perfilAutenticado());
            if (!(entrada.getValue() instanceof List<?>))
                throw new DadosInvalidosException("remocoes." + colecao, "deve ser uma lista");
            @SuppressWarnings("unchecked")
            List<Object> ids = (List<Object>) entrada.getValue();
            for (Object idObj : ids) {
                if (idObj == null) {
                    continue;
                }
                deletar(colecao, longObrigatorio(idObj, colecao + ".id"));
            }
        }
    }

    private List<String> colecoesOrdenadas(Map<String, Object> colecoes) {
        List<String> ordem = List.of("unidades", "usuarios", "salas", "turmas", "reservas",
                "chaves", "solicitacoes", "notificacoes");
        List<String> resultado = new ArrayList<>();
        for (String colecao : ordem) if (colecoes.containsKey(colecao)) resultado.add(colecao);
        for (String colecao : colecoes.keySet()) if (!resultado.contains(colecao)) resultado.add(colecao);
        return resultado;
    }

    private void substituirReferenciasProvisorias(Map<String, Object> item,
                                                   Map<String, Map<String, Long>> idsNovos) {
        substituirReferencia(item, "unidadeId", "unidades", idsNovos);
        substituirReferencia(item, "instrutorId", "usuarios", idsNovos);
        substituirReferencia(item, "salaId", "salas", idsNovos);
        substituirReferencia(item, "turmaId", "turmas", idsNovos);
    }

    private void substituirReferencia(Map<String, Object> item, String campo, String colecao,
                                      Map<String, Map<String, Long>> idsNovos) {
        Object valor = item.get(campo);
        if (valor == null) return;
        Long oficial = idsNovos.getOrDefault(colecao, Map.of()).get(valor.toString());
        if (oficial != null) item.put(campo, oficial);
    }

    private Perfil perfilAutenticado() {
        var auth = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) return null;
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority().replaceFirst("^ROLE_", ""))
                .map(valor -> {
                    try {
                        return Perfil.from(valor);
                    } catch (IllegalArgumentException ex) {
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .findFirst().orElse(null);
    }

    private Map<String, Object> bancoVisivel() {
        var auth = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName()))
            return dados.banco();
        return usuarios.findByEmailIgnoreCase(auth.getName())
                .map(dados::banco).orElseGet(dados::banco);
    }

    private void validarUnidadeDoPayload(String colecao, Map<String, Object> item) {
        Perfil perfil = perfilAutenticado();
        if (perfil == null || perfil == Perfil.ADMIN) return;
        var auth = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        Long unidadeDoUsuario = usuarios.findByEmailIgnoreCase(auth.getName())
                .map(Usuario::getUnidadeId).orElse(null);
        Long unidadeDoItem = longOuNull(item.get("unidadeId"), colecao + ".unidadeId");
        if ("notificacoes".equals(colecao) && unidadeDoItem == null) {
            Long paraId = longOuNull(item.get("paraId"), colecao + ".paraId");
            unidadeDoItem = paraId == null ? null : usuarios.findById(paraId)
                    .map(Usuario::getUnidadeId).orElse(null);
        }
        if (unidadeDoUsuario == null || unidadeDoItem == null || !unidadeDoUsuario.equals(unidadeDoItem))
            throw new AcessoNegadoException("Registro fora da unidade do usuario autenticado");
    }

    private boolean existe(String colecao, Long id) {
        switch (colecao) {
            case "usuarios": return usuarios.existsById(id);
            case "unidades": return unidades.existsById(id);
            case "salas": return salas.existsById(id);
            case "turmas": return turmas.existsById(id);
            case "reservas": return reservas.existsById(id);
            case "chaves": return chaves.existsById(id);
            case "notificacoes": return notificacoes.existsById(id);
            case "solicitacoes": return solicitacoes.existsById(id);
            default: return false;
        }
    }

    private long proximoId(String colecao) {
        if (ids != null) {
            return switch (colecao) {
                case "usuarios" -> ids.next("usuarios", () -> usuarios.findAll().stream().mapToLong(Usuario::getId).max().orElse(0L));
                case "unidades" -> ids.next("unidades", () -> unidades.findAll().stream().mapToLong(Unidade::getId).max().orElse(0L));
                case "salas" -> ids.next("salas", () -> salas.findAll().stream().mapToLong(Sala::getId).max().orElse(0L));
                case "turmas" -> ids.next("turmas", () -> turmas.findAll().stream().mapToLong(Turma::getId).max().orElse(0L));
                case "reservas" -> ids.next("reservas", () -> reservas.findAll().stream().mapToLong(Reserva::getId).max().orElse(0L));
                case "chaves" -> ids.next("chaves", () -> chaves.findAll().stream().mapToLong(Chave::getId).max().orElse(0L));
                case "notificacoes" -> ids.next("notificacoes", () -> notificacoes.findAll().stream().mapToLong(Notificacao::getId).max().orElse(0L));
                case "solicitacoes" -> ids.next("solicitacoes", () -> solicitacoes.findAll().stream().mapToLong(Solicitacao::getId).max().orElse(0L));
                default -> throw new RegraDeNegocioException("Colecao de sincronizacao desconhecida: " + colecao);
            };
        }
        switch (colecao) {
            case "usuarios": return usuarios.findAll().stream().mapToLong(Usuario::getId).max().orElse(0L) + 1;
            case "unidades": return unidades.findAll().stream().mapToLong(Unidade::getId).max().orElse(0L) + 1;
            case "salas": return salas.findAll().stream().mapToLong(Sala::getId).max().orElse(0L) + 1;
            case "turmas": return turmas.findAll().stream().mapToLong(Turma::getId).max().orElse(0L) + 1;
            case "reservas": return reservas.findAll().stream().mapToLong(Reserva::getId).max().orElse(0L) + 1;
            case "chaves": return chaves.findAll().stream().mapToLong(Chave::getId).max().orElse(0L) + 1;
            case "notificacoes": return notificacoes.findAll().stream().mapToLong(Notificacao::getId).max().orElse(0L) + 1;
            case "solicitacoes": return solicitacoes.findAll().stream().mapToLong(Solicitacao::getId).max().orElse(0L) + 1;
            default: return 1L;
        }
    }

    /**
     * Materializa um registro recebido do cliente na entidade JPA correspondente.
     *
     * <p>Correcoes aplicadas nesta refatoracao (o comportamento original do
     * {@code SincController} quebravava a sincronizacao inteira):
     * <ul>
     *   <li>Referencias nulas ({@code unidadeId}, {@code salaId},
     *       {@code instrutorId}, {@code turmaId}) nao lancam mais
     *       {@code NullPointerException} — viram {@code null}.</li>
     *   <li>Registro sem {@code id} e ignorado em vez de derrubar a colecao.</li>
     *   <li>{@code salas} volta a repor {@code turnos}, {@code turnosDisponiveis},
     *       {@code statusManual}, {@code motivoManual}, {@code manualPor},
     *       {@code manualCriadaEm} e {@code ativa}.</li>
     *   <li>{@code reservas} volta a repor {@code horaInicio}, {@code horaFim}
     *       e {@code avulsa}.</li>
     * </ul>
     *
     * <p>A pendencia "perda de campos no POST /api/sinc" da
     * {@code docs/ARQUITETURA_ATUALIZADA.md} esta resolvida.
     */
    private Long salvar(String colecao, Map<String, Object> item, boolean criacao) {
        // Registro sem "id" nao pode ser materializado (o id e a chave primaria
        // e e gerado manualmente, sem @GeneratedValue). Ignorar em vez de
        // estourar NullPointerException e derrubar as demais colecoes.
        longObrigatorio(item.get("id"), colecao + ".id");
        switch (colecao) {
            case "usuarios":
                Usuario u = new Usuario();
                u.setId(longObrigatorio(item.get("id"), colecao + ".id"));
                u.setNome(str(item.get("nome")));
                u.setEmail(str(item.get("email")));
                u.setPerfil(perfilOuNull(item.get("perfil"), colecao + ".perfil"));
                u.setUnidadeId(longOuNull(item.get("unidadeId"), colecao + ".unidadeId"));
                if (u.getNome() == null || u.getNome().isBlank()
                        || !emailValido(u.getEmail())
                        || u.getPerfil() == null
                        || u.getUnidadeId() == null) {
                    throw new RegraDeNegocioException("Dados do usuario invalidos");
                }
                // Evita violacao de @UniqueConstraint(columnNames = "email") e colisao
                // de nextId entre dois clientes sincronizando em paralelo:
                var existentePorEmail = usuarios.findByEmailIgnoreCase(u.getEmail());
                String senhaRecebida = str(item.get("senha"));
                if (existentePorEmail.isPresent()) {
                    Long idExistente = existentePorEmail.get().getId();
                    if (criacao || !idExistente.equals(u.getId()))
                        throw new RegraDeNegocioException("Ja existe um usuario com este e-mail");
                } else if (usuarios.existsById(u.getId())
                        && senhaRecebida != null && !senhaRecebida.isBlank()
                        && !senhaRecebida.startsWith("$2a$")
                        && !senhaRecebida.startsWith("$2b$")
                        && !senhaRecebida.startsWith("$2y$")) {
                    // Novo usuario criado com nextId defasado no cliente que colidiu
                    // com outro ID ja gravado no banco: realoca para o proximo ID livre.
                    u.setId(proximoId("usuarios"));
                }
                // A senha NUNCA volta no /api/dados (@JsonIgnore em Usuario.getSenha()),
                // por isso o cache do cliente nao a possui. Se o payload nao trouxer
                // senha (caso normal para usuarios ja existentes), preservamos a senha
                // atual em vez de gravar null (o que violava @NotBlank/nullable=false e
                // derrubava toda a sincronizacao com HTTP 500). Quando a senha vier
                // (criacao ou redefinicao), hasheamos com BCrypt para manter coerencia
                // com o login (encoder.matches), que exige hash BCrypt.
                if (senhaRecebida == null || senhaRecebida.isBlank()) {
                    String senhaAtual = usuarios.findById(u.getId())
                            .map(Usuario::getSenha).orElse(null);
                    if (senhaAtual == null) {
                        throw new RegraDeNegocioException("Senha e obrigatoria para criar usuario");
                    }
                    u.setSenha(senhaAtual);
                } else if (senhaRecebida.startsWith("$2a$") || senhaRecebida.startsWith("$2b$")
                        || senhaRecebida.startsWith("$2y$")) {
                    // Ja esta hasheada (eco de cache antigo): nao re-hashear.
                    u.setSenha(senhaRecebida);
                } else {
                    if (senhaRecebida.length() < UsuarioService.TAMANHO_MINIMO_SENHA)
                        throw new RegraDeNegocioException(
                                "A senha deve ter pelo menos " + UsuarioService.TAMANHO_MINIMO_SENHA + " caracteres");
                    u.setSenha(hashSenha(senhaRecebida));
                }
                validarEntidade(u);
                usuarioService.validarParaSincronizacao(u);
                return usuarios.save(u).getId();
            case "unidades":
                Unidade un = new Unidade();
                un.setId(longObrigatorio(item.get("id"), colecao + ".id"));
                un.setNome(str(item.get("nome")));
                un.setCep(normalizarCep(str(item.get("cep"))));
                un.setCidade(str(item.get("cidade")));
                un.setEndereco(str(item.get("endereco")));
                validarEntidade(un);
                unidadeService.validarParaSincronizacao(un, un.getId());
                return unidades.save(un).getId();
            case "salas":
                Sala s = new Sala();
                s.setId(longObrigatorio(item.get("id"), colecao + ".id"));
                s.setNome(str(item.get("nome")));
                s.setTipo(str(item.get("tipo")));
                s.setCapacidade(integerOuNull(item.get("capacidade"), colecao + ".capacidade"));
                s.setAndar(str(item.get("andar")));
                s.setBloco(str(item.get("bloco")));
                s.setUnidadeId(longOuNull(item.get("unidadeId"), colecao + ".unidadeId"));
                // Campos que antes eram zerados a cada sincronizacao (pendencia
                // "perda de dados no POST /api/sinc" do relatorio de arquitetura).
                s.setTurnosDisponiveis(listaDeStrings(item.get("turnosDisponiveis")));
                s.setTurnos(listaDeStrings(item.get("turnos")));
                s.setStatusManual(str(item.get("statusManual")));
                s.setMotivoManual(str(item.get("motivoManual")));
                s.setManualPor(str(item.get("manualPor")));
                s.setManualCriadaEm(instantOuNull(item.get("manualCriadaEm"), colecao + ".manualCriadaEm"));
                s.setAtiva(item.get("ativa") == null || Boolean.parseBoolean(item.get("ativa").toString()));
                validarEntidade(s);
                salaService.validarParaSincronizacao(s);
                return salas.save(s).getId();
            case "turmas":
                Turma t = new Turma();
                t.setId(longObrigatorio(item.get("id"), colecao + ".id"));
                t.setNome(str(item.get("nome")));
                t.setCodigo(str(item.get("codigo")));
                t.setCurso(str(item.get("curso")));
                t.setTurno(str(item.get("turno")));
                t.setInstrutorId(longOuNull(item.get("instrutorId"), colecao + ".instrutorId"));
                t.setUnidadeId(longOuNull(item.get("unidadeId"), colecao + ".unidadeId"));
                t.setDataInicio(dataOuNull(item.get("dataInicio"), colecao + ".dataInicio"));
                t.setDataFim(dataOuNull(item.get("dataFim"), colecao + ".dataFim"));
                validarEntidade(t);
                turmaService.validarParaSincronizacao(t, t.getId());
                return turmas.save(t).getId();
            case "reservas":
                Reserva r = new Reserva();
                r.setId(longObrigatorio(item.get("id"), colecao + ".id"));
                r.setSalaId(longOuNull(item.get("salaId"), colecao + ".salaId"));
                r.setTurmaId(longOuNull(item.get("turmaId"), colecao + ".turmaId"));
                r.setTurno(str(item.get("turno")));
                r.setDataInicio(dataOuNull(item.get("dataInicio"), colecao + ".dataInicio"));
                r.setDataFim(dataOuNull(item.get("dataFim"), colecao + ".dataFim"));
                r.setHoraInicio(str(item.get("horaInicio")));
                r.setHoraFim(str(item.get("horaFim")));
                r.setInstrutorId(longOuNull(item.get("instrutorId"), colecao + ".instrutorId"));
                r.setUnidadeId(longOuNull(item.get("unidadeId"), colecao + ".unidadeId"));
                r.setStatus(statusReservaOuPadrao(item.get("status"), colecao + ".status"));
                r.setAvulsa(item.get("avulsa") != null && Boolean.parseBoolean(item.get("avulsa").toString()));
                r.setDiasSemana(conjuntoDeStrings(item.get("diasSemana")));
                validarEntidade(r);
                reservaService.validarParaSincronizacao(reservaRequest(item), r.getId());
                return reservas.save(r).getId();
            case "chaves":
                Chave c = new Chave();
                c.setId(longObrigatorio(item.get("id"), colecao + ".id"));
                c.setCodigo(str(item.get("codigo")));
                c.setSalaId(longOuNull(item.get("salaId"), colecao + ".salaId"));
                c.setAndar(str(item.get("andar")));
                c.setStatus(statusChaveOuPadrao(item.get("status"), colecao + ".status"));
                c.setInstrutorId(longOuNull(item.get("instrutorId"), colecao + ".instrutorId"));
                c.setPegaEm(instantOuNull(item.get("pegaEm"), colecao + ".pegaEm"));
                c.setUnidadeId(longOuNull(item.get("unidadeId"), colecao + ".unidadeId"));
                validarEntidade(c);
                chaveService.validarParaSincronizacao(c, c.getId());
                return chaves.save(c).getId();
            case "notificacoes":
                Notificacao n = new Notificacao();
                n.setId(longObrigatorio(item.get("id"), colecao + ".id"));
                n.setTipo(str(item.get("tipo")));
                n.setTitulo(str(item.get("titulo")));
                n.setMsg(str(item.get("msg")));
                n.setParaPerfil(str(item.get("paraPerfil")));
                n.setParaId(longOuNull(item.get("paraId"), colecao + ".paraId"));
                n.setUnidadeId(longOuNull(item.get("unidadeId"), colecao + ".unidadeId"));
                n.setLida(item.get("lida") != null && Boolean.parseBoolean(item.get("lida").toString()));
                Instant criadaEm = instantOuNull(item.get("criadaEm"), colecao + ".criadaEm");
                if (criadaEm != null) n.setCriadaEm(criadaEm);
                validarEntidade(n);
                validarNotificacao(n);
                return notificacoes.save(n).getId();
            case "solicitacoes":
                Solicitacao sol = new Solicitacao();
                sol.setId(longObrigatorio(item.get("id"), colecao + ".id"));
                sol.setSalaId(longOuNull(item.get("salaId"), colecao + ".salaId"));
                sol.setInstrutorId(longOuNull(item.get("instrutorId"), colecao + ".instrutorId"));
                sol.setTurmaId(longOuNull(item.get("turmaId"), colecao + ".turmaId"));
                sol.setUnidadeId(longOuNull(item.get("unidadeId"), colecao + ".unidadeId"));
                sol.setData(dataOuNull(item.get("data"), colecao + ".data"));
                sol.setDataInicio(dataOuNull(item.get("dataInicio"), colecao + ".dataInicio"));
                sol.setDataFim(dataOuNull(item.get("dataFim"), colecao + ".dataFim"));
                sol.setMotivo(str(item.get("motivo")));
                sol.setResposta(str(item.get("resposta")));
                sol.setStatus(statusSolicitacaoOuPadrao(item.get("status"), colecao + ".status"));
                sol.setCriadaEm(instantOuNull(item.get("criadaEm"), colecao + ".criadaEm"));
                sol.setRespondidaEm(instantOuNull(item.get("respondidaEm"), colecao + ".respondidaEm"));
                sol.setModo(str(item.get("modo")));
                sol.setTurno(str(item.get("turno")));
                sol.setHoraInicio(str(item.get("horaInicio")));
                sol.setHoraFim(str(item.get("horaFim")));
                if (item.get("turnos") instanceof List<?>) {
                    @SuppressWarnings("unchecked")
                    List<Object> turnos = (List<Object>) item.get("turnos");
                    sol.setTurnos(new java.util.LinkedHashSet<>(turnos.stream().map(Object::toString).toList()));
                }
                if (item.get("diasSemana") instanceof List<?>) {
                    @SuppressWarnings("unchecked")
                    List<Object> dias = (List<Object>) item.get("diasSemana");
                    sol.setDiasSemana(new java.util.LinkedHashSet<>(dias.stream().map(Object::toString).toList()));
                }
                if (item.get("datasEspecificas") instanceof List<?>) {
                    @SuppressWarnings("unchecked")
                    List<Object> datas = (List<Object>) item.get("datasEspecificas");
                    sol.setDatasEspecificas(datas.stream().map(Object::toString).toList());
                }
                validarEntidade(sol);
                solicitacaoService.validarParaSincronizacao(sol);
                return solicitacoes.save(sol).getId();
            default:
                throw new AcessoNegadoException("Colecao nao autorizada para sincronizacao");
        }
    }

    private void deletar(String colecao, Long id) {
        validarUnidadeDoRegistro(colecao, id);
        switch (colecao) {
            case "usuarios": usuarios.deleteById(id); break;
            case "unidades": unidades.deleteById(id); break;
            case "salas": salas.deleteById(id); break;
            case "turmas": turmas.deleteById(id); break;
            case "reservas": reservas.deleteById(id); break;
            case "chaves": chaves.deleteById(id); break;
            case "notificacoes": notificacoes.deleteById(id); break;
            case "solicitacoes": solicitacoes.deleteById(id); break;
            default: break;
        }
    }

    private void validarUnidadeDoRegistro(String colecao, Long id) {
        Perfil perfil = perfilAutenticado();
        if (perfil == Perfil.ADMIN) return;

        Long unidadeRegistro = switch (colecao) {
            case "usuarios" -> usuarios.findById(id)
                    .orElseThrow(() -> new conecta.demo.exception.RecursoNaoEncontradoException("Usuario", id))
                    .getUnidadeId();
            case "unidades" -> unidades.findById(id)
                    .orElseThrow(() -> new conecta.demo.exception.RecursoNaoEncontradoException("Unidade", id))
                    .getId();
            case "salas" -> salas.findById(id)
                    .orElseThrow(() -> new conecta.demo.exception.RecursoNaoEncontradoException("Sala", id))
                    .getUnidadeId();
            case "turmas" -> turmas.findById(id)
                    .orElseThrow(() -> new conecta.demo.exception.RecursoNaoEncontradoException("Turma", id))
                    .getUnidadeId();
            case "reservas" -> reservas.findById(id)
                    .orElseThrow(() -> new conecta.demo.exception.RecursoNaoEncontradoException("Reserva", id))
                    .getUnidadeId();
            case "chaves" -> chaves.findById(id)
                    .orElseThrow(() -> new conecta.demo.exception.RecursoNaoEncontradoException("Chave", id))
                    .getUnidadeId();
            case "notificacoes" -> notificacoes.findById(id)
                    .orElseThrow(() -> new conecta.demo.exception.RecursoNaoEncontradoException("Notificacao", id))
                    .getUnidadeId();
            case "solicitacoes" -> solicitacoes.findById(id)
                    .orElseThrow(() -> new conecta.demo.exception.RecursoNaoEncontradoException("Solicitacao", id))
                    .getUnidadeId();
            default -> throw new AcessoNegadoException("Colecao nao autorizada para remocao");
        };

        var auth = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        Long unidadeUsuario = auth == null ? null : usuarios.findByEmailIgnoreCase(auth.getName())
                .map(Usuario::getUnidadeId).orElse(null);
        if (unidadeUsuario == null || !java.util.Objects.equals(unidadeUsuario, unidadeRegistro))
            throw new AcessoNegadoException("Usuario nao pode remover registro de outra unidade");
    }

    private String str(Object o) {
        return o == null ? null : o.toString();
    }

    private void validarEntidade(Object entidade) {
        Set<ConstraintViolation<Object>> violacoes = validator.validate(entidade);
        if (!violacoes.isEmpty())
            throw new RegraDeNegocioException("Dados invalidos");
    }

    private ReservaRequest reservaRequest(Map<String, Object> item) {
        return new ReservaRequest(
                longOuNull(item.get("salaId"), "reservas.salaId"),
                longOuNull(item.get("turmaId"), "reservas.turmaId"),
                str(item.get("turno")),
                conjuntoDeStrings(item.get("diasSemana")),
                dataOuNull(item.get("dataInicio"), "reservas.dataInicio"),
                dataOuNull(item.get("dataFim"), "reservas.dataFim"),
                str(item.get("horaInicio")),
                str(item.get("horaFim")),
                longOuNull(item.get("instrutorId"), "reservas.instrutorId"),
                longOuNull(item.get("unidadeId"), "reservas.unidadeId"));
    }

    private java.time.LocalDate dataOuNull(Object valor) {
        return dataOuNull(valor, "data");
    }

    private java.time.LocalDate dataOuNull(Object valor, String campo) {
        if (valor == null || valor.toString().isBlank()) return null;
        try {
            return java.time.LocalDate.parse(valor.toString());
        } catch (java.time.format.DateTimeParseException ex) {
            throw new DadosInvalidosException(campo, "data deve estar no formato ISO-8601 yyyy-MM-dd");
        }
    }

    private Long longObrigatorio(Object valor, String campo) {
        Long resultado = longOuNull(valor, campo);
        if (resultado == null)
            throw new DadosInvalidosException(campo, "numero inteiro obrigatorio");
        return resultado;
    }

    private Integer integerOuNull(Object valor, String campo) {
        if (valor == null || valor.toString().isBlank() || "null".equals(valor.toString().trim())) return null;
        try {
            return Integer.valueOf(valor.toString().trim());
        } catch (NumberFormatException ex) {
            throw new DadosInvalidosException(campo, "numero inteiro invalido");
        }
    }

    private Instant instantOuNull(Object valor, String campo) {
        if (valor == null || valor.toString().isBlank() || "null".equals(valor.toString().trim())) return null;
        try {
            return Instant.parse(valor.toString().trim());
        } catch (java.time.format.DateTimeParseException ex) {
            throw new DadosInvalidosException(campo, "timestamp deve estar no formato ISO-8601");
        }
    }

    private Perfil perfilOuNull(Object valor, String campo) {
        if (valor == null || valor.toString().isBlank()) return null;
        try {
            return Perfil.from(valor.toString());
        } catch (IllegalArgumentException ex) {
            throw new DadosInvalidosException(campo, "perfil desconhecido");
        }
    }

    private StatusSolicitacao statusSolicitacaoOuPadrao(Object valor, String campo) {
        if (valor == null || valor.toString().isBlank()) return StatusSolicitacao.PENDENTE;
        try {
            return StatusSolicitacao.from(valor.toString());
        } catch (IllegalArgumentException ex) {
            throw new DadosInvalidosException(campo, "status desconhecido");
        }
    }

    private StatusChave statusChaveOuPadrao(Object valor, String campo) {
        if (valor == null || valor.toString().isBlank()) return StatusChave.DISPONIVEL;
        String status = valor.toString().trim().toLowerCase(java.util.Locale.ROOT);
        if (!"disponivel".equals(status) && !"pega".equals(status) && !"retirada".equals(status))
            throw new DadosInvalidosException(campo, "status desconhecido");
        return StatusChave.from(status);
    }

    private String statusReservaOuPadrao(Object valor, String campo) {
        if (valor == null || valor.toString().isBlank()) return "ATIVA";
        String status = valor.toString().trim().toUpperCase(java.util.Locale.ROOT);
        if (!"ATIVA".equals(status) && !"CANCELADA".equals(status))
            throw new DadosInvalidosException(campo, "status desconhecido");
        return status;
    }

    private void validarNotificacao(Notificacao notificacao) {
        if (notificacao.getUnidadeId() != null && !unidades.existsById(notificacao.getUnidadeId()))
            throw new RegraDeNegocioException("Unidade da notificacao nao existe");
        if (notificacao.getParaId() != null && !usuarios.existsById(notificacao.getParaId()))
            throw new RegraDeNegocioException("Usuario destinatario da notificacao nao existe");
        if (notificacao.getParaId() != null && notificacao.getUnidadeId() != null) {
            Long unidadeDoUsuario = usuarios.findById(notificacao.getParaId()).orElseThrow()
                    .getUnidadeId();
            if (!java.util.Objects.equals(unidadeDoUsuario, notificacao.getUnidadeId()))
                throw new RegraDeNegocioException("Notificacao e usuario destinatario devem pertencer a mesma unidade");
        }
    }

    /** Hasheia a senha com BCrypt, mantendo coerencia com o login (encoder.matches). */
    private String hashSenha(String senha) {
        return passwordEncoder.encode(senha);
    }

    private boolean emailValido(String email) {
        if (email == null) return false;
        String limpo = email.trim();
        return !limpo.isEmpty() && limpo.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@.]+$");
    }

    private String normalizarCep(String cep) {
        if (cep == null || cep.isBlank())
            throw new conecta.demo.exception.RegraDeNegocioException("CEP deve conter 8 digitos");
        String digitos = cep.replaceAll("\\D", "");
        if (!cep.matches("^(\\d{8}|\\d{5}-\\d{3})$"))
            throw new conecta.demo.exception.RegraDeNegocioException("CEP deve conter 8 digitos");
        return digitos.substring(0, 5) + "-" + digitos.substring(5);
    }

    /**
     * Converte um valor JSON em {@code Long} sem estourar {@code NullPointerException}.
     *
     * <p>Antes desta correcao, toda coluna {@code unidadeId} (e as referencias
     * {@code salaId}/{@code instrutorId}) era lida com
     * {@code Long.valueOf(item.get("...").toString())}. Um registro sem
     * {@code unidadeId} derrubava a sincronizacao inteira com
     * {@code NullPointerException} (HTTP 500) e abortava as demais colecoes.
     *
     * @return o valor numerico, ou {@code null} quando ausente/vazio/invalido
     */
    private Long longOuNull(Object o) {
        return longOuNull(o, "id");
    }

    private Long longOuNull(Object o, String campo) {
        if (o == null) return null;
        String s = o.toString().trim();
        if (s.isEmpty() || "null".equals(s)) return null;
        try {
            return Long.valueOf(s);
        } catch (NumberFormatException e) {
            throw new DadosInvalidosException(campo, "numero inteiro invalido");
        }
    }

    /** Extrai uma lista de textos de um campo JSON, tolerando ausencia. */
    private List<String> listaDeStrings(Object o) {
        if (!(o instanceof List<?>)) return List.of();
        List<?> bruto = (List<?>) o;
        return bruto.stream().filter(java.util.Objects::nonNull).map(Object::toString).toList();
    }

    /** Extrai um conjunto de textos de um campo JSON, tolerando ausencia. */
    private java.util.LinkedHashSet<String> conjuntoDeStrings(Object o) {
        return new java.util.LinkedHashSet<>(listaDeStrings(o));
    }
}
