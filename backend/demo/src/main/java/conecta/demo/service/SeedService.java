package conecta.demo.service;

import conecta.demo.model.*;
import conecta.demo.repository.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SeedService {

    private final UnidadeRepository unidades;
    private final UsuarioRepository usuarios;
    private final SalaRepository salas;
    private final TurmaRepository turmas;
    private final ReservaRepository reservas;
    private final ChaveRepository chaves;
    private final NotificacaoRepository notificacoes;
    private final SolicitacaoRepository solicitacoes;

    public SeedService(UnidadeRepository unidades, UsuarioRepository usuarios, SalaRepository salas, TurmaRepository turmas,
                       ReservaRepository reservas, ChaveRepository chaves, NotificacaoRepository notificacoes,
                       SolicitacaoRepository solicitacoes) {
        this.unidades = unidades;
        this.usuarios = usuarios;
        this.salas = salas;
        this.turmas = turmas;
        this.reservas = reservas;
        this.chaves = chaves;
        this.notificacoes = notificacoes;
        this.solicitacoes = solicitacoes;
    }

    @Transactional
    public void semear() {
        if (unidades.count() > 0) {
            return;
        }

        LocalDate hoje = LocalDate.now();
        List<Unidade> listaUnidades = new ArrayList<>();
        listaUnidades.add(unidade(1001L, "SENAC Asa Norte", "70750-500", "Brasília/DF", "SCS Q.3 Bl.A - Asa Norte"));
        listaUnidades.add(unidade(1002L, "SENAC Asa Sul", "70390-045", "Brasília/DF", "SCS Q.3 Bl.A - Asa Sul"));
        listaUnidades.add(unidade(1003L, "SENAC Taguatinga", "72015-900", "Taguatinga/DF", "QS 1 Rua 210 Lote 30"));
        listaUnidades.add(unidade(1004L, "SENAC Ceilândia", "72220-270", "Ceilândia/DF", "Setor O, Qd.602 Conj.A"));
        listaUnidades.add(unidade(1005L, "SENAC Gama", "72405-080", "Gama/DF", "St. Central Qd.01 Conj.A"));
        listaUnidades.add(unidade(1006L, "SENAC Sobradinho", "73025-500", "Sobradinho/DF", "Conj.7 Área Esp. S/N"));
        listaUnidades.add(unidade(1007L, "SENAC Planaltina", "73380-100", "Planaltina/DF", "Setor Comercial Lote 1"));
        listaUnidades.add(unidade(1008L, "SENAC Samambaia", "72301-080", "Samambaia/DF", "QS 318 Conj.1 Lote 1"));
        listaUnidades.add(unidade(1009L, "SENAC Santa Maria", "72503-503", "Santa Maria/DF", "Av. Alagados Qd.400"));
        listaUnidades.add(unidade(1010L, "SENAC Águas Claras", "71907-530", "Águas Claras/DF", "Av. Araras Qd.600 Lote 10"));
        unidades.saveAll(listaUnidades);

        long uid = 1L;
        List<Usuario> listaUsuarios = new ArrayList<>();
        listaUsuarios.add(usuario(1L, "Administrador SENAC", "Senac_GDF@Hotmail.com", "Senac.DF2007", Perfil.ADMIN, 1001L));
        listaUsuarios.add(usuario(2L, "Anadiria Passos", "coord.asanorte@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1001L));
        listaUsuarios.add(usuario(3L, "Joao Paulo Ferreira", "coord.Paulo@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1001L));
        listaUsuarios.add(usuario(4L, "Bruno Mendes Costa", "coord.asasul@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1002L));
        listaUsuarios.add(usuario(5L, "Carla Souza Lima", "coord.taguatinga@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1003L));
        listaUsuarios.add(usuario(6L, "Daniel Rocha Neves", "coord.ceilandia@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1004L));
        listaUsuarios.add(usuario(7L, "Elaine Cristina Dias", "coord.gama@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1005L));
        listaUsuarios.add(usuario(8L, "Fábio Alves Santos", "coord.sobradinho@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1006L));
        listaUsuarios.add(usuario(9L, "Gabriela Moura", "coord.planaltina@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1007L));
        listaUsuarios.add(usuario(10L, "Henrique Lopes", "coord.samambaia@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1008L));
        listaUsuarios.add(usuario(11L, "Isabela Ramos", "coord.santamaria@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1009L));
        listaUsuarios.add(usuario(12L, "João Victor Pinto", "coord.aguasclaras@senacdf.com", "Coord@123", Perfil.COORDENADOR, 1010L));
        listaUsuarios.add(usuario(13L, "Katia Regina Barros", "katia.barros@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1001L));
        listaUsuarios.add(usuario(14L, "Aline Moraes", "aline.moraes@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1001L));
        listaUsuarios.add(usuario(15L, "Leonardo Cruz", "leonardo.cruz@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1002L));
        listaUsuarios.add(usuario(16L, "Caio Batista", "caio.batista@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1002L));
        listaUsuarios.add(usuario(17L, "Mariana Oliveira", "mariana.oliveira@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1003L));
        listaUsuarios.add(usuario(18L, "Diana Castro", "diana.castro@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1003L));
        listaUsuarios.add(usuario(19L, "Natan Ferreira", "natan.ferreira@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1004L));
        listaUsuarios.add(usuario(20L, "Erick Almeida", "erick.almeida@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1004L));
        listaUsuarios.add(usuario(21L, "Olivia Martins", "olivia.martins@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1005L));
        listaUsuarios.add(usuario(22L, "Fernanda Lima", "fernanda.lima@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1005L));
        listaUsuarios.add(usuario(23L, "Pedro Henrique Melo", "pedro.melo@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1006L));
        listaUsuarios.add(usuario(24L, "Gustavo Rocha", "gustavo.rocha@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1006L));
        listaUsuarios.add(usuario(25L, "Queila Nascimento", "queila.nascimento@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1007L));
        listaUsuarios.add(usuario(26L, "Helena Duarte", "helena.duarte@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1007L));
        listaUsuarios.add(usuario(27L, "Rafael Torres", "rafael.torres@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1008L));
        listaUsuarios.add(usuario(28L, "Igor Martins", "igor.martins@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1008L));
        listaUsuarios.add(usuario(29L, "Sabrina Almeida", "sabrina.almeida@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1009L));
        listaUsuarios.add(usuario(30L, "Julia Naves", "julia.naves@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1009L));
        listaUsuarios.add(usuario(31L, "Thiago Vieira", "thiago.vieira@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1010L));
        listaUsuarios.add(usuario(32L, "Lucas Teixeira", "lucas.teixeira@senacdf.com", "Inst@123", Perfil.INSTRUTOR, 1010L));
        listaUsuarios.add(usuario(33L, "Úrsula Campos", "recep.asanorte@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1001L));
        listaUsuarios.add(usuario(34L, "Vinícius Cardoso", "recep.asasul@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1002L));
        listaUsuarios.add(usuario(35L, "Wanda Silveira", "recep.taguatinga@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1003L));
        listaUsuarios.add(usuario(36L, "Xênia Prudente", "recep.ceilandia@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1004L));
        listaUsuarios.add(usuario(37L, "Yara Gonçalves", "recep.gama@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1005L));
        listaUsuarios.add(usuario(38L, "Zilda Fonseca", "recep.sobradinho@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1006L));
        listaUsuarios.add(usuario(39L, "Adriana Pereira", "recep.planaltina@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1007L));
        listaUsuarios.add(usuario(40L, "Bernardo Castro", "recep.samambaia@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1008L));
        listaUsuarios.add(usuario(41L, "Cecília Duarte", "recep.santamaria@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1009L));
        listaUsuarios.add(usuario(42L, "Diego Farias", "recep.aguasclaras@senacdf.com", "Recep@123", Perfil.RECEPCAO, 1010L));
        usuarios.saveAll(listaUsuarios);

        List<Sala> listaSalas = new ArrayList<>();
        String[] tipos = {"Laboratório de Informática", "Sala Comum", "Cozinha Didática", "Auditório", "Sala de Reunião"};
        String[] nomes = {"Lab Informática", "Sala Comum", "Lab Práticas", "Auditório", "Sala Reunião"};
        String[] andares = {"1º Andar", "Térreo", "1º Andar", "Térreo", "2º Andar"};
        Integer[] capacidades = {30, 40, 20, 80, 12};
        long sid = 5001L;
        for (int ui = 0; ui < 10; ui++) {
            long unidadeId = 1001L + ui;
            String numero = String.format("%02d", ui + 1);
            for (int ti = 0; ti < 5; ti++) {
                Sala sala = new Sala();
                sala.setId(sid++);
                sala.setNome(nomes[ti] + " " + numero);
                sala.setTipo(tipos[ti]);
                sala.setCapacidade(capacidades[ti]);
                sala.setAndar(andares[ti]);
                sala.setBloco("Bloco " + (char) ('A' + ti));
                sala.setUnidadeId(unidadeId);
                List<String> turnos = ti == 2 || ti == 4
                        ? List.of("Matutino", "Vespertino")
                        : List.of("Matutino", "Vespertino", "Noturno");
                sala.setTurnosDisponiveis(turnos);
                sala.setTurnos(new ArrayList<>(turnos));
                sala.setStatusManual(null);
                sala.setMotivoManual("");
                sala.setManualPor("");
                sala.setManualCriadaEm(null);
                listaSalas.add(sala);
            }
        }
        salas.saveAll(listaSalas);

        List<Turma> listaTurmas = new ArrayList<>();
        String[] cursos = {"Técnico em Informática", "Gastronomia Básica", "Gestão de Pessoas", "Técnico em Estética", "Redes de Computadores",
                "Auxiliar de Enfermagem", "Design Gráfico", "Logística", "Atendimento ao Cliente", "Empreendedorismo"};
        String[] turnosTurma = {"Matutino", "Vespertino", "Noturno", "Matutino"};
        long turmaId = 6001L;
        for (int ui = 0; ui < 10; ui++) {
            long unidadeId = 1001L + ui;
            for (int k = 0; k < 4; k++) {
                Turma turma = new Turma();
                turma.setId(turmaId);
                turma.setNome("2025." + String.format("%02d", ui + 1) + "." + (k * 10 + ui + 1));
                turma.setCodigo("2025.0" + String.format("%02d", turmaId - 6001));
                turma.setCurso(cursos[(ui + k) % cursos.length]);
                turma.setTurno(turnosTurma[k]);
                turma.setDataInicio(hoje.minusDays(20 - k * 5));
                turma.setDataFim(hoje.plusDays(80 + k * 20));
                turma.setInstrutorId(13L + (ui * 2 + k % 2));
                turma.setUnidadeId(unidadeId);
                listaTurmas.add(turma);
                turmaId++;
            }
        }
        turmas.saveAll(listaTurmas);

        long rid = 7001L;
        List<Reserva> listaReservas = new ArrayList<>();
        String[][] padroes = {{"seg","ter","qua","qui","sex"}, {"seg","qua","sex"}, {"ter","qui"}};
        for (int ui = 0; ui < 10; ui++) {
            long unidadeId = 1001L + ui;
            for (int k = 0; k < 3; k++) {
                Reserva r = new Reserva();
                r.setId(rid++);
                r.setSalaId(5001L + ui * 5 + k % 5);
                r.setTurmaId(6001L + ui * 4 + k % 4);
                r.setTurno(turnosTurma[k % 4]);
                r.setDiasSemana(Set.of(padroes[k % 3]));
                r.setDataInicio(hoje.minusDays(20 - k * 5));
                r.setDataFim(hoje.plusDays(80 + k * 20));
                r.setStatus("ATIVA");
                r.setUnidadeId(unidadeId);
                r.setInstrutorId(13L + ui * 2 + k % 2);
                listaReservas.add(r);
            }
        }
        Reserva cancelada = new Reserva();
        cancelada.setId(7031L);
        cancelada.setSalaId(5003L);
        cancelada.setTurmaId(6001L);
        cancelada.setTurno("Vespertino");
        cancelada.setDiasSemana(Set.of("sab"));
        cancelada.setDataInicio(hoje.plusDays(20));
        cancelada.setDataFim(hoje.plusDays(20));
        cancelada.setStatus("CANCELADA");
        cancelada.setUnidadeId(1001L);
        cancelada.setInstrutorId(13L);
        listaReservas.add(cancelada);
        reservas.saveAll(listaReservas);

        long cid = 8001L;
        List<Chave> listaChaves = new ArrayList<>();
        for (int ui = 0; ui < 10; ui++) {
            long unidadeId = 1001L + ui;
            for (int k = 0; k < 2; k++) {
                Chave chave = new Chave();
                chave.setId(cid++);
                chave.setCodigo("CH-" + String.format("%02d", ui + 1) + (k + 1));
                chave.setSalaId(5001L + ui * 5 + k);
                chave.setAndar(k == 0 ? "1º Andar" : "Térreo");
                if (k == 0) {
                    chave.setStatus(StatusChave.DISPONIVEL);
                } else {
                    chave.setStatus(StatusChave.RETIRADA);
                    chave.setInstrutorId(13L + ui * 2);
                    chave.setPegaEm(Instant.now().minusSeconds(3600));
                }
                chave.setUnidadeId(unidadeId);
                listaChaves.add(chave);
            }
        }
        chaves.saveAll(listaChaves);

        List<Notificacao> listaNotificacoes = new ArrayList<>();
        listaNotificacoes.add(notificacao(9001L, "info", "Reserva confirmada", "Turma vinculada a uma sala com sucesso.", "coordenador", null, 1001L, false, Instant.now().minusSeconds(3600)));
        listaNotificacoes.add(notificacao(9002L, "aviso", "Sala em manutenção", "Algumas salas podem estar temporariamente indisponíveis.", "recepcao", null, 1001L, false, Instant.now().minusSeconds(7200)));
        listaNotificacoes.add(notificacao(9003L, "ok", "Solicitação aprovada", "Uso de sala aprovado para atividade prática.", "instrutor", 19L, 1004L, false, Instant.now().minusSeconds(10800)));
        listaNotificacoes.add(notificacao(9004L, "info", "Chave retirada", "Uma chave foi retirada para aula vespertina.", "coordenador", null, 1005L, true, Instant.now().minusSeconds(14400)));
        notificacoes.saveAll(listaNotificacoes);

        List<Solicitacao> listaSolicitacoes = new ArrayList<>();
        listaSolicitacoes.add(solicitacao(10001L, 5005L, 17L, null, 1003L, hoje.plusDays(2), Set.of("Noturno"), "pendente", "Aula extra de portfólio fotográfico", null, null, Instant.now().minusSeconds(5400)));
        listaSolicitacoes.add(solicitacao(10002L, 5012L, 19L, 6010L, 1004L, hoje.plusDays(5), Set.of("Matutino"), "aprovada", "Mostra de projetos integradores", Instant.now().minusSeconds(3600), null, Instant.now().minusSeconds(9000000)));
        listaSolicitacoes.add(solicitacao(10003L, 5050L, 31L, null, 1010L, hoje.plusDays(1), Set.of("Vespertino"), "pendente", "Atendimento de mentoria para turma", null, null, Instant.now().minusSeconds(1800)));
        listaSolicitacoes.add(solicitacao(10004L, 5047L, 29L, null, 1009L, hoje.plusDays(3), Set.of("Vespertino"), "recusada", "Reposição de conteúdo prático", Instant.now().minusSeconds(7200), "Sala bloqueada para manutenção.", Instant.now().minusSeconds(12600000)));
        solicitacoes.saveAll(listaSolicitacoes);
    }

    private Unidade unidade(Long id, String nome, String cep, String cidade, String endereco) {
        Unidade u = new Unidade();
        u.setId(id);
        u.setNome(nome);
        u.setCep(cep);
        u.setCidade(cidade);
        u.setEndereco(endereco);
        return u;
    }

    private Usuario usuario(Long id, String nome, String email, String senha, Perfil perfil, Long unidadeId) {
        Usuario u = new Usuario();
        u.setId(id);
        u.setNome(nome);
        u.setEmail(email);
        u.setSenha(senha);
        u.setPerfil(perfil);
        u.setUnidadeId(unidadeId);
        return u;
    }

    private Notificacao notificacao(Long id, String tipo, String titulo, String msg, String paraPerfil, Long paraId, Long unidadeId, boolean lida, Instant criadaEm) {
        Notificacao n = new Notificacao();
        n.setId(id);
        n.setTipo(tipo);
        n.setTitulo(titulo);
        n.setMsg(msg);
        n.setParaPerfil(paraPerfil);
        n.setParaId(paraId);
        n.setUnidadeId(unidadeId);
        n.setLida(lida);
        n.setCriadaEm(criadaEm);
        return n;
    }

    private Solicitacao solicitacao(Long id, Long salaId, Long instrutorId, Long turmaId, Long unidadeId, LocalDate data, Set<String> turnos, String status, String motivo, Instant respondidaEm, String resposta, Instant criadaEm) {
        Solicitacao s = new Solicitacao();
        s.setId(id);
        s.setSalaId(salaId);
        s.setInstrutorId(instrutorId);
        s.setTurmaId(turmaId);
        s.setUnidadeId(unidadeId);
        s.setData(data);
        s.setTurnos(turnos);
        s.setStatus(StatusSolicitacao.from(status));
        s.setMotivo(motivo);
        s.setRespondidaEm(respondidaEm);
        s.setResposta(resposta);
        s.setCriadaEm(criadaEm);
        return s;
    }
}
