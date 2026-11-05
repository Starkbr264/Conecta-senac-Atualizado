package conecta.demo;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Perfil;
import conecta.demo.model.Usuario;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.service.UsuarioService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceBusinessRulesTest {
    @Mock UsuarioRepository usuarios;
    @Mock UnidadeRepository unidades;

    @Test
    void rejeitaSenhaCurtaAoCriarUsuario() {
        Usuario usuario = new Usuario();
        usuario.setNome("Teste");
        usuario.setEmail("teste@senac.test");
        usuario.setSenha("123");
        usuario.setPerfil(Perfil.INSTRUTOR);
        usuario.setUnidadeId(1L);
        when(unidades.existsById(1L)).thenReturn(true);

        UsuarioService service = new UsuarioService(usuarios, unidades);
        assertThrows(RegraDeNegocioException.class, () -> service.criar(usuario));
    }
}
