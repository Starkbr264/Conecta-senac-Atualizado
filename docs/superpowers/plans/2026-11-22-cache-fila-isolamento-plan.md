# Isolamento de Cache e Fila Offline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Impedir compartilhamento de cache e execução cross-account de operações offline, preservando sincronização, idempotência e atualização entre abas.

**Architecture:** O JWT passará a carregar o identificador imutável do usuário, mantendo o e-mail como compatibilidade de autenticação. O web usará chaves privadas namespaced por identidade e uma fila global somente para itens identificados; itens legados serão movidos para quarentena sem envio automático. O backend persistirá o proprietário da operação e só devolverá replay ao mesmo usuário.

**Tech Stack:** TypeScript/Vitest/Vite; Spring Boot/JPA/JUnit; PostgreSQL/H2 via `ddl-auto=update` local, sem executar migration.

**Spec:** Solicitação do usuário de 22/11/2026 — correção de isolamento de cache, sessão e fila offline.

## Global Constraints

- Trabalhar somente na branch `feat/evoluir-solicitacoes`.
- Preservar alterações locais e `docs/superpowers/plans/2026-11-20-solicitacoes-lifecycle-plan.md`.
- Não fazer commit, push, merge, deploy, migration executada ou escrita em ambiente compartilhado.
- Não atribuir dados legados ao primeiro usuário; não apagar fila legada silenciosamente.
- Não remover `requestRefresh`, lock de sincronização, stale reads, polling ou BroadcastChannel.
- Operações pendentes só podem ser enviadas quando a identidade atual corresponder ao proprietário.

## Review Focus

- Troca para usuário da mesma unidade: cache e fila continuam separados por `userId`.
- Fila legada/corrompida: é preservada em quarentena e nunca enviada automaticamente.
- Resposta atrasada após troca de sessão: não altera `CACHE` nem localStorage da nova identidade.
- Reuso de `operacaoId` por outro usuário: não revela resposta nem executa replay.
- Erros 4xx definitivos: deixam registro recuperável, sem perda silenciosa.

---

### Task 1: Identidade JWT e contrato de sessão

**Files:**
- Modify: `backend/demo/src/main/java/conecta/demo/security/JwtService.java`
- Modify: `backend/demo/src/main/java/conecta/demo/security/JwtAuthenticationFilter.java`
- Modify: `backend/demo/src/main/java/conecta/demo/service/UsuarioAtual.java`
- Modify: `backend/demo/src/main/java/conecta/demo/service/AuthService.java`
- Modify: `web/src/types/index.ts`
- Test: testes backend de JWT/usuário atual

**Interfaces:**
- JWT terá claim `uid` com `Usuario.id`; subject/e-mail continuará presente para tokens antigos.
- `UsuarioAtual.buscar()` resolverá a identidade autenticada e será a fonte de `userId`.

- [ ] Escrever testes de claim `uid`, resolução por id e rejeição de identidade ausente.
- [ ] Executar testes e confirmar falha antes da implementação.
- [ ] Implementar claims/filtro compatíveis com tokens antigos sem usar dados enviados pelo cliente como autoridade.
- [ ] Executar testes backend focados.

### Task 2: Cache privado por identidade e troca de sessão

**Files:**
- Modify: `web/src/core/storage.ts`
- Modify: `web/src/core/theme.ts`
- Modify: `web/src/core/auth.ts`
- Modify: `web/src/features/login/login.ts`
- Modify: `web/src/core/data-sync.ts`
- Test: `web/src/core/storage.identity.test.ts` e testes cross-tab

**Interfaces:**
- Chaves privadas terão namespace derivado de `userId`, `unidadeId` e `perfil`.
- `CACHE` terá contexto de identidade e será invalidado antes de carregar novo usuário.
- Cache global legado nunca será carregado como domínio privado; apenas `unidades` públicas poderá permanecer disponível no login.
- `data-sync` carregará/sincronizará apenas se a identidade atual permanecer igual ao início da operação.

- [ ] Escrever testes A→logout→B, mesma unidade, falha de sync e resposta atrasada.
- [ ] Executar testes e confirmar falha.
- [ ] Implementar namespace, limpeza em memória, bloqueio durante primeira sincronização e guarda de identidade nas respostas.
- [ ] Preservar atualização entre abas da mesma identidade.
- [ ] Executar testes Vitest e typecheck.

### Task 3: Fila offline, quarentena e erros recuperáveis

**Files:**
- Modify: `web/src/core/storage.ts`
- Modify: `web/src/core/auth.ts`
- Modify: `web/src/core/theme.ts`
- Create/modify: testes de isolamento da fila

**Interfaces:**
- `SyncPendente`: `operacaoId`, `userId`, `unidadeId?`, `criadaEm`, `payload`, `estado?`, `erro?`.
- Fila identificada permanece global para permitir A voltar; `flushPendentes()` seleciona apenas itens do usuário atual.
- Itens sem identidade verificável são copiados para `sn_v6_sync_quarentena` com motivo e nunca enviados.
- 400/401/403/404/409/422 registram rejeição recuperável; somente operação explicitamente resolvida pode ser removida.

- [ ] Escrever testes de não envio por B, processamento por A, legado em quarentena, rejeição preservada e troca durante request.
- [ ] Executar testes e confirmar falha.
- [ ] Implementar metadados na criação, seleção por identidade e estados de erro sem apagar item.
- [ ] Executar testes focados e revisar payload enviado.

### Task 4: Proprietário e idempotência no backend

**Files:**
- Modify: `backend/demo/src/main/java/conecta/demo/model/SincOperacao.java`
- Modify: `backend/demo/src/main/java/conecta/demo/repository/SincOperacaoRepository.java`
- Modify: `backend/demo/src/main/java/conecta/demo/service/SincService.java`
- Modify: `backend/demo/src/main/java/conecta/demo/controller/SincController.java`
- Create: migration somente se o projeto exigir schema explícito; não executar
- Test: testes de serviço/controller de sincronização

**Interfaces:**
- `SincOperacao` persistirá `usuarioId` e terá consulta por `(id, usuarioId)`.
- `/api/sinc` exigirá proprietário para operações identificadas; o proprietário será comparado ao `UsuarioAtual`, nunca confiado como autorização.
- Replay do mesmo id pelo mesmo usuário devolve a resposta; id reutilizado por outro usuário retorna 403/409 sem revelar resposta.
- Validações atuais de perfil, unidade e registro permanecem.

- [ ] Escrever testes de proprietário correto, outro usuário, replay e permissões/unidade.
- [ ] Executar testes e confirmar falha.
- [ ] Implementar entidade/repositório/serviço e manter contrato de resposta.
- [ ] Executar testes backend.

### Task 5: Compatibilidade mobile e verificação final

**Files:**
- Modify: `mobile/src/services/api.ts` e storage somente se necessário para gerar `operacaoId`/proprietário.
- Modify: tipos compartilhados apenas se necessário.
- Test: mobile/web/backend existentes.

- [ ] Inspecionar contrato mobile e adicionar somente os metadados necessários, sem mudar endpoints.
- [ ] Executar Vitest, typecheck, build web, testes backend e `git diff --check`.
- [ ] Verificar `git status`, branch, HEAD, ausência de commit/push/deploy/migration e documentar limitações.
