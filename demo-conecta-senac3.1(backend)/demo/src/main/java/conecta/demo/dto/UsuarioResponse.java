package conecta.demo.dto;

import conecta.demo.model.Usuario;

public record UsuarioResponse(Long id, String nome, String email, String perfil, Long unidadeId) {

    public static UsuarioResponse from(Usuario user) {
        return new UsuarioResponse(
                user.getId(),
                user.getNome(),
                user.getEmail(),
                user.getPerfil().name().toLowerCase(),
                user.getUnidadeId()
        );
    }

}
