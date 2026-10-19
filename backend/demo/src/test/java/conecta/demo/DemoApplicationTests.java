package conecta.demo;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DemoApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void contextLoads() {
    }

    @Test
    void aprovarSolicitacaoCriaUmaReservaPorTurno() throws Exception {
        long unidadeId = criar("/api/unidades", "{\"nome\":\"Senac Asa Norte\",\"cep\":\"70000-000\",\"cidade\":\"Brasilia\",\"endereco\":\"SGAN\"}");
        long instrutorId = criar("/api/usuarios", "{\"nome\":\"Instrutor\",\"email\":\"instrutor@senac.test\",\"senha\":\"senha\",\"perfil\":\"instrutor\",\"unidadeId\":" + unidadeId + "}");
        long salaId = criar("/api/salas", "{\"nome\":\"Laboratorio 1\",\"tipo\":\"Laboratorio\",\"capacidade\":25,\"andar\":\"Terreo\",\"bloco\":\"A\",\"unidadeId\":" + unidadeId + "}");
        long solicitacaoId = criar("/api/solicitacoes", "{\"salaId\":" + salaId + ",\"instrutorId\":" + instrutorId + ",\"turnos\":[\"Matutino\",\"Vespertino\"],\"data\":\"2026-09-01\",\"dataInicio\":\"2026-09-01\",\"dataFim\":\"2026-09-01\",\"diasSemana\":[\"ter\"],\"motivo\":\"Aula pratica\",\"unidadeId\":" + unidadeId + "}");

        mockMvc.perform(post("/api/solicitacoes/{id}/resposta", solicitacaoId).contentType(MediaType.APPLICATION_JSON).content("{\"decisao\":\"aprovar\",\"resposta\":\"Aprovada\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("aprovada"));

        mockMvc.perform(get("/api/reservas").param("unidadeId", String.valueOf(unidadeId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    private long criar(String url, String json) throws Exception {
        String resposta = mockMvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        JsonNode body = objectMapper.readTree(resposta);
        return body.get("id").asLong();
    }

}
