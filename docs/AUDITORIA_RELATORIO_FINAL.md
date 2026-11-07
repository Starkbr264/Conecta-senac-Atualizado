# Relatório final — Auditoria de integração Conecta-SENAC

**Branch/worktree:** `fix-api-sinc-validacoes`  
**Ambiente verificado:** Vercel (`conecta-senac-test-yw11.vercel.app`) → Render (`conecta-senac-test.onrender.com`) → Supabase PostgreSQL  
**Restrições respeitadas:** sem commit, push, merge, deploy, alteração da branch principal, credenciais ou exclusão de dados reais.

## A. Testes PostgreSQL

- Embedded PostgreSQL 14.22 isolado, sem uso do banco de produção.
- Estrutura JPA, PK/FK, tipos, `UNIQUE`, transações e rollback: **passaram**.
- `id_sequences`, inicialização idempotente, compatibilidade com IDs existentes, locks e liberação após commit/rollback: **passaram**.
- Lotes válidos e inválidos no início, meio e fim: **rollback integral, sem gravações parciais**.
- Regras de usuários, unidades, salas, turmas, reservas, chaves, solicitações, notificações e autorização: **39 testes, 0 falhas**.
- Suíte completa do backend: **142 testes, 0 falhas**.

## B. Concorrência

- 8 threads × 5 alocações: **40 IDs únicos, nenhum duplicado ou perdido**.
- Duas instâncias Spring, com conexões/pools independentes no mesmo PostgreSQL: sincronizações simultâneas geraram IDs distintos (`1011` e `1012`), ambos persistidos.
- O runtime usa `IdAllocatorService`; não foi encontrado caminho concorrente ativo baseado em `MAX(id)+1`.

## C. Testes E2E

Foram exercitados login, carregamento, criação/edição de usuário, unidade, sala, turma, reserva, chave, solicitação, notificação, sincronização, reload, novo login e conferência no servidor.

O fluxo Vercel → Render → Supabase funcionou para operações válidas. Entretanto, a interface exibiu sucesso antes da confirmação da API em alguns fluxos. Turma, reserva, solicitação e notificação tiveram falhas reais de sincronização por dados legados incompatíveis, embora a UI mostrasse toast de sucesso.

## D. Infraestrutura

- A API publicada respondeu `401` sem token e, nos fluxos autenticados, `GET /api/dados` respondeu `200` com dados persistidos.
- CORS para o frontend de teste foi validado no navegador.
- `SPRING_DATASOURCE_URL`, usuário e senha são fornecidos por variáveis do Render; nenhuma credencial foi incluída neste relatório.
- O frontend publicado usa comunicação same-origin no container do Render e base configurável para o Vercel.
- `GET /api/dados` devolve `Cache-Control: no-cache, no-store, max-age=0, must-revalidate` na API observada.
- O projeto mantém `spring.jpa.hibernate.ddl-auto=update`: funciona para a integração, mas oferece risco de alteração automática do schema em produção. Recomenda-se migração controlada (Flyway/Liquibase), revisão de schema e execução separada de migrations.
- Não há configuração explícita de limites/timeout do Hikari no `application.properties`; recomenda-se definir e monitorar pool, timeout de conexão e health check separado que não exija autenticação.

## E. Problemas encontrados

### Alto

1. **Lote de sincronização é derrubado por um único dado legado incompatível.** O frontend envia a coleção inteira; uma entidade inválida causa rollback do lote inteiro. Isso impediu persistências válidas e expôs toasts incorretos.
2. **Toast de sucesso não aguarda confirmação da API.** Criação/edição de reserva e solicitação/notificação podem ser anunciadas como concluídas e depois desaparecer quando o cache é substituído pelo servidor.

### Médio

3. Senha trafega em texto claro no JSON HTTPS de `/api/sinc` durante cadastro; o backend só aplica BCrypt depois de receber.
4. Validações Bean (`@NotBlank` etc.) são convertidas em `409 Dados invalidos` sem campo, em vez de contrato consistente `400` detalhado.
5. `solicitacoes.criadaEm` ausente produz `409 Conflito de integridade de dados` genérico.
6. Sessões em abas não são independentes: `sessionStorage` guarda a identidade visual por aba, mas o JWT fica em `localStorage` compartilhado. Um login em outra aba troca o token usado pela primeira, deixando UI e identidade autenticada divergentes.

### Crítico — resolvido durante a auditoria

7. Geração de ID no cliente sobrescreveu temporariamente a chave real de outra unidade (`id=2`). O registro original foi restaurado com todos os campos e novo ID (`id=5`); a chave de teste permaneceu identificável (`id=6`). O incidente demonstra que a proteção contra colisão/upsert entre unidades ainda deve ser tratada como requisito de segurança.

## F. Limitações

- Não foi usada janela anônima; a simulação com abas normais revelou justamente que o `localStorage` compartilhado impede representar duas sessões autenticadas independentes na mesma origem.
- Portanto, a propagação criação/edição/exclusão entre dispositivos realmente isolados não pode ser considerada aprovada por este ensaio; o achado de sessão compartilhada foi confirmado.
- Não foi feita alteração corretiva no produto durante a auditoria, nem teste destrutivo no Supabase.
- A primeira chamada ao Render pode sofrer cold start/timeout; isso foi observado e não confundido com persistência aprovada.

## G. Parecer final — respostas 1 a 9

1. **Backend compatível com PostgreSQL real?** Sim, com os cenários testados.
2. **IDs concorrentes seguros?** Sim, para os caminhos que usam `IdAllocatorService` e `id_sequences`.
3. **Sincronização íntegra?** Não integralmente: há falha de lote por legado, toasts prematuros e risco de colisão/upsert em chaves.
4. **Frontend comunica com backend?** Sim, a comunicação publicada foi comprovada.
5. **Dados persistem no Supabase?** Sim para operações válidas confirmadas por API/banco; não se deve aprovar apenas pelo toast.
6. **Funciona em sessões/dispositivos diferentes?** Não aprovado: abas da mesma origem compartilham o JWT e podem divergir da identidade exibida.
7. **Pronto para integração na branch principal?** **Não**, enquanto os achados Alto e o risco de sessão/ID não forem tratados ou formalmente aceitos.
8. **Pronto para homologação?** **Condicional**, somente com dados de teste, monitoramento e os achados explicitamente aceitos.
9. **Pronto para produção?** **Não** no estado auditado.

## Evidências

Os detalhes dos testes, payloads sem credenciais, IDs de teste, respostas HTTP e causas estão em `AUDITORIA_EVIDENCIAS.md`. Nenhum token ou segredo é reproduzido neste relatório.
