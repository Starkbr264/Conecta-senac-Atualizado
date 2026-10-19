/**
 * Imagens estaticas empacotadas pelo Metro.
 *
 * O caminho anterior (`../../frontend_reserva_salas/img/...`) apontava para
 * a pasta que existia ANTES da reorganizacao do monorepo. Essa pasta virou
 * `web/public/img/`, que fica FORA do projeto mobile - o Metro nao empacota
 * de forma confiavel um asset que esta fora da raiz do projeto.
 *
 * Por isso a imagem foi copiada para `mobile/assets/`, diretorio padrao do
 * Expo, e este require foi repontado.
 *
 * `mobile/assets/` NAO esta no `.gitignore` de proposito: e conteudo
 * versionado e precisa acompanhar o repositorio.
 */

export const Assets = {
  senacLogo: require('../../assets/senac-logo-sem-fundo.webp'),
};