package conecta.demo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifica, por reflexao, que cada entidade do pacote {@code model/} declara
 * exatamente o conjunto de campos esperado — o mesmo conjunto descrito pelas
 * colunas das tabelas e pelos DTOs da API.
 *
 * <p>Teste puro JUnit 5: nao sobe o contexto do Spring e nao usa banco.</p>
 */
class EntidadesTest {

    /** Campos esperados de cada entidade, em ordem alfabetica. */
    private record Entidade(String classe, String... campos) {}

    private static final List<Entidade> ESPERADAS = List.of(
            new Entidade("Chave", "andar", "codigo", "id", "instrutorId", "pegaEm", "salaId", "status", "unidadeId"),
            new Entidade("Notificacao", "criadaEm", "id", "lida", "msg", "paraId", "paraPerfil", "tipo", "titulo", "unidadeId"),
            new Entidade("Reserva", "avulsa", "dataFim", "dataInicio", "diasSemana", "horaFim", "horaInicio", "id", "instrutorId", "salaId", "status", "turmaId", "turno", "unidadeId"),
            new Entidade("Sala", "andar", "ativa", "bloco", "capacidade", "id", "manualCriadaEm", "manualPor", "motivoManual", "nome", "statusManual", "tipo", "turnos", "turnosDisponiveis", "unidadeId"),
            new Entidade("Sessao", "id", "usuarioJson"),
            new Entidade("Solicitacao", "criadaEm", "data", "dataFim", "dataInicio", "datasEspecificas", "diasSemana", "horaFim", "horaInicio", "id", "instrutorId", "modo", "motivo", "resposta", "respondidaEm", "salaId", "status", "turmaId", "turno", "turnos", "unidadeId"),
            new Entidade("Turma", "codigo", "curso", "dataFim", "dataInicio", "id", "instrutorId", "nome", "turno", "unidadeId"),
            new Entidade("Unidade", "cep", "cidade", "endereco", "id", "nome"),
            new Entidade("Usuario", "email", "id", "nome", "perfil", "senha", "unidadeId"));

    private static final List<String> ENUMS = List.of("Perfil", "StatusChave", "StatusSolicitacao");

    private static List<String> camposDe(Class<?> tipo) {
        return Arrays.stream(tipo.getDeclaredFields())
                .filter(f -> !f.isSynthetic())
                .filter(f -> !Modifier.isStatic(f.getModifiers()))
                .map(Field::getName)
                .sorted()
                .collect(Collectors.toList());
    }

    @Test
    @DisplayName("Entidades declaram exatamente os campos esperados")
    void entidadesTemCamposEsperados() {
        assertEquals(9, ESPERADAS.size(), "lista de entidades incompleta no teste");

        for (Entidade esperada : ESPERADAS) {
            Class<?> tipo = classeDe(esperada.classe());
            List<String> reais = camposDe(tipo);

            List<String> faltando = Arrays.stream(esperada.campos())
                    .filter(c -> !reais.contains(c))
                    .collect(Collectors.toList());
            List<String> sobrando = reais.stream()
                    .filter(c -> !Arrays.asList(esperada.campos()).contains(c))
                    .collect(Collectors.toList());

            assertTrue(faltando.isEmpty(), tipo.getSimpleName() + " sem campo(s): " + faltando);
            assertTrue(sobrando.isEmpty(), tipo.getSimpleName() + " com campo(s) inesperado(s): " + sobrando);
        }
    }

    @Test
    @DisplayName("Enums de dominio existem e tem os valores esperados")
    void enumsTemValoresEsperados() throws Exception {
        // assertArrayEquals compara conteudo; assertEquals compararia a referencia do array.
        assertArrayEquals(new String[]{"ADMIN", "COORDENADOR", "INSTRUTOR", "RECEPCAO"}, constantesDe("Perfil"));
        assertArrayEquals(new String[]{"DISPONIVEL", "RETIRADA"}, constantesDe("StatusChave"));
        assertArrayEquals(new String[]{"PENDENTE", "APROVADA", "RECUSADA"}, constantesDe("StatusSolicitacao"));
    }

    private static String[] constantesDe(String nome) throws ClassNotFoundException {
        Class<?> tipo = Class.forName("conecta.demo.model." + nome);
        assertTrue(tipo.isEnum(), nome + " nao e enum");
        return Arrays.stream(tipo.getEnumConstants()).map(Object::toString).toArray(String[]::new);
    }

    private static Class<?> classeDe(String nome) {
        try {
            return Class.forName("conecta.demo.model." + nome);
        } catch (ClassNotFoundException e) {
            throw new AssertionError("Entidade nao encontrada: conecta.demo.model." + nome, e);
        }
    }
}
