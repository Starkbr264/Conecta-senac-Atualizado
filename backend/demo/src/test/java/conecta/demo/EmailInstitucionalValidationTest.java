package conecta.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import conecta.demo.exception.EmailInstitucionalInvalidoException;
import conecta.demo.exception.RegraDeNegocioException;
import conecta.demo.model.Perfil;
import conecta.demo.model.Usuario;
import conecta.demo.repository.UnidadeRepository;
import conecta.demo.repository.UsuarioRepository;
import conecta.demo.service.UsuarioService;
import conecta.demo.validation.EmailInstitucional;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Politica de e-mail institucional {@code @edu.df.senac.br} — regras de formato
 * (casos 1 a 11 do plano de testes) aplicadas de forma centralizada.
 */
@ExtendWith(MockitoExtension.class)
class EmailInstitucionalValidationTest {

    @Mock UsuarioRepository usuarios;
    @Mock UnidadeRepository unidades;

    private static String erroDe(Runnable acao) {
        try {
            acao.run();
            return null;
        } catch (EmailInstitucionalInvalidoException e) {
            return e.getMessage();
        }
    }

    // 1) Dominio institucional correto.
    @Test
    void aceitaDominioInstitucionalCorreto() {
        assertThat(EmailInstitucional.validar("joao@edu.df.senac.br"))
                .isEqualTo("joao@edu.df.senac.br");
        assertThat(EmailInstitucional.validar("maria.silva@edu.df.senac.br"))
                .isEqualTo("maria.silva@edu.df.senac.br");
        assertThat(EmailInstitucional.validar("202600123@edu.df.senac.br"))
                .isEqualTo("202600123@edu.df.senac.br");
        assertThat(EmailInstitucional.validar("aluno_01@edu.df.senac.br"))
                .isEqualTo("aluno_01@edu.df.senac.br");
    }

    // 2) Dominio Gmail.
    @Test
    void rejeitaDominioGmail() {
        assertThat(erroDe(() -> EmailInstitucional.validar("usuario@gmail.com")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
    }

    // 3) Dominio Hotmail.
    @Test
    void rejeitaDominioHotmail() {
        assertThat(erroDe(() -> EmailInstitucional.validar("usuario@hotmail.com")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
    }

    // 4) Dominios incorretos, subdominios e extensoes extras.
    @Test
    void rejeitaDominiosIncorretos() {
        assertThat(erroDe(() -> EmailInstitucional.validar("usuario@senac.br")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
        assertThat(erroDe(() -> EmailInstitucional.validar("usuario@edu.df.com.br")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
        assertThat(erroDe(() -> EmailInstitucional.validar("usuario@edu.df.senac.com")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
        assertThat(erroDe(() -> EmailInstitucional.validar("usuario@edu.df.senac.br.com")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
        assertThat(erroDe(() -> EmailInstitucional.validar("usuario@sub.edu.df.senac.br")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
    }

    // 5) Nome de usuario com exatamente 16 caracteres.
    @Test
    void aceitaParteLocalComExatamente16Caracteres() {
        String dezesseis = "abcdefghijklmnop"; // 16
        assertThat(dezesseis).hasSize(16);
        assertThat(EmailInstitucional.validar(dezesseis + EmailInstitucional.DOMINIO))
                .isEqualTo(dezesseis + EmailInstitucional.DOMINIO);
    }

    // 6) Nome de usuario com 17 caracteres.
    @Test
    void rejeitaParteLocalCom17Caracteres() {
        String dezessete = "abcdefghijklmnopq"; // 17
        assertThat(dezessete).hasSize(17);
        assertThat(erroDe(() -> EmailInstitucional.validar(dezessete + EmailInstitucional.DOMINIO)))
                .isEqualTo(EmailInstitucional.ERRO_LIMITE);
    }

    // 7) E-mail sem parte anterior ao dominio.
    @Test
    void rejeitaSemParteAnteriorAoDominio() {
        assertThat(erroDe(() -> EmailInstitucional.validar("@edu.df.senac.br")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
    }

    // 8) E-mail com espacos.
    @Test
    void rejeitaEspacosNoMeioENormalizaPontas() {
        assertThat(erroDe(() -> EmailInstitucional.validar("joao silva@edu.df.senac.br")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
        assertThat(erroDe(() -> EmailInstitucional.validar("joao@edu.df.senac .br")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
        // Espacos apenas nas pontas sao removidos (normalizacao).
        assertThat(EmailInstitucional.validar("  joao@edu.df.senac.br  "))
                .isEqualTo("joao@edu.df.senac.br");
    }

    // 9) E-mail com dois simbolos @.
    @Test
    void rejeitaDoisSimbolosArroba() {
        assertThat(erroDe(() -> EmailInstitucional.validar("joao@@edu.df.senac.br")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
        assertThat(erroDe(() -> EmailInstitucional.validar("joao@edu.df.senac.br@x")))
                .isEqualTo(EmailInstitucional.ERRO_INVALIDO);
    }

    // 10) Dominio em letras maiusculas.
    @Test
    void aceitaDominioEmMaiusculasENormalizaParaMinusculas() {
        assertThat(EmailInstitucional.validar("JOAO@EDU.DF.SENAC.BR"))
                .isEqualTo("joao@edu.df.senac.br");
        assertThat(EmailInstitucional.validar("Maria.Silva@Edu.Df.Senac.Br"))
                .isEqualTo("maria.silva@edu.df.senac.br");
    }

    // Campo vazio.
    @Test
    void rejeitaCampoVazio() {
        assertThat(erroDe(() -> EmailInstitucional.validar(null)))
                .isEqualTo(EmailInstitucional.ERRO_OBRIGATORIO);
        assertThat(erroDe(() -> EmailInstitucional.validar("   ")))
                .isEqualTo(EmailInstitucional.ERRO_OBRIGATORIO);
    }

    // 11) Duplicidade com capitalizacao diferente (via UsuarioService).
    @Test
    void rejeitaDuplicidadeComCapitalizacaoDiferente() {
        Usuario existente = new Usuario();
        existente.setId(1L);
        existente.setEmail("joao@edu.df.senac.br");
        when(usuarios.findByEmailIgnoreCase("joao@edu.df.senac.br"))
                .thenReturn(Optional.of(existente));
        when(unidades.existsById(1L)).thenReturn(true);

        Usuario novo = new Usuario();
        novo.setNome("Joao");
        novo.setEmail("JOAO@EDU.DF.SENAC.BR");
        novo.setSenha("Senha.1234");
        novo.setPerfil(Perfil.INSTRUTOR);
        novo.setUnidadeId(1L);

        UsuarioService service = new UsuarioService(usuarios, unidades);
        assertThatThrownBy(() -> service.criar(novo))
                .isInstanceOf(RegraDeNegocioException.class)
                .hasMessage("E-mail ja cadastrado");
    }

    // 14) Contas antigas: preservadas quando o e-mail NAO e alterado.
    @Test
    void preservaContaAntigaQuandoEmailNaoEAlterado() {
        Usuario legado = new Usuario();
        legado.setId(10L);
        legado.setNome("Conta Legada");
        legado.setEmail("enzo@gmail.com");
        legado.setSenha("$2a$10$hash");
        legado.setPerfil(Perfil.COORDENADOR);
        legado.setUnidadeId(1L);
        when(usuarios.findById(10L)).thenReturn(Optional.of(legado));
        when(unidades.existsById(1L)).thenReturn(true);
        when(usuarios.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Usuario entrada = new Usuario();
        entrada.setNome("Conta Legada Editada");
        entrada.setEmail("enzo@gmail.com"); // mesmo e-mail: sem troca
        entrada.setPerfil(Perfil.COORDENADOR);
        entrada.setUnidadeId(1L);

        UsuarioService service = new UsuarioService(usuarios, unidades);
        Usuario salvo = service.atualizar(10L, entrada);

        assertThat(salvo.getEmail()).isEqualTo("enzo@gmail.com");
    }

    // 14) Contas antigas: a TROCA de e-mail exige o padrao institucional.
    @Test
    void exigePadraoInstitucionalAoTrocarEmailDeContaAntiga() {
        Usuario legado = new Usuario();
        legado.setId(11L);
        legado.setNome("Conta Legada");
        legado.setEmail("enzo@gmail.com");
        legado.setSenha("$2a$10$hash");
        legado.setPerfil(Perfil.COORDENADOR);
        legado.setUnidadeId(1L);
        when(usuarios.findById(11L)).thenReturn(Optional.of(legado));

        Usuario entrada = new Usuario();
        entrada.setNome("Conta Legada");
        entrada.setEmail("novo@hotmail.com"); // troca para dominio particular
        entrada.setPerfil(Perfil.COORDENADOR);
        entrada.setUnidadeId(1L);

        UsuarioService service = new UsuarioService(usuarios, unidades);
        assertThatThrownBy(() -> service.atualizar(11L, entrada))
                .isInstanceOf(EmailInstitucionalInvalidoException.class)
                .hasMessage(EmailInstitucional.ERRO_INVALIDO);
    }
}
