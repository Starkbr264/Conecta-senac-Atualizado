package conecta.demo.controller;

import conecta.demo.dto.ReservaRequest;
import conecta.demo.model.Reserva;
import conecta.demo.service.ReservaService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reservas")
public class ReservaController {

    private final ReservaService service;

    public ReservaController(ReservaService service) {
        this.service = service;
    }

    @GetMapping
    public List<Reserva> listar(@RequestParam(required = false) Long unidadeId) {
        return service.listar(unidadeId);
    }

    @GetMapping("/{id}")
    public Reserva buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Reserva criar(@Valid @RequestBody ReservaRequest request) {
        return service.criar(request);
    }

    @PutMapping("/{id}")
    public Reserva atualizar(@PathVariable Long id, @Valid @RequestBody ReservaRequest request) {
        return service.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelar(@PathVariable Long id) {
        service.cancelar(id);
    }

}
