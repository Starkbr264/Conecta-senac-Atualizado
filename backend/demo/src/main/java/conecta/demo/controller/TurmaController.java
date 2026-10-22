package conecta.demo.controller;

import conecta.demo.model.Turma;
import conecta.demo.service.TurmaService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/turmas")
public class TurmaController {

    private final TurmaService service;

    public TurmaController(TurmaService service) {
        this.service = service;
    }

    @GetMapping
    public List<Turma> listar(@RequestParam(required = false) Long unidadeId) {
        return service.listar(unidadeId);
    }

    @GetMapping("/{id}")
    public Turma buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PreAuthorize("hasAnyRole('ADMIN','COORDENADOR')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Turma criar(@Valid @RequestBody Turma turma) {
        return service.criar(turma);
    }

    @PreAuthorize("hasAnyRole('ADMIN','COORDENADOR')")
    @PutMapping("/{id}")
    public Turma atualizar(@PathVariable Long id, @Valid @RequestBody Turma entrada) {
        return service.atualizar(id, entrada);
    }

    @PreAuthorize("hasAnyRole('ADMIN','COORDENADOR')")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        service.excluir(id);
    }

}
