package conecta.demo.controller;

import conecta.demo.model.Unidade;
import conecta.demo.service.UnidadeService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/unidades")
public class UnidadeController {

    private final UnidadeService service;

    public UnidadeController(UnidadeService service) {
        this.service = service;
    }

    @GetMapping
    public List<Unidade> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public Unidade buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Unidade criar(@Valid @RequestBody Unidade unidade) {
        return service.criar(unidade);
    }

    @PutMapping("/{id}")
    public Unidade atualizar(@PathVariable Long id, @Valid @RequestBody Unidade entrada) {
        return service.atualizar(id, entrada);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        service.excluir(id);
    }

}
