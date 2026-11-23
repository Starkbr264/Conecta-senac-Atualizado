package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;

import conecta.demo.controller.SolicitacaoController;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

class SolicitacaoLifecycleApiTest {
    @Test
    void cancelamentoExigeCoordenadorOuAdministrador() throws Exception {
        Method method = SolicitacaoController.class.getMethod("cancelar", Long.class,
                conecta.demo.dto.CancelamentoSolicitacaoRequest.class);
        assertThat(method.getAnnotation(PreAuthorize.class).value())
                .isEqualTo("hasAnyRole('ADMIN','COORDENADOR')");
    }
}
