package conecta.demo;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Perfil;
import conecta.demo.model.Turma;
import conecta.demo.model.Usuario;
import conecta.demo.repository.ReservaRepository;
import conecta.demo.repository.TurmaRepository;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.service.TurmaService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TurmaServiceBusinessRulesTest {
    @Mock TurmaRepository turmas;
    @Mock UnidadeRepository unidades;
    @Mock UsuarioRepository usuarios;
    @Mock ReservaRepository reservas;

    @Test
    void rejeitaInstrutorDeOutraUnidade() {
        Turma turma = new Turma();
        turma.setNome("T");
        turma.setCodigo("T-1");
        turma.setCurso("Curso");
        turma.setTurno("Matutino");
        turma.setUnidadeId(1L);
        turma.setInstrutorId(2L);
        Usuario instrutor = new Usuario();
        instrutor.setId(2L);
        instrutor.setPerfil(Perfil.INSTRUTOR);
        instrutor.setUnidadeId(2L);
        when(unidades.existsById(1L)).thenReturn(true);
        when(usuarios.findById(2L)).thenReturn(java.util.Optional.of(instrutor));

        TurmaService service = new TurmaService(turmas, unidades, usuarios, reservas);
        assertThrows(RegraDeNegocioException.class, () -> service.criar(turma));
    }
}
