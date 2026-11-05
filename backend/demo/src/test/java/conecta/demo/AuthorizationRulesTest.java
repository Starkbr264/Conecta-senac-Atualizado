package conecta.demo;

import conecta.demo.controller.ChaveController;
import conecta.demo.controller.ReservaController;
import conecta.demo.controller.SolicitacaoController;
import conecta.demo.controller.UsuarioController;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class AuthorizationRulesTest {
    @Test
    void escritaDeReservaExigeAdministradorOuCoordenador() throws Exception {
        Method method = ReservaController.class.getMethod("criar", conecta.demo.dto.ReservaRequest.class);
        assertEquals("hasAnyRole('ADMIN','COORDENADOR')", method.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void respostaDeSolicitacaoExigeCoordenadorOuAdministrador() throws Exception {
        Method method = SolicitacaoController.class.getMethod("responder", Long.class,
                conecta.demo.dto.RespostaSolicitacaoRequest.class);
        assertEquals("hasAnyRole('ADMIN','COORDENADOR')", method.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void controleDeChavesExigeRecepcaoOuAdministrador() throws Exception {
        Method method = ChaveController.class.getMethod("criar", conecta.demo.model.Chave.class);
        assertNotNull(method.getAnnotation(PreAuthorize.class));
        assertEquals("hasAnyRole('ADMIN','RECEPCAO')", method.getAnnotation(PreAuthorize.class).value());
    }

    @Test
    void listagemDeUsuariosExigeAdministrador() throws Exception {
        Method method = UsuarioController.class.getMethod("listar");
        assertEquals("hasRole('ADMIN')", method.getAnnotation(PreAuthorize.class).value());
    }
}
