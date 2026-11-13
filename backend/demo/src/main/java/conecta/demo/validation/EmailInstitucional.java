package conecta.demo.validation;

import conecta.demo.exception.EmailInstitucionalInvalidoException;

/**
 * Validacao central do e-mail institucional Senac/DF.
 *
 * <p>Politica unica usada por {@code UsuarioService} (API REST) e
 * {@code SincService} (POST /api/sinc), para que todos os endpoints rejeitem
 * os mesmos formatos com as mesmas mensagens:
 *
 * <ul>
 *   <li>dominio fixo {@code @edu.df.senac.br} (comparado sem distincao de maiusculas);</li>
 *   <li>parte antes do dominio: 1 a {@value #TAMANHO_MAXIMO_USUARIO} caracteres;</li>
 *   <li>sem espacos, sem multiplos {@code @}, sem caracteres invalidos;</li>
 *   <li>normalizacao: trim + letras minusculas.</li>
 * </ul>
 *
 * <p>Erros de formato lancam {@link EmailInstitucionalInvalidoException},
 * mapeada para HTTP 400 pelo {@code ApiExceptionHandler}.
 */
public final class EmailInstitucional {

    /** Dominio institucional obrigatorio. */
    public static final String DOMINIO = "@edu.df.senac.br";

    /** Tamanho maximo da parte antes do dominio. */
    public static final int TAMANHO_MAXIMO_USUARIO = 16;

    public static final String ERRO_INVALIDO = "Utilize um e-mail institucional @edu.df.senac.br.";
    public static final String ERRO_LIMITE = "A parte do e-mail antes do domínio deve ter no máximo 16 caracteres.";
    public static final String ERRO_OBRIGATORIO = "O e-mail institucional é obrigatório.";

    /** Formato aceito da parte local: minusculas, digitos e simbolos simples. */
    private static final String PADRAO_LOCAL = "[a-z0-9._+-]+";

    private EmailInstitucional() {
    }

    /** Remove espacos das pontas e converte para minusculas. */
    public static String normalizar(String email) {
        if (email == null) return null;
        return email.trim().toLowerCase();
    }

    /**
     * Valida o e-mail e devolve a forma normalizada (trim + minusculas).
     *
     * @throws EmailInstitucionalInvalidoException com a mensagem da politica
     */
    public static String validar(String email) {
        if (email == null || email.isBlank()) {
            throw new EmailInstitucionalInvalidoException(ERRO_OBRIGATORIO);
        }
        String normalizado = normalizar(email);

        // Espaco acidental no meio do endereco (nao pego pelo trim).
        if (normalizado.chars().anyMatch(Character::isWhitespace)) {
            throw new EmailInstitucionalInvalidoException(ERRO_INVALIDO);
        }
        // Multiplos simbolos @ (inclusive no meio do dominio).
        int arroba = normalizado.indexOf('@');
        if (arroba != normalizado.lastIndexOf('@')) {
            throw new EmailInstitucionalInvalidoException(ERRO_INVALIDO);
        }
        // Sem parte antes do @ ou dominio diferente do institucional
        // (cobre tambem subdominios extras e extensoes tipo .com / .br.com).
        if (arroba <= 0 || !normalizado.endsWith(DOMINIO)
                || arroba + DOMINIO.length() != normalizado.length()) {
            throw new EmailInstitucionalInvalidoException(ERRO_INVALIDO);
        }

        String local = normalizado.substring(0, arroba);
        if (local.length() > TAMANHO_MAXIMO_USUARIO) {
            throw new EmailInstitucionalInvalidoException(ERRO_LIMITE);
        }
        if (!local.matches(PADRAO_LOCAL)) {
            throw new EmailInstitucionalInvalidoException(ERRO_INVALIDO);
        }
        return normalizado;
    }

    /**
     * Aplica a politica considerando o e-mail ja persistido.
     *
     * <p>Conta existente sincronizada/ediada SEM troca de e-mail mantem o valor
     * antigo intacto (preserva contas legadas e permite login delas). Qualquer
     * mudanca de e-mail — incluindo a primeira criacao — passa por
     * {@link #validar(String)}.
     *
     * @param emailRecebido e-mail vindo do cliente (pode ser nulo/vazio)
     * @param emailAtual e-mail persistido do registro, ou {@code null} em criacao
     * @return e-mail pronto para gravar
     */
    public static String aplicar(String emailRecebido, String emailAtual) {
        String recebido = normalizar(emailRecebido);
        if (emailAtual != null && recebido != null
                && recebido.equals(normalizar(emailAtual))) {
            // Nenhuma alteracao de e-mail: preserva o valor original.
            return emailAtual;
        }
        return validar(emailRecebido);
    }
}
