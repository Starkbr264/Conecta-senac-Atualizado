package conecta.demo.controller;

import conecta.demo.model.Chave;
import conecta.demo.service.ChaveService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/chaves")
public class ChaveController {

    private final ChaveService service;

    public ChaveController(ChaveService service) {
        this.service = service;
    }

    @GetMapping
    public List<Chave> listar(@RequestParam(required = false) Long unidadeId) {
        return service.listar(unidadeId);
    }

    @GetMapping("/{id}")
    public Chave buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCAO')")
    @ResponseStatus(HttpStatus.CREATED)
    public Chave criar(@Valid @RequestBody Chave chave) {
        return service.criar(chave);
    }

    @PostMapping("/{id}/retirada")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCAO','INSTRUTOR')")
    public Chave retirar(@PathVariable Long id, @RequestBody RetiradaRequest request) {
        return service.retirar(id, request.instrutorId());
    }

    @PostMapping("/{id}/devolucao")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPCAO','INSTRUTOR')")
    public Chave devolver(@PathVariable Long id) {
        return service.devolver(id);
    }

    public record RetiradaRequest(@NotNull Long instrutorId) { }

}
