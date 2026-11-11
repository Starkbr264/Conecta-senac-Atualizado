# OPERAÇÃO DE LIMPEZA TÉCNICA E MODERNIZAÇÃO — CONECTA-SENAC

## OBJETIVO

Realizar uma limpeza técnica completa no Conecta-Senac, removendo código morto, imports desnecessários, dependências redundantes, configurações obsoletas e documentação desatualizada.

Também corrigir os problemas de segurança identificados na auditoria do repositório.

O objetivo não é reconstruir o sistema nem modificar sua arquitetura.

Quero uma limpeza cirúrgica, preservando todas as funcionalidades existentes, a integração Web/Mobile, a sincronização incremental, a autenticação, as regras de negócio e o funcionamento em produção.

## 1. CONTEXTO DO PROJETO

Repositório analisado:
`Conecta-senac-Atualizado-TRABALHO`

Arquitetura:
- Frontend Web: Vite + TypeScript.
- Aplicativo Mobile: Expo + React Native + TypeScript.
- Backend: Java + Spring Boot.
- Banco de dados: PostgreSQL/Supabase.
- Deploy: Vercel + Render.
- Autenticação: JWT.
- Sincronização: `/api/sinc`, com operações incrementais, IDs provisórios e idempotência.

Branch principal conhecida:
`main-Versão-4.0`

Último merge conhecido:
`19861bd9df75b0f233238d06a2f07cd56f4f195d`

A implementação da validação institucional de e-mail também deve ser preservada:

`@edu.df.senac.br`

Regra:
- Máximo de 16 caracteres antes do domínio.
- Novas criações e alterações devem obedecer ao domínio institucional.
- Contas antigas não devem perder acesso automaticamente.

## 2. REGRAS OBRIGATÓRIAS DE PRESERVAÇÃO

Antes de qualquer alteração:

1. Execute `git status`.
2. Execute `git diff`.
3. Execute `git diff --cached`.
4. Execute `git branch --show-current`.
5. Execute `git worktree list`.
6. Confira o remoto e o último commit.
7. Identifique alterações não commitadas.

IMPORTANTE: a auditoria anterior informou que houve uma edição durante uma análise considerada somente leitura, relacionada à validação antiga de e-mail em `api.ts`.

Verifique essa alteração cuidadosamente.

Não descarte, sobrescreva ou reverta alterações preexistentes.

### Isolamento

Crie uma branch exclusiva:

`chore/limpeza-codigo-morto`

Utilize a versão atualizada de `main-Versão-4.0` como base, desde que a inspeção do histórico confirme que não existem alterações pendentes que precisam ser preservadas.

Caso exista trabalho não commitado na pasta atual, preserve-o antes de criar o ambiente isolado.

### Restrições

- Não modificar diretamente a branch principal.
- Não fazer merge.
- Não fazer commit.
- Não fazer push.
- Não realizar deploy.
- Não alterar dados do Supabase.
- Não modificar credenciais de produção.
- Não remover funcionalidades existentes.
- Não realizar refatorações arquiteturais amplas.
- Não excluir arquivos de auditoria ou backups sem autorização.

Execute as alterações localmente e apresente o resultado para revisão.

---

# PARTE I — SEGURANÇA DO REPOSITÓRIO

## 3. CORRIGIR O `.env` VERSIONADO — PRIORIDADE MÁXIMA

A auditoria encontrou um arquivo `.env` versionado no Git, contendo valores preenchidos para variáveis como:

- `SUPABASE_DB_PASSWORD`
- `POSTGRES_PASSWORD`

Esse é o problema mais importante da auditoria.

Uma senha real armazenada no histórico do Git deve ser considerada potencialmente comprometida, mesmo que o repositório não seja público.

### 3.1. Inspecionar sem revelar credenciais

Verifique:
- Se os valores são reais ou placeholders.
- Quais serviços utilizam cada variável.
- Se as credenciais continuam ativas.
- Se existem valores repetidos entre ambientes.
- Se o histórico Git contém versões anteriores dessas credenciais.

Não imprima os valores no terminal.

Não coloque senhas em relatórios, logs, mensagens de erro ou arquivos temporários.

Apresente apenas:
- Nome da variável.
- Existência ou ausência de valor.
- Classificação: placeholder, aparentemente real ou não confirmado.
- Serviço consumidor.

### 3.2. Remover o `.env` do versionamento

Corrija o `.gitignore`.

Garanta que:
- `.env` não seja mais rastreado.
- Arquivos `.env.local` e equivalentes também sejam ignorados.
- `.env.example` continue versionado.
- Outros arquivos de exemplo permaneçam disponíveis.

Retire `.env` do índice Git sem apagar a cópia local:

`git rm --cached .env`

Verifique o comportamento dos padrões de `.gitignore` e das exceções existentes.

IMPORTANTE: preserve o arquivo `.env` local para não interromper o desenvolvimento.

### 3.3. Revisar `.env.example`

Mantenha somente nomes de variáveis e valores fictícios.

Exemplo:

`SUPABASE_DB_PASSWORD=CHANGE_ME`

Nunca copie credenciais reais do `.env` para o `.env.example`.

Mantenha os nomes necessários para o desenvolvimento local, Docker e backend.

### 3.4. Histórico Git e rotação

Remover o `.env` do próximo commit não elimina suas versões anteriores do histórico.

Portanto:

- Identifique quais credenciais reais foram armazenadas no histórico.
- Documente quais precisam ser rotacionadas.
- Prepare um plano de atualização no Supabase e Render.
- Verifique a ordem de atualização para não interromper a conexão.
- Considere as referências existentes nos diferentes ambientes.

NÃO rotacione credenciais automaticamente nesta etapa.

A rotação precisa de autorização explícita, pois pode interromper a conexão com o banco e exigir atualização de serviços.

Também não reescreva o histórico Git nem execute force push.

Apresente um procedimento seguro para tratamento posterior do histórico, considerando que a rotação de credenciais é a medida essencial mesmo quando o histórico permanece acessível.

---

# PARTE II — LIMPEZA DE CÓDIGO MORTO

## 4. REMOVER O ANTIGO SISTEMA DE MODO MOCK

Arquivo:

`web/src/core/api.ts`

Candidatos encontrados:
- `MODO_API`
- `EH_MODO_MOCK`
- `URL_MOCK_PADRAO`
- `URL_PRODUCAO_PADRAO`
- `lerSessaoRemota()`
- `logoutRemoto()`
- `resetarDados()`
- Bloco antigo de resolução de modo, aproximadamente linhas 87–170.

### Mobile

Arquivo:

`mobile/src/services/api.ts`

Candidatos:
- `MODO_API`
- `EH_MODO_MOCK`
- `resolverModo()`
- `ehHostPrivado()`
- `lerSessaoRemota()`
- `logoutRemoto()`
- Blocos antigos de seleção de modo.

### Procedimento

Antes de remover:

1. Busque todas as referências no projeto.
2. Confira importações indiretas.
3. Verifique testes.
4. Verifique configurações de execução.
5. Confirme se nenhuma funcionalidade depende desse comportamento.

Depois:

- Remova código comprovadamente morto.
- Remova `VITE_MODO_API` se realmente não possuir consumidor.
- Remova `EXPO_PUBLIC_MODO_API` se realmente não possuir consumidor.
- Atualize `.env.example`.
- Atualize a documentação.
- Preserve `VITE_API_BASE`, `VITE_API_TIMEOUT_MS` e demais configurações efetivamente utilizadas.

IMPORTANTE:

Não remova `server/index.js`, `server/seed.js` ou os recursos de desenvolvimento offline sem uma auditoria independente.

O mock legado possui função documentada no ambiente de desenvolvimento Docker.

Preserve também o profile `mock` do `compose.yaml`, salvo se houver prova de que não é mais necessário.

## 5. REVISAR EXPORTS MORTOS DO WEB

Arquivo principal:

`web/src/core/storage.ts`

Investigue os seguintes candidatos:

- `sortById`
- `sincronizarPendencias`
- `getUsuariosByPerfil`
- `getNotifs`
- `addUsuario`
- `updUsuario`
- `delUsuario`
- `updateSala`
- `deleteSala`
- `updateTurma`
- `deleteTurma`
- `deleteReserva`
- `deleteChave`
- `resetCache`
- `SessaoUsuario`

Também revise exports identificados em:

### actions.ts
- `obterAcao`
- `totalDeAcoes`
- `nomesDasAcoes`
- `limparRegistro`

### dom.ts
- `setValue`
- `setHtml`
- `textOf`
- `htmlOf`
- `tryQs`
- `onQs`
- `onReady`
- `opcao`
- `opcaoVazia`
- `isHtml`
- `toggleClass`
- `addClass`
- `setDisplay`
- `asAnchor`
- `intValueOf`
- `intOrNull`

### Outros arquivos
- `filters.ts`: `aplicarFiltros`
- `format.ts`: `newId`
- `ui.ts`: `hideMsg`
- `calendario.ts`: `calMesAnterior`, `calProximoMes`, `calSetVista`
- `types/index.ts`: tipos candidatos não utilizados.

### Requisitos

Não remova uma função simplesmente porque sua ocorrência aparece uma única vez.

Verifique:
- Imports estáticos.
- Imports dinâmicos.
- Uso por strings e registros de callbacks.
- Utilização por testes.
- Compatibilidade com componentes.
- Uso potencial em páginas HTML.
- Exportações utilizadas em outros pacotes.

Priorize os métodos substituídos por versões assíncronas.

Preserve as versões `Async` e o sistema atual de confirmação da API.

Não remova operações de CRUD que ainda sejam utilizadas pelo frontend.

## 6. REVISAR EXPORTS MORTOS DO MOBILE

Arquivo:

`mobile/src/services/storage.ts`

Candidato:
- `getReservaById`
- `getNotifs`

Arquivo:

`mobile/src/components/ui.tsx`

Candidato:
- `SectionHeader`

Revise também os tipos de `mobile/src/types/index.ts`.

A limpeza não pode afetar:
- Navegação.
- Formulários.
- Sincronização.
- Cache offline.
- Sessões.
- Telas administrativas.
- Reservas.
- Solicitações.
- Notificações.

Não remova elementos que sejam dependências indiretas do Expo Router.

## 7. REMOVER IMPORTS NÃO UTILIZADOS

Verifique:

- `web/src/features/coordenador/coordenador.ts`: `mesmaUnidade`.
- `web/src/features/recepcao/recepcao.ts`: `mesmaUnidade`.
- `web/src/core/storage.ts`: `_NovaSolicitacao`.
- `mobile/src/app/admin/index.tsx`: `DiaSemana`.
- `mobile/src/components/SalaCard.tsx`: `StatusSala`, `Periodo`.

Confirme novamente os imports atuais antes de removê-los.

Execute typecheck após cada grupo de alterações.

---

# PARTE III — ENDPOINTS E BACKEND

## 8. AUDITAR OS ENDPOINTS SEM CHAMADAS DOS CLIENTES

A auditoria identificou 37 dos 43 endpoints sem chamadas diretas pelo Web ou Mobile.

Isso NÃO significa que esses endpoints sejam automaticamente código morto.

Revise:

- `ChaveController`
- `NotificacaoController`
- `ReservaController`
- `SalaController`
- `SolicitacaoController`
- `TurmaController`
- `UsuarioController`
- `UnidadeController`
- `SincController`

Classifique cada endpoint:

1. Utilizado diretamente.
2. Utilizado indiretamente.
3. Necessário para testes.
4. Necessário para compatibilidade.
5. Contrato REST legítimo, mesmo sem consumidor atual.
6. Comprovadamente obsoleto.

Não exclua todos os controllers apenas porque os clientes concentram suas operações em `/api/sinc`.

Verifique a documentação, os testes, os consumidores externos e as permissões.

Somente remova endpoints comprovadamente obsoletos e sem consumidores.

Se forem mantidos por compatibilidade, documente a razão.

## 9. CORRIGIR O LOGOUT REMOTO

Foi identificado:

`POST /api/logout`

O endpoint existe, mas não é chamado pelos clientes.

Verifique:
- `web/src/core/auth.ts`
- `web/src/core/api.ts`
- `mobile/src/services/api.ts`
- `SincController.java`
- Implementação do JWT no backend.

Determine se o endpoint realmente revoga tokens ou apenas retorna uma resposta de sucesso.

Se existir revogação efetiva:
- Integre a chamada ao fluxo de logout Web e Mobile.
- Preserve o logout local mesmo quando a rede estiver indisponível.
- Não impeça o usuário de sair da conta por causa de falhas de conexão.

Se o JWT não possuir mecanismo real de revogação:
- Não declare que o logout remoto está funcionando.
- Avalie a necessidade de implementar uma estratégia compatível com a arquitetura atual.
- Considere expiração dos tokens e riscos de reutilização.
- Evite adicionar Redis, infraestrutura externa ou complexidade desnecessária.

Não implemente uma lista de revogação sem avaliar o impacto em múltiplas instâncias do Render.

Verifique também `POST /api/sessao`, que aparenta não possuir consumidor atual.

Não remova funcionalidades administrativas existentes.

---

# PARTE IV — HEALTH CHECK E INFRAESTRUTURA

## 10. CORRIGIR O HEALTH CHECK DO RENDER

Arquivo:

`render.yaml`

Atualmente:

`healthCheckPath: /api/dados`

Entretanto, `/api/**` exige autenticação.

Investigue se o Render está recebendo HTTP 401 durante os health checks.

Se confirmado, implemente um endpoint público dedicado:

`GET /health`

Requisitos:

- Deve utilizar `permitAll`.
- Deve retornar HTTP 200 quando a aplicação estiver operacional.
- Não deve exigir JWT.
- Não deve revelar credenciais, informações internas ou dados de usuários.
- Não deve depender de autorização administrativa.
- Deve possuir resposta pequena e previsível.

Avalie separadamente liveness e readiness.

Se utilizar uma verificação de banco, não exponha detalhes da conexão na resposta.

Atualize:

`render.yaml`

Para utilizar:

`healthCheckPath: /health`

Verifique se não existe conflito com rotas do frontend ou configurações do Spring Security.

Crie testes para:
- `/health` sem token.
- `/api/dados` sem token.
- `/api/dados` com token.

Resultado esperado:
- `/health`: 200.
- `/api/dados` sem token: 401.
- `/api/dados` autorizado: comportamento normal.

Não faça deploy para testar essa alteração.

---

# PARTE V — DEPENDÊNCIAS E BUILDS

## 11. REMOVER LOMBOK DO GRADLE

Arquivo:

`backend/demo/build.gradle`

A auditoria não encontrou:
- `import lombok`.
- `@Getter`.
- `@Setter`.
- `@Builder`.
- `@Data`.

Verifique novamente o projeto inteiro.

Caso realmente não exista utilização:
- Remova as dependências Lombok.
- Remova o annotation processor correspondente.
- Remova configurações redundantes.
- Preserve todas as demais dependências.

Execute o build e a suíte completa do backend.

## 12. VERIFICAR SPRING SECURITY CRYPTO

A auditoria identificou possível redundância de:

`spring-security-crypto`

com:

`spring-boot-starter-security`

Antes de remover:
- Execute `dependencyInsight`.
- Verifique se o starter já fornece a biblioteca.
- Confirme que BCrypt continua disponível.
- Confirme que a autenticação não muda.
- Execute testes de criação e autenticação de usuários.

Remova a dependência direta somente se for realmente redundante.

Não altere a implementação de BCrypt.

## 13. DEPENDÊNCIAS MOBILE

Investigue:
- `react-native-gesture-handler`
- `@expo/metro-runtime`
- `expo-font`
- `expo-linking`
- `react-native-safe-area-context`
- `react-native-screens`

A auditoria identificou:
- `react-native-gesture-handler` sem imports encontrados.
- Possíveis redundâncias de `@expo/metro-runtime` e `expo-font`.
- Dependências que podem ser necessárias indiretamente pelo Expo Router.

Não remova pacotes apenas pela ausência de imports diretos.

Verifique:
- `npm ls`.
- Dependências transitivas.
- Configuração do Expo.
- Compatibilidade com a versão atual do SDK.
- Dependências nativas exigidas pelo React Native.

Se remover dependências:
- Atualize `package.json`.
- Atualize `package-lock.json`.
- Execute `npm ci`.
- Execute o typecheck.
- Execute o build ou verificação Expo disponível.

Não atualize versões de pacotes sem necessidade.

## 14. AJUSTAR SCRIPTS

Web:
- Verifique `build:somente-bundle`.
- Confirme se existe utilização em scripts externos ou documentação.

Mobile:
- Verifique se `lint` apenas repete `typecheck`.
- Verifique se o pacote TypeScript está corretamente declarado.
- Confira `package-lock.json`.

Se TypeScript estiver declarado, mas ausente do `node_modules`, execute `npm ci` antes de considerar o pacote desnecessário.

Não confunda ausência de dependência instalada localmente com dependência inexistente no projeto.

Caso não exista ESLint configurado, não invente uma nova infraestrutura de lint nesta limpeza. Corrija o nome dos scripts somente se isso não quebrar CI e documentação.

---

# PARTE VI — LIMPEZA CSS E HTML

## 15. REVISAR CSS MORTO

Arquivos e seletores candidatos:

`web/public/css/map.css`
- `.sala-map`
- `.mapa-loading`
- `.mapa-spinner`
- `.sc-turno-ativo`

`web/public/css/notifications.css`
- `.notifs-toolbar`

Verifique usos:
- Em HTML.
- Em TypeScript.
- Em classes dinâmicas.
- Em componentes.
- Em templates.
- Em estados de interação.

Remova somente seletores comprovadamente sem utilização.

## 16. CORRIGIR TOAST CONTAINER ANTIGO

Arquivo:

`web/dashboard.html`

Foi identificado:

`<div id="toast-container">`

A implementação atual utiliza `#toasts`.

Verifique se o elemento antigo possui consumidores.

Caso seja realmente redundante:
- Remova o container antigo.
- Preserve a implementação atual de `#toasts`.
- Verifique se nenhuma página depende da estrutura antiga.

## 17. PRESERVAR PÁGINAS E CSS NECESSÁRIOS

A auditoria confirmou:
- 7 páginas utilizadas pelo Vite.
- 20 arquivos CSS referenciados.
- 73 handlers registrados e alcançáveis.

Não remova páginas HTML ou arquivos CSS completos sem comprovação independente.

Não altere os handlers e atributos `data-action`, `data-change` e `data-input` sem testar os respectivos eventos.

---

# PARTE VII — DOCUMENTAÇÃO

## 18. CORRIGIR DOCUMENTAÇÃO DESATUALIZADA

Revise:

### `docs/ARQUITETURA_ATUALIZADA.md`
- Corrigir o link para `DOCUMENTACAO_CONEXAO_WEB_MOBILE.md`.
- Substituir a extensão `.txt` antiga quando necessário.
- Corrigir a descrição de `server/` como fonte da verdade.
- Explicar que o mock é legado e utilizado no profile específico de desenvolvimento.

### `docs/RELATORIO_FINAL.md`
- Atualizar referências antigas ao Node 20 para a versão efetivamente utilizada pelo CI.
- Conferir a configuração real em `.github/workflows/ci.yml`.

### `docs/DEPLOY.md`
- Verificar o endereço do backend.
- Conferir o fallback de `web/src/core/api.ts`.
- Resolver divergências entre:
  - `https://conecta-senac.onrender.com`
  - `https://conectasenac-api.onrender.com`

Não escolha um endereço por suposição.

Utilize a configuração efetiva do deployment.

### Demais documentos

Revisar:
- README.
- Instruções locais.
- Documentação Docker.
- Documentação Web/Mobile.
- Variáveis de ambiente.
- Procedimentos de build e deploy.
- Relatórios de auditoria.

Verifique se os comandos documentados realmente existem.

Não exclua:
- `AUDITORIA_KICKOFF_ORIGINAL.txt`.
- `AUDITORIA_EVIDENCIAS.md`.
- Relatórios históricos relevantes.
- Planos de desenvolvimento que expliquem decisões arquiteturais.

Documentos antigos podem permanecer como histórico, desde que não sejam apresentados como instruções atuais.

---

# PARTE VIII — DUPLICAÇÃO WEB E MOBILE

## 19. NÃO EXECUTAR UMA REFATORAÇÃO AMPLA

A auditoria identificou duplicação em:
- Cache e sincronização.
- Cliente HTTP.
- Tipos.
- Seeds.
- Regex de validação de e-mail.
- Cálculo de status das salas.

Não quero reestruturar todo o monorepo.

Faça apenas uma avaliação de consistência.

### E-mail institucional

Preserve a validação centralizada no backend:

`EmailInstitucional.java`

Ela já é utilizada por `UsuarioService` e `SincService`.

No frontend Web e Mobile, confira se as validações locais estão alinhadas com a regra:

`@edu.df.senac.br`

Limite:
- 16 caracteres antes do domínio.

Não remova a validação backend.

Não permita que Web e Mobile adotem regras incompatíveis.

### Demais duplicações

Documente oportunidades de compartilhamento futuro.

Não mova arquivos para novos pacotes, não altere a arquitetura de módulos e não introduza bibliotecas de monorepo apenas para eliminar duplicação nesta tarefa.

---

# PARTE IX — TESTES E REGRESSÃO

## 20. TESTES OBRIGATÓRIOS

Após as alterações, execute:

### Backend

`./gradlew.bat test`

Verifique:
- Todos os testes anteriores.
- Autenticação.
- BCrypt.
- JWT.
- Logout.
- Sincronização incremental.
- IDs e idempotência.
- Autorização por unidade.
- Health check.

### Web

No diretório `web/`:

`npm ci`

`npm run typecheck`

`npm run build`

### Mobile

No diretório `mobile/`:

`npm ci`

Execute os scripts reais definidos no `package.json`.

Verifique:
- TypeScript.
- Expo.
- Dependências.
- Navegação.
- Compatibilidade dos componentes.

### Geral

`git diff --check`

Verifique também se:
- Os 73 handlers continuam alcançáveis.
- As 7 páginas continuam compilando.
- Nenhum CSS utilizado foi removido.
- Nenhum contrato REST necessário foi quebrado.
- A sincronização Web/Mobile continua compatível.

Não considere uma etapa aprovada apenas porque o build terminou.

---

# PARTE X — CRITÉRIOS DE SEGURANÇA

## 21. REGRAS QUE NÃO PODEM SER VIOLADAS

Durante toda a limpeza, preserve:
- Autenticação JWT.
- Controle de acesso por unidade.
- Perfis ADMIN, COORDENADOR, INSTRUTOR e RECEPCAO.
- BCrypt.
- Validação institucional de e-mail.
- IDs gerados pelo backend.
- `IdAllocatorService`.
- Tabela `id_sequences`.
- Idempotência por `operacaoId`.
- Sincronização incremental.
- Fila offline.
- Remapeamento de IDs provisórios.
- Confirmação das operações antes dos toasts de sucesso.
- Sessões compartilhadas entre abas.
- Tratamento de erros HTTP.
- Compatibilidade PostgreSQL.

Não enfraqueça validações de segurança para facilitar testes.

Não remova dados ou regras de negócio.

---

# PARTE XI — RELATÓRIO FINAL

## 22. ENTREGÁVEIS

Ao concluir, apresente um relatório dividido em:

### A. Segurança
### B. Código morto removido
### C. Backend
### D. Frontend Web
### E. Mobile
### F. Documentação
### G. Testes
### H. Riscos restantes
### I. Parecer final (10 perguntas)

## RESTRIÇÕES FINAIS

- Não fazer commit.
- Não fazer push.
- Não fazer merge.
- Não realizar deploy.
- Não rotacionar credenciais sem autorização explícita.
- Não alterar dados do Supabase.
- Não mexer na branch principal.
- Não reescrever o histórico Git.
- Não excluir backups.
- Não apagar o mock legado documentado.
- Não remover endpoints sem comprovação de obsolescência.
- Não alterar funcionalidades apenas por preferência de estilo.

**CRITÉRIO DE CONCLUSÃO:** projeto mais limpo, seguro, organizado e fácil de manter, sem regressões e sem perda de funcionalidades. Priorizar segurança do `.env`, remoção de código comprovadamente morto e correção das configurações. Preservar integralmente tudo que já foi homologado no Conecta-Senac.

## Review Focus (input classes and failure modes the tests do not exercise)

- Removals that look dead but are reached dynamically (data-action/callback registries, HTML class strings, dynamic imports).
- Security regressions: JWT auth, unit-based authorization, BCrypt, institutional email rule, idempotent sync, ID allocation.
- `.env` still tracked anywhere; secrets leaked into reports/logs.
- Health check endpoint accidentally requiring auth, or exposing internals.
- Dependency removals that break Expo Router or Gradle builds only at runtime/packaging time.
- Doc edits that change meaning (host addresses, versions) without evidence.
