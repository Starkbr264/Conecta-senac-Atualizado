package conecta.demo;

import conecta.demo.exception.AcessoNegadoException;
import conecta.demo.model.Perfil;
import conecta.demo.service.SincService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SincAuthorizationRulesTest {
    @Test
    void instrutorNaoPodeSincronizarUsuarios() {
        assertThrows(AcessoNegadoException.class,
                () -> SincService.validarPermissaoSincronizacao("usuarios", Perfil.INSTRUTOR));
    }

    @Test
    void coordenadorPodeSincronizarSalas() {
        assertDoesNotThrow(() ->
                SincService.validarPermissaoSincronizacao("salas", Perfil.COORDENADOR));
    }

    @Test
    void perfilAusenteNaoPodeSincronizar() {
        assertThrows(AcessoNegadoException.class,
                () -> SincService.validarPermissaoSincronizacao("salas", null));
    }

    @Test
    void colecaoDesconhecidaNaoPodeSerSincronizada() {
        assertThrows(AcessoNegadoException.class,
                () -> SincService.validarPermissaoSincronizacao("colecao-inexistente", Perfil.ADMIN));
    }
}
