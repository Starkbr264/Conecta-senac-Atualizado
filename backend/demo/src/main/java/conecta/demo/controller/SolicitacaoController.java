package conecta.demo.controller;

import conecta.demo.dto.RespostaSolicitacaoRequest;
import conecta.demo.dto.SolicitacaoRequest;
import conecta.demo.model.Solicitacao;
import conecta.demo.service.SolicitacaoService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/solicitacoes")
public class SolicitacaoController {

    private final SolicitacaoService service;

    public SolicitacaoController(SolicitacaoService service) {
        this.service = service;
    }

    @GetMapping
    public List<Solicitacao> listar(@RequestParam(required = false) Long unidadeId, @RequestParam(required = false) Long instrutorId) {
        return service.listar(unidadeId, instrutorId);
    }

    @GetMapping("/{id}")
    public Solicitacao buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PostMapping
    public ResponseEntity<Solicitacao> criar(@Valid @RequestBody SolicitacaoRequest request) {
        Solicitacao criada = service.criar(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(criada.getId())
                .toUri();
        return ResponseEntity.created(location).body(criada);
    }

    @PostMapping("/{id}/resposta")
    public Solicitacao responder(@PathVariable Long id, @Valid @RequestBody RespostaSolicitacaoRequest request) {
        return service.responder(id, request);
    }

}
