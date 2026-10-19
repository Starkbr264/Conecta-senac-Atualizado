package conecta.demo;

import conecta.demo.controller.SalaController;
import conecta.demo.exception.AcessoNegadoException;
import conecta.demo.exception.ApiExceptionHandler;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Sala;
import conecta.demo.service.SalaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Camada HTTP de {@link SalaController} — 201 na criacao e 403 quando o usuario
 * pertence a outra unidade.
 *
 * <p>Usa {@link MockMvcBuilders#standaloneSetup}: o MockMvc completo (status,
 * body e mapeamento de excecoes via {@code ApiExceptionHandler}) sem subir o
 * contexto do Spring nem tocar o banco.</p>
 */
@ExtendWith(MockitoExtension.class)
class SalaControllerTest {

    private static final String CORPO_SALA =
            "{\"nome\":\"Laboratorio 1\",\"tipo\":\"Laboratorio\",\"capacidade\":25,"
            + "\"andar\":\"Terreo\",\"bloco\":\"A\",\"unidadeId\":1}";

    @Mock
    private SalaService service;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new SalaController(service))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("POST /api/salas valido responde 201")
    void criarResponde201() throws Exception {
        Sala salva = new Sala();
        salva.setId(1L);
        when(service.criar(any(Sala.class))).thenReturn(salva);

        mockMvc.perform(post("/api/salas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_SALA))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("POST /api/salas com unidade inexistente responde 409")
    void criarComUnidadeInexistenteResponde409() throws Exception {
        when(service.criar(any(Sala.class)))
                .thenThrow(new RegraDeNegocioException("Unidade informada nao existe"));

        mockMvc.perform(post("/api/salas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_SALA))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("PUT /api/salas/{id} do usuario da mesma unidade responde 200")
    void atualizarMesmaUnidadeResponde200() throws Exception {
        Sala salva = new Sala();
        salva.setId(1L);
        when(service.atualizar(anyLong(), anyLong(), any(Sala.class))).thenReturn(salva);

        mockMvc.perform(put("/api/salas/1")
                        .header("X-Usuario-Id", "20")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_SALA))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("PUT /api/salas/{id} de outra unidade responde 403")
    void atualizarOutraUnidadeResponde403() throws Exception {
        when(service.atualizar(anyLong(), anyLong(), any(Sala.class)))
                .thenThrow(new AcessoNegadoException("Nao e possivel atualizar salas de outras unidades"));

        mockMvc.perform(put("/api/salas/1")
                        .header("X-Usuario-Id", "20")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_SALA))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PUT /api/salas/{id} sem cabecalho de usuario responde 403")
    void atualizarSemUsuarioResponde403() throws Exception {
        when(service.atualizar(anyLong(), any(), any(Sala.class)))
                .thenThrow(new AcessoNegadoException("Identificacao do usuario e obrigatoria para alterar sala"));

        mockMvc.perform(put("/api/salas/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_SALA))
                .andExpect(status().isForbidden());
    }
}
