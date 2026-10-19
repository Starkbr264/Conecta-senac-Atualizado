package conecta.demo.service;

import conecta.demo.dto.LoginRequest;
import conecta.demo.dto.UsuarioResponse;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Usuario;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UsuarioService {
    private final UsuarioRepository usuarios;
    private final UnidadeRepository unidades;

    public UsuarioService(UsuarioRepository usuarios, UnidadeRepository unidades) {
        this.usuarios = usuarios;
        this.unidades = unidades;
    }

    @Transactional(readOnly = true)
    public List<Usuario> listar() {
        return usuarios.findAll();
    }

    @Transactional(readOnly = true)
    public Usuario buscar(Long id) {
        return usuarios.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuario", id));
    }

    public Usuario criar(Usuario usuario) {
        validar(usuario);
        if (usuarios.findByEmailIgnoreCase(usuario.getEmail()).isPresent())
            throw new RegraDeNegocioException("E-mail ja cadastrado");
        usuario.setId(proximoId());
        return usuarios.save(usuario);
    }

    private Long proximoId() {
        return usuarios.findAll().stream().mapToLong(Usuario::getId).max().orElse(0L) + 1;
    }

    public Usuario atualizar(Long id, Usuario entrada) {
        Usuario atual = buscar(id);
        validar(entrada);
        usuarios.findByEmailIgnoreCase(entrada.getEmail()).filter(u -> !u.getId().equals(id)).ifPresent(u -> {
            throw new RegraDeNegocioException("E-mail ja cadastrado");
        });
        atual.setNome(entrada.getNome());
        atual.setEmail(entrada.getEmail());
        atual.setSenha(entrada.getSenha());
        atual.setPerfil(entrada.getPerfil());
        atual.setUnidadeId(entrada.getUnidadeId());
        return usuarios.save(atual);
    }

    public void excluir(Long id) {
        usuarios.delete(buscar(id));
    }

    @Transactional(readOnly = true)
    public UsuarioResponse login(LoginRequest request) {
        Usuario usuario = usuarios.findByEmailIgnoreCase(request.email()).filter(u -> u.getSenha().equals(request.senha())).orElseThrow(() -> new RegraDeNegocioException("E-mail ou senha invalidos"));
        return UsuarioResponse.from(usuario);
    }

    private void validar(Usuario usuario) {
        if (!unidades.existsById(usuario.getUnidadeId()))
            throw new RegraDeNegocioException("Unidade informada nao existe");
    }
}
