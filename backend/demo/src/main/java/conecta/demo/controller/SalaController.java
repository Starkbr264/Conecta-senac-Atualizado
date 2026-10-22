package conecta.demo.controller;

import conecta.demo.model.Sala;
import conecta.demo.service.SalaService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/salas")
public class SalaController {

    private final SalaService service;

    public SalaController(SalaService service) {
        this.service = service;
    }

    @GetMapping
    public List<Sala> listar(@RequestParam(required = false) Long unidadeId) {
        return service.listar(unidadeId);
    }

    @GetMapping("/{id}")
    public Sala buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PreAuthorize("hasAnyRole('ADMIN','COORDENADOR')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Sala criar(@Valid @RequestBody Sala sala) {
        return service.criar(sala);
    }

    @PreAuthorize("hasAnyRole('ADMIN','COORDENADOR')")
    @PutMapping("/{id}")
    public Sala atualizar(@PathVariable Long id,
                           @RequestHeader(value = "X-Usuario-Id", required = false) Long usuarioId,
                           @Valid @RequestBody Sala sala) {
        return service.atualizar(id, usuarioId, sala);
    }

    @PreAuthorize("hasAnyRole('ADMIN','COORDENADOR')")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        service.excluir(id);
    }

}
