package conecta.demo.controller;

import conecta.demo.model.*;
import conecta.demo.repository.*;
import conecta.demo.service.SeedService;
import java.time.Instant;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class SincController {

    private final UsuarioRepository usuarios;
    private final UnidadeRepository unidades;
    private final SalaRepository salas;
    private final TurmaRepository turmas;
    private final ReservaRepository reservas;
    private final ChaveRepository chaves;
    private final NotificacaoRepository notificacoes;
    private final SolicitacaoRepository solicitacoes;
    private final SessaoRepository sessoes;
    private final SeedService seedService;

    public SincController(UsuarioRepository usuarios, UnidadeRepository unidades, SalaRepository salas, TurmaRepository turmas,
                          ReservaRepository reservas, ChaveRepository chaves, NotificacaoRepository notificacoes,
                          SolicitacaoRepository solicitacoes, SessaoRepository sessoes, SeedService seedService) {
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
    }

    @PostMapping("/sinc")
    @Transactional
    public Map<String, Object> sinc(@RequestBody(required = false) Map<String, Object> corpo) {
        Map<String, Object> alteracoes = extrair(corpo, "alteracoes");
        Map<String, Object> criados = extrair(corpo, "criados");
        Map<String, Object> remocoes = extrair(corpo, "remocoes");
        Map<String, Map<String, Long>> idsNovos = new LinkedHashMap<>();

        aplicarCriados(criados, idsNovos);
        aplicarAlteracoes(alteracoes);
        aplicarRemocoes(remocoes);

        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("ok", true);
        resposta.put("banco", banco());
        resposta.put("idsNovos", idsNovos);
        return resposta;
    }

    @PostMapping("/reset")
    @Transactional
    public Map<String, Object> reset() {
        usuarios.deleteAll();
        unidades.deleteAll();
        salas.deleteAll();
        turmas.deleteAll();
        reservas.deleteAll();
        chaves.deleteAll();
        notificacoes.deleteAll();
        solicitacoes.deleteAll();
        sessoes.deleteAll();
        seed();
        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("ok", true);
        resposta.put("banco", banco());
        return resposta;
    }

    @GetMapping("/sessao")
    public ResponseEntity<?> sessao() {
        Object s = sessaoJson();
        return ResponseEntity.ok(s);
    }

    @PostMapping("/sessao")
    public Map<String, Object> salvarSessao(@RequestBody Map<String, Object> corpo) {
        Object sessao = corpo.get("sessao");
        setSessao(sessao == null ? null : sessao.toString());
        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("ok", true);
        return resposta;
    }

    @PostMapping("/logout")
    public Map<String, Object> logout() {
        setSessao(null);
        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("ok", true);
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

    private void salvar(String colecao, Map<String, Object> item) {
        switch (colecao) {
            case "usuarios":
                Usuario u = new Usuario();
                u.setId(Long.valueOf(item.get("id").toString()));
                u.setNome(str(item.get("nome")));
                u.setEmail(str(item.get("email")));
                u.setSenha(str(item.get("senha")));
                u.setPerfil(item.get("perfil") == null ? null : Perfil.from(item.get("perfil").toString()));
                u.setUnidadeId(Long.valueOf(item.get("unidadeId").toString()));
                usuarios.save(u);
                break;
            case "unidades":
                Unidade un = new Unidade();
                un.setId(Long.valueOf(item.get("id").toString()));
                un.setNome(str(item.get("nome")));
                un.setCep(str(item.get("cep")));
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
                s.setUnidadeId(Long.valueOf(item.get("unidadeId").toString()));
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
                t.setUnidadeId(Long.valueOf(item.get("unidadeId").toString()));
                if (item.get("dataInicio") != null) t.setDataInicio(java.time.LocalDate.parse(item.get("dataInicio").toString()));
                if (item.get("dataFim") != null) t.setDataFim(java.time.LocalDate.parse(item.get("dataFim").toString()));
                turmas.save(t);
                break;
            case "reservas":
                Reserva r = new Reserva();
                r.setId(Long.valueOf(item.get("id").toString()));
                r.setSalaId(Long.valueOf(item.get("salaId").toString()));
                r.setTurmaId(item.get("turmaId") == null ? null : Long.valueOf(item.get("turmaId").toString()));
                r.setTurno(str(item.get("turno")));
                r.setDataInicio(java.time.LocalDate.parse(item.get("dataInicio").toString()));
                r.setDataFim(java.time.LocalDate.parse(item.get("dataFim").toString()));
                r.setInstrutorId(item.get("instrutorId") == null ? null : Long.valueOf(item.get("instrutorId").toString()));
                r.setUnidadeId(Long.valueOf(item.get("unidadeId").toString()));
                r.setStatus(item.get("status") == null ? "ATIVA" : item.get("status").toString());
                if (item.get("diasSemana") instanceof List<?>) {
                    @SuppressWarnings("unchecked")
                    List<Object> dias = (List<Object>) item.get("diasSemana");
                    r.setDiasSemana(new java.util.LinkedHashSet<>(dias.stream().map(Object::toString).toList()));
                }
                reservas.save(r);
                break;
            case "chaves":
                Chave c = new Chave();
                c.setId(Long.valueOf(item.get("id").toString()));
                c.setCodigo(str(item.get("codigo")));
                c.setSalaId(Long.valueOf(item.get("salaId").toString()));
                c.setAndar(str(item.get("andar")));
                c.setStatus(item.get("status") == null ? StatusChave.DISPONIVEL : StatusChave.from(item.get("status").toString()));
                c.setInstrutorId(item.get("instrutorId") == null ? null : Long.valueOf(item.get("instrutorId").toString()));
                if (item.get("pegaEm") != null) c.setPegaEm(Instant.parse(item.get("pegaEm").toString()));
                c.setUnidadeId(Long.valueOf(item.get("unidadeId").toString()));
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
                sol.setSalaId(Long.valueOf(item.get("salaId").toString()));
                sol.setInstrutorId(Long.valueOf(item.get("instrutorId").toString()));
                sol.setTurmaId(item.get("turmaId") == null ? null : Long.valueOf(item.get("turmaId").toString()));
                sol.setUnidadeId(Long.valueOf(item.get("unidadeId").toString()));
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
        }
    }

    private Map<String, Object> banco() {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("usuarios", usuarios.findAll());
        b.put("unidades", unidades.findAll());
        b.put("salas", salas.findAll());
        b.put("turmas", turmas.findAll());
        b.put("reservas", reservas.findAll());
        b.put("chaves", chaves.findAll());
        b.put("notificacoes", notificacoes.findAll());
        b.put("solicitacoes", solicitacoes.findAll());
        return b;
    }

    private Object sessaoJson() {
        return sessoes.findById(1L).map(Sessao::getUsuarioJson).orElse(null);
    }

    private void setSessao(String json) {
        Sessao s = sessoes.findById(1L).orElseGet(Sessao::new);
        s.setId(1L);
        s.setUsuarioJson(json);
        sessoes.save(s);
    }

    private void seed() {
        seedService.semear();
    }

    private String str(Object o) {
        return o == null ? null : o.toString();
    }
}
