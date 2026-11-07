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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.any;

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

    @Test
    void rejeitaSenhaCurtaAoAtualizarUsuarioSemExporSenha() {
        Usuario atual = new Usuario();
        atual.setId(10L);
        atual.setNome("Atual");
        atual.setEmail("atual@senac.test");
        atual.setSenha("$2a$10$hash");
        atual.setPerfil(Perfil.INSTRUTOR);
        atual.setUnidadeId(1L);

        Usuario entrada = new Usuario();
        entrada.setNome("Atualizado");
        entrada.setEmail("atual@senac.test");
        entrada.setSenha("curta");
        entrada.setPerfil(Perfil.INSTRUTOR);
        entrada.setUnidadeId(1L);

        when(usuarios.findById(10L)).thenReturn(java.util.Optional.of(atual));
        when(unidades.existsById(1L)).thenReturn(true);

        RegraDeNegocioException erro = assertThrows(RegraDeNegocioException.class,
                () -> new UsuarioService(usuarios, unidades).atualizar(10L, entrada));

        assertFalse(erro.getMessage().contains("curta"));
    }

    @Test
    void aceitaSenhaValidaAoAtualizarUsuarioEArmazenaHash() {
        Usuario atual = new Usuario();
        atual.setId(11L);
        atual.setNome("Atual");
        atual.setEmail("atual.valido@senac.test");
        atual.setSenha("$2a$10$hash");
        atual.setPerfil(Perfil.INSTRUTOR);
        atual.setUnidadeId(1L);

        Usuario entrada = new Usuario();
        entrada.setNome("Atualizado");
        entrada.setEmail("atual.valido@senac.test");
        entrada.setSenha("Senha.123");
        entrada.setPerfil(Perfil.INSTRUTOR);
        entrada.setUnidadeId(1L);

        when(usuarios.findById(11L)).thenReturn(java.util.Optional.of(atual));
        when(usuarios.findByEmailIgnoreCase("atual.valido@senac.test"))
                .thenReturn(java.util.Optional.of(atual));
        when(unidades.existsById(1L)).thenReturn(true);
        when(usuarios.save(any(Usuario.class))).thenAnswer(invocacao -> invocacao.getArgument(0));

        Usuario resultado = new UsuarioService(usuarios, unidades).atualizar(11L, entrada);

        assertNotNull(resultado.getSenha());
        org.assertj.core.api.Assertions.assertThat(resultado.getSenha()).startsWith("$2");
    }
}
