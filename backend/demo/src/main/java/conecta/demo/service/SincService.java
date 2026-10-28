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
import conecta.demo.repository.ChaveRepository;
import conecta.demo.repository.NotificacaoRepository;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.SolicitacaoRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public SincService(UsuarioRepository usuarios, UnidadeRepository unidades, SalaRepository salas,
                       TurmaRepository turmas, ReservaRepository reservas, ChaveRepository chaves,
                       NotificacaoRepository notificacoes, SolicitacaoRepository solicitacoes,
                       conecta.demo.repository.SessaoRepository sessoes, SeedService seedService,
                       DadosService dados) {
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
        resposta.put("banco", dados.banco());
        resposta.put("idsNovos", idsNovos);
        return resposta;
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
        resposta.put("banco", dados.banco());
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
        for (Map.Entry<String, Object> entrada : criados.entrySet()) {
            String colecao = entrada.getKey();
            if (!(entrada.getValue() instanceof List<?>)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> itens = (List<Map<String, Object>>) entrada.getValue();
            Map<String, Long> mapa = new LinkedHashMap<>();
            for (Map<String, Object> item : itens) {
                if (item == null || item.get("id") == null) {
                    continue;
                }
                Long idProvisorio = Long.valueOf(item.get("id").toString());
                if (existe(colecao, idProvisorio)) {
                    continue;
                }
                Long oficial = proximoId(colecao);
                item.put("id", oficial);
                salvar(colecao, item);
                mapa.put(String.valueOf(idProvisorio), oficial);
            }
            if (!mapa.isEmpty()) {
                idsNovos.put(colecao, mapa);
            }
        }
    }

    private void aplicarAlteracoes(Map<String, Object> alteracoes) {
        for (Map.Entry<String, Object> entrada : alteracoes.entrySet()) {
            String colecao = entrada.getKey();
            if (!(entrada.getValue() instanceof List<?>)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> itens = (List<Map<String, Object>>) entrada.getValue();
            for (Map<String, Object> item : itens) {
                if (item == null || item.get("id") == null) {
                    continue;
                }
                salvar(colecao, item);
            }
        }
    }

    private void aplicarRemocoes(Map<String, Object> remocoes) {
        for (Map.Entry<String, Object> entrada : remocoes.entrySet()) {
            String colecao = entrada.getKey();
            if (!(entrada.getValue() instanceof List<?>)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            List<Object> ids = (List<Object>) entrada.getValue();
            for (Object idObj : ids) {
                if (idObj == null) {
                    continue;
                }
                deletar(colecao, Long.valueOf(idObj.toString()));
            }
        }
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
    private void salvar(String colecao, Map<String, Object> item) {
        // Registro sem "id" nao pode ser materializado (o id e a chave primaria
        // e e gerado manualmente, sem @GeneratedValue). Ignorar em vez de
        // estourar NullPointerException e derrubar as demais colecoes.
        if (longOuNull(item.get("id")) == null) return;
        switch (colecao) {
            case "usuarios":
                Usuario u = new Usuario();
                u.setId(Long.valueOf(item.get("id").toString()));
                u.setNome(str(item.get("nome")));
                u.setEmail(str(item.get("email")));
                // A senha NUNCA volta no /api/dados (@JsonIgnore em Usuario.getSenha()),
                // por isso o cache do cliente nao a possui. Se o payload nao trouxer
                // senha (caso normal para usuarios ja existentes), preservamos a senha
                // atual em vez de gravar null (o que violava @NotBlank/nullable=false e
                // derrubava toda a sincronizacao com HTTP 500). Quando a senha vier
                // (criacao ou redefinicao), hasheamos com BCrypt para manter coerencia
                // com o login (encoder.matches), que exige hash BCrypt.
                String senhaRecebida = str(item.get("senha"));
                if (senhaRecebida == null || senhaRecebida.isBlank()) {
                    String senhaAtual = usuarios.findById(u.getId())
                            .map(Usuario::getSenha).orElse(null);
                    if (senhaAtual == null) {
                        // Usuario novo sem senha: ignora em vez de derrubar a colecao
                        // (mesmo padrao do registro sem "id").
                        break;
                    }
                    u.setSenha(senhaAtual);
                } else if (senhaRecebida.startsWith("$2a$") || senhaRecebida.startsWith("$2b$")
                        || senhaRecebida.startsWith("$2y$")) {
                    // Ja esta hasheada (eco de cache antigo): nao re-hashear.
                    u.setSenha(senhaRecebida);
                } else {
                    u.setSenha(hashSenha(senhaRecebida));
                }
                u.setPerfil(item.get("perfil") == null ? null : Perfil.from(item.get("perfil").toString()));
                u.setUnidadeId(longOuNull(item.get("unidadeId")));
                usuarios.save(u);
                break;
            case "unidades":
                Unidade un = new Unidade();
                un.setId(Long.valueOf(item.get("id").toString()));
                un.setNome(str(item.get("nome")));
                un.setCep(normalizarCep(str(item.get("cep"))));
                un.setCidade(str(item.get("cidade")));
                un.setEndereco(str(item.get("endereco")));
                unidades.save(un);
                break;
            case "salas":
                Sala s = new Sala();
                s.setId(Long.valueOf(item.get("id").toString()));
                s.setNome(str(item.get("nome")));
                s.setTipo(str(item.get("tipo")));
                s.setCapacidade(item.get("capacidade") == null ? null : Integer.valueOf(item.get("capacidade").toString()));
                s.setAndar(str(item.get("andar")));
                s.setBloco(str(item.get("bloco")));
                s.setUnidadeId(longOuNull(item.get("unidadeId")));
                // Campos que antes eram zerados a cada sincronizacao (pendencia
                // "perda de dados no POST /api/sinc" do relatorio de arquitetura).
                s.setTurnosDisponiveis(listaDeStrings(item.get("turnosDisponiveis")));
                s.setTurnos(listaDeStrings(item.get("turnos")));
                s.setStatusManual(str(item.get("statusManual")));
                s.setMotivoManual(str(item.get("motivoManual")));
                s.setManualPor(str(item.get("manualPor")));
                if (item.get("manualCriadaEm") != null) s.setManualCriadaEm(Instant.parse(item.get("manualCriadaEm").toString()));
                s.setAtiva(item.get("ativa") == null || Boolean.parseBoolean(item.get("ativa").toString()));
                salas.save(s);
                break;
            case "turmas":
                Turma t = new Turma();
                t.setId(Long.valueOf(item.get("id").toString()));
                t.setNome(str(item.get("nome")));
                t.setCodigo(str(item.get("codigo")));
                t.setCurso(str(item.get("curso")));
                t.setTurno(str(item.get("turno")));
                t.setInstrutorId(item.get("instrutorId") == null ? null : Long.valueOf(item.get("instrutorId").toString()));
                t.setUnidadeId(longOuNull(item.get("unidadeId")));
                if (item.get("dataInicio") != null) t.setDataInicio(java.time.LocalDate.parse(item.get("dataInicio").toString()));
                if (item.get("dataFim") != null) t.setDataFim(java.time.LocalDate.parse(item.get("dataFim").toString()));
                turmas.save(t);
                break;
            case "reservas":
                Reserva r = new Reserva();
                r.setId(Long.valueOf(item.get("id").toString()));
                r.setSalaId(longOuNull(item.get("salaId")));
                r.setTurmaId(longOuNull(item.get("turmaId")));
                r.setTurno(str(item.get("turno")));
                if (item.get("dataInicio") != null) r.setDataInicio(java.time.LocalDate.parse(item.get("dataInicio").toString()));
                if (item.get("dataFim") != null) r.setDataFim(java.time.LocalDate.parse(item.get("dataFim").toString()));
                r.setHoraInicio(str(item.get("horaInicio")));
                r.setHoraFim(str(item.get("horaFim")));
                r.setInstrutorId(longOuNull(item.get("instrutorId")));
                r.setUnidadeId(longOuNull(item.get("unidadeId")));
                r.setStatus(item.get("status") == null ? "ATIVA" : item.get("status").toString());
                r.setAvulsa(item.get("avulsa") != null && Boolean.parseBoolean(item.get("avulsa").toString()));
                r.setDiasSemana(conjuntoDeStrings(item.get("diasSemana")));
                reservas.save(r);
                break;
            case "chaves":
                Chave c = new Chave();
                c.setId(Long.valueOf(item.get("id").toString()));
                c.setCodigo(str(item.get("codigo")));
                c.setSalaId(longOuNull(item.get("salaId")));
                c.setAndar(str(item.get("andar")));
                c.setStatus(item.get("status") == null ? StatusChave.DISPONIVEL : StatusChave.from(item.get("status").toString()));
                c.setInstrutorId(item.get("instrutorId") == null ? null : Long.valueOf(item.get("instrutorId").toString()));
                if (item.get("pegaEm") != null) c.setPegaEm(Instant.parse(item.get("pegaEm").toString()));
                c.setUnidadeId(longOuNull(item.get("unidadeId")));
                chaves.save(c);
                break;
            case "notificacoes":
                Notificacao n = new Notificacao();
                n.setId(Long.valueOf(item.get("id").toString()));
                n.setTipo(str(item.get("tipo")));
                n.setTitulo(str(item.get("titulo")));
                n.setMsg(str(item.get("msg")));
                n.setParaPerfil(str(item.get("paraPerfil")));
                n.setParaId(item.get("paraId") == null ? null : Long.valueOf(item.get("paraId").toString()));
                n.setUnidadeId(item.get("unidadeId") == null ? null : Long.valueOf(item.get("unidadeId").toString()));
                n.setLida(item.get("lida") != null && Boolean.parseBoolean(item.get("lida").toString()));
                if (item.get("criadaEm") != null) n.setCriadaEm(Instant.parse(item.get("criadaEm").toString()));
                notificacoes.save(n);
                break;
            case "solicitacoes":
                Solicitacao sol = new Solicitacao();
                sol.setId(Long.valueOf(item.get("id").toString()));
                sol.setSalaId(longOuNull(item.get("salaId")));
                sol.setInstrutorId(longOuNull(item.get("instrutorId")));
                sol.setTurmaId(longOuNull(item.get("turmaId")));
                sol.setUnidadeId(longOuNull(item.get("unidadeId")));
                if (item.get("data") != null) sol.setData(java.time.LocalDate.parse(item.get("data").toString()));
                if (item.get("dataInicio") != null) sol.setDataInicio(java.time.LocalDate.parse(item.get("dataInicio").toString()));
                if (item.get("dataFim") != null) sol.setDataFim(java.time.LocalDate.parse(item.get("dataFim").toString()));
                sol.setMotivo(str(item.get("motivo")));
                sol.setResposta(str(item.get("resposta")));
                sol.setStatus(item.get("status") == null ? StatusSolicitacao.PENDENTE : StatusSolicitacao.from(item.get("status").toString()));
                if (item.get("criadaEm") != null) sol.setCriadaEm(Instant.parse(item.get("criadaEm").toString()));
                if (item.get("respondidaEm") != null) sol.setRespondidaEm(Instant.parse(item.get("respondidaEm").toString()));
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
                solicitacoes.save(sol);
                break;
            default:
                break;
        }
    }

    private void deletar(String colecao, Long id) {
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

    private String str(Object o) {
        return o == null ? null : o.toString();
    }

    /** Hasheia a senha com BCrypt, mantendo coerencia com o login (encoder.matches). */
    private String hashSenha(String senha) {
        return passwordEncoder.encode(senha);
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
        if (o == null) return null;
        String s = o.toString().trim();
        if (s.isEmpty() || "null".equals(s)) return null;
        try {
            return Long.valueOf(s);
        } catch (NumberFormatException e) {
            return null;
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
