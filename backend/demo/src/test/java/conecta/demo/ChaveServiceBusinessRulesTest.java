package conecta.demo;

import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Chave;
import conecta.demo.model.Perfil;
import conecta.demo.model.StatusChave;
import conecta.demo.model.Usuario;
import conecta.demo.repository.ChaveRepository;
import conecta.demo.repository.SalaRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.service.ChaveService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChaveServiceBusinessRulesTest {
    @Mock ChaveRepository chaves;
    @Mock SalaRepository salas;
    @Mock UsuarioRepository usuarios;

    @Test
    void rejeitaRetiradaPorInstrutorDeOutraUnidade() {
        Chave chave = new Chave();
        chave.setId(1L);
        chave.setUnidadeId(1L);
        chave.setStatus(StatusChave.DISPONIVEL);
        Usuario instrutor = new Usuario();
        instrutor.setId(2L);
        instrutor.setPerfil(Perfil.INSTRUTOR);
        instrutor.setUnidadeId(2L);
        when(chaves.findById(1L)).thenReturn(java.util.Optional.of(chave));
        when(usuarios.findById(2L)).thenReturn(java.util.Optional.of(instrutor));

        ChaveService service = new ChaveService(chaves, salas, usuarios);
        assertThrows(RegraDeNegocioException.class, () -> service.retirar(1L, 2L));
    }
}
