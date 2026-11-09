package conecta.demo.service;

import conecta.demo.dto.LoginRequest;
import conecta.demo.dto.UsuarioResponse;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.exception.RecursoNaoEncontradoException;
import conecta.demo.model.Usuario;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.validation.EmailInstitucional;
import java.util.List;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UsuarioService {
    public static final int TAMANHO_MINIMO_SENHA = 8;
    private final UsuarioRepository usuarios;
    private final UnidadeRepository unidades;
    private final IdAllocatorService ids;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public UsuarioService(UsuarioRepository usuarios, UnidadeRepository unidades) {
        this(usuarios, unidades, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public UsuarioService(UsuarioRepository usuarios, UnidadeRepository unidades, IdAllocatorService ids) {
        this.usuarios = usuarios;
        this.unidades = unidades;
        this.ids = ids;
    }

    /** Hash BCrypt para senhas em texto puro. */
    public String hashSenha(String senha) {
        return encoder.encode(senha);
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
        // Nova criacao: sempre exige o e-mail institucional.
        usuario.setEmail(EmailInstitucional.validar(usuario.getEmail()));
        validar(usuario);
        if (usuario.getSenha() == null || usuario.getSenha().isBlank())
            throw new RegraDeNegocioException("Senha e obrigatoria");
        if (usuarios.findByEmailIgnoreCase(usuario.getEmail()).isPresent())
            throw new RegraDeNegocioException("E-mail ja cadastrado");
        usuario.setId(proximoId());
        usuario.setSenha(hashSenha(usuario.getSenha()));
        return usuarios.save(usuario);
    }

    /** Valida um usuario materializado pelo lote de sincronizacao sem persisti-lo. */
    void validarParaSincronizacao(Usuario usuario) {
        validar(usuario);
    }

    private Long proximoId() {
        if (ids != null) return ids.next("usuarios", () -> usuarios.findAll().stream().mapToLong(Usuario::getId).max().orElse(0L));
        return usuarios.findAll().stream().mapToLong(Usuario::getId).max().orElse(0L) + 1;
    }

    public Usuario atualizar(Long id, Usuario entrada) {
        Usuario atual = buscar(id);
        // Politica institucional vale para TROCA de e-mail; sem troca, o valor
        // antigo e preservado (contas legadas continuam editaveis).
        entrada.setEmail(EmailInstitucional.aplicar(entrada.getEmail(), atual.getEmail()));
        validar(entrada);
        usuarios.findByEmailIgnoreCase(entrada.getEmail()).filter(u -> !u.getId().equals(id)).ifPresent(u -> {
            throw new RegraDeNegocioException("E-mail ja cadastrado");
        });
        atual.setNome(entrada.getNome());
        atual.setEmail(entrada.getEmail());
        if (entrada.getSenha() != null && !entrada.getSenha().isBlank()) {
            atual.setSenha(hashSenha(entrada.getSenha()));
        }
        atual.setPerfil(entrada.getPerfil());
        atual.setUnidadeId(entrada.getUnidadeId());
        return usuarios.save(atual);
    }

    public void excluir(Long id) {
        usuarios.delete(buscar(id));
    }

    @Transactional(readOnly = true)
    public UsuarioResponse login(LoginRequest request) {
        Usuario usuario = usuarios.findByEmailIgnoreCase(request.email())
                .filter(u -> encoder.matches(request.senha(), u.getSenha()))
                .orElseThrow(() -> new RegraDeNegocioException("E-mail ou senha invalidos"));
        return UsuarioResponse.from(usuario);
    }

    private void validar(Usuario usuario) {
        if (usuario.getUnidadeId() == null || !unidades.existsById(usuario.getUnidadeId()))
            throw new RegraDeNegocioException("Unidade informada nao existe");
        if (usuario.getSenha() != null && !usuario.getSenha().isBlank()
                && usuario.getSenha().length() < TAMANHO_MINIMO_SENHA)
            throw new RegraDeNegocioException("A senha deve ter pelo menos " + TAMANHO_MINIMO_SENHA + " caracteres");
    }
}
