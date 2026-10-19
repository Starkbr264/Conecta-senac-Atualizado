package conecta.demo;

import conecta.demo.controller.SolicitacaoController;
import conecta.demo.dto.SolicitacaoRequest;
import conecta.demo.exception.ApiExceptionHandler;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Solicitacao;
import conecta.demo.model.StatusSolicitacao;
import conecta.demo.service.SolicitacaoService;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Camada HTTP de {@link SolicitacaoController}.
 *
 * <p>Caso valido: 201 + header {@code Location} apontando para a solicitacao
 * criada. Caso invalido: 409 (via {@link RegraDeNegocioException}).</p>
 *
 * <p>{@link MockMvcBuilders#standaloneSetup} — sem contexto de Spring, sem banco.</p>
 */
@ExtendWith(MockitoExtension.class)
class SolicitacaoControllerTest {

    private static final String CORPO_VALIDO =
            "{\"salaId\":10,\"instrutorId\":20,\"turnos\":[\"Matutino\"],"
            + "\"data\":\"2026-09-01\",\"dataInicio\":\"2026-09-01\",\"dataFim\":\"2026-09-01\","
            + "\"diasSemana\":[\"seg\"],\"motivo\":\"Aula pratica\",\"unidadeId\":1}";

    @Mock
    private SolicitacaoService service;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new SolicitacaoController(service))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("POST /api/solicitacaoes valido responde 201 com Location")
    void criarValidoResponde201ComLocation() throws Exception {
        Solicitacao criada = new Solicitacao();
        criada.setId(30L);
        criada.setStatus(StatusSolicitacao.PENDENTE);
        when(service.criar(any(SolicitacaoRequest.class))).thenReturn(criada);

        mockMvc.perform(post("/api/solicitacoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_VALIDO))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(header().string("Location", org.hamcrest.Matchers.endsWith("/api/solicitacoes/30")))
                .andExpect(jsonPath("$.id").value(30));
    }

    @Test
    @DisplayName("POST /api/solicitacoes com unidade divergente responde 409")
    void criarInvalidoResponde409() throws Exception {
        when(service.criar(any(SolicitacaoRequest.class)))
                .thenThrow(new RegraDeNegocioException("Solicitacao deve usar instrutor, sala e unidade compativeis"));

        mockMvc.perform(post("/api/solicitacoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_VALIDO))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("POST /api/solicitacoes com sala inexistente responde 404")
    void criarComSalaInexistenteResponde404() throws Exception {
        when(service.criar(any(SolicitacaoRequest.class)))
                .thenThrow(new conecta.demo.exception.RecursoNaoEncontradoException("Sala", 10L));

        mockMvc.perform(post("/api/solicitacoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_VALIDO))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/solicitacoes devolve a lista do servico")
    void listarDevolveListaDoServico() throws Exception {
        Solicitacao s = new Solicitacao();
        s.setId(30L);
        when(service.listar(null, null)).thenReturn(java.util.List.of(s));

        mockMvc.perform(get("/api/solicitacoes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    @DisplayName("GET /api/solicitacoes/{id} devolve a solicitacao")
    void buscarDevolveSolicitacao() throws Exception {
        Solicitacao s = new Solicitacao();
        s.setId(30L);
        when(service.buscar(30L)).thenReturn(s);

        mockMvc.perform(get("/api/solicitacoes/30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(30));
    }

    @Test
    @DisplayName("GET /api/solicitacoes/{id} inexistente responde 404")
    void buscarInexistenteResponde404() throws Exception {
        when(service.buscar(30L))
                .thenThrow(new conecta.demo.exception.RecursoNaoEncontradoException("Solicitacao", 30L));

        mockMvc.perform(get("/api/solicitacoes/30"))
                .andExpect(status().isNotFound());
    }
}
