package conecta.demo.controller;

import conecta.demo.model.Sala;
import conecta.demo.dto.SalaStatusResponse;
import conecta.demo.service.SalaService;
import conecta.demo.service.SalaStatusService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.List;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/salas")
public class SalaController {

    private final SalaService service;
    private final SalaStatusService statusService;

    /** Construtor mantido para os testes unitários legados do CRUD de salas. */
    public SalaController(SalaService service) {
        this(service, null);
    }

    @Autowired
    public SalaController(SalaService service, SalaStatusService statusService) {
        this.service = service;
        this.statusService = statusService;
    }

    @GetMapping
    public List<Sala> listar(@RequestParam(required = false) Long unidadeId) {
        return service.listar(unidadeId);
    }

    @GetMapping("/status")
    public List<SalaStatusResponse> status(
            @RequestParam(required = false) Long unidadeId,
            @RequestParam(required = false) LocalDate inicio,
            @RequestParam(required = false) LocalDate fim,
            @RequestParam(required = false) String horaInicio,
            @RequestParam(required = false) String horaFim,
            @RequestParam(required = false) String turno) {
        return statusService.listar(unidadeId, inicio, fim, horaInicio, horaFim, turno);
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
    public Sala atualizar(@PathVariable Long id, @Valid @RequestBody Sala sala) {
        return service.atualizar(id, sala);
    }

    @PreAuthorize("hasAnyRole('ADMIN','COORDENADOR')")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        service.excluir(id);
    }

}
