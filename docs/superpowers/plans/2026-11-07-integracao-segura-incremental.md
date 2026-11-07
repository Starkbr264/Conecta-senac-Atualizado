# Correção de Integração Segura e Incremental — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** impedir sobrescritas por IDs do cliente, tornar a sincronização incremental/idempotente, confirmar operações antes de informar sucesso, alinhar sessões entre abas e corrigir os contratos de validação.

**Architecture:** O backend será a autoridade para IDs: `criados` sempre recebe ID do `IdAllocatorService`, enquanto `alteracoes` só atualiza registros existentes carregados do banco e autorizados pela unidade real. O frontend passará a registrar deltas em uma fila persistente com `operacaoId`, reenviando apenas operações pendentes; o servidor memorizará operações concluídas para reenvio idempotente. A sessão será compartilhada coerentemente entre abas via `localStorage`, com invalidação/reload quando a identidade mudar.

**Tech Stack:** Spring Boot, JPA, PostgreSQL, JUnit/MockMvc, TypeScript, Vite, `localStorage`/eventos de armazenamento.

**Spec:** solicitação do usuário em 2026-11-07 e `AUDITORIA_RELATORIO_FINAL.md` / `AUDITORIA_EVIDENCIAS.md`.

## Global Constraints

- Trabalhar exclusivamente em `fix/api-sinc-validacoes`.
- Não fazer commit, push, merge ou deploy.
- Não alterar credenciais, `main-Versão-4.0` ou dados reais publicados.
- Não enfraquecer validações para aceitar legado inválido.
- Preservar `IdAllocatorService`, `id_sequences`, compatibilidade do `/api/sinc` sem `operacaoId` e funcionamento offline não relacionado a senhas.
- Toda produção deve ter teste de reprodução que falhe antes da implementação.

## Review Focus

- Reenvio após resposta perdida: o mesmo `operacaoId` não pode criar duas entidades.
- Atualização com ID inexistente ou de outra unidade: deve rejeitar sem criar/alterar.
- Referência provisória entre operações/coleções: deve ser remapeada antes da persistência.
- Fila local com falha parcial/reload: operação não confirmada deve permanecer e não apagar o cache local.
- Troca de sessão em outra aba: a página antiga não pode continuar autorizada visualmente.

---

### Task 1: Contrato seguro de IDs e operações idempotentes no backend

**Files:**
- Create: `backend/demo/src/main/java/conecta/demo/model/SincOperacao.java`
- Create: `backend/demo/src/main/java/conecta/demo/repository/SincOperacaoRepository.java`
- Modify: `backend/demo/src/main/java/conecta/demo/service/SincService.java`
- Modify: `backend/demo/src/main/java/conecta/demo/exception/ApiExceptionHandler.java`
- Test: `backend/demo/src/test/java/conecta/demo/SincIntegrationHardeningTest.java`

**Interfaces:**
- Produces optional request field `operacaoId` and idempotent response reuse in `/api/sinc`.
- `criados` ignores client primary keys except as provisional mapping keys; `alteracoes` requires an existing persisted ID.

- [ ] Write tests for provisional key collision across units, same-unit update, cross-unit update, missing update ID, and retrying one `operacaoId`.
- [ ] Run the focused test and observe failures caused by current JPA upsert/duplicate behavior.
- [ ] Add `SincOperacao` with unique operation ID and serialized response, persisting it in the same transaction as the batch.
- [ ] Refactor `SincService` so creation allocates official IDs for every collection and updates load/merge existing entities before validation/save.
- [ ] Check authorization against the persisted record's real unit before updates/removals; reject missing update IDs with 404.
- [ ] Return the official ID mapping and reuse the stored response on an idempotent retry.
- [ ] Run focused tests, then all backend tests.

### Task 2: Incremental durable frontend synchronization

**Files:**
- Modify: `web/src/core/storage.ts`
- Modify: `web/src/types/index.ts`
- Modify: `web/src/core/api.ts` only if request/result typing requires it
- Test: `web/src/core/storage.test.ts` or the repository's existing frontend test location

**Interfaces:**
- New persistent queue key stores `{operacaoId, payload, status}` without full collections.
- `pushColecao` sends one delta (`criados`, one-item `alteracoes`, or `remocoes`) plus `operacaoId`.
- Official ID mappings update all local references and queued payloads.

- [ ] Add tests for new/edit/delete deltas, legacy invalid records not included, offline retention, reload recovery, ID remapping, and idempotent retry.
- [ ] Run them red against the current full-collection `pushColecao`.
- [ ] Replace `nextId` for new synced entities with negative provisional IDs and create explicit queue records.
- [ ] Implement serialized queue load/save/flush, operation IDs, per-operation success removal, failure retention, and duplicate-safe retry.
- [ ] Apply server `idsNovos` mappings to cache, references, and pending operations without replacing unrelated local state on failure.
- [ ] Remove passwords from cached user entities and avoid creating a durable offline user operation that stores a plaintext password; report that this specific operation requires connectivity.
- [ ] Run frontend tests/typecheck/build.

### Task 3: Awaited confirmation and honest UI states

**Files:**
- Modify: `web/src/core/storage.ts`
- Modify: `web/src/features/coordenador/coordenador.ts`
- Modify: `web/src/features/instrutor/instrutor.ts`
- Modify: `web/src/features/admin/admin.ts`
- Modify: `web/src/features/recepcao/recepcao.ts`
- Modify: related dashboard CRUD modules found during trace
- Test: frontend synchronization/UI tests

- [ ] Add tests proving a rejected API does not produce a success notification and a network failure produces an explicit pending/offline message while retaining the queue.
- [ ] Run them red against fire-and-forget mutation methods.
- [ ] Add awaited mutation variants returning confirmation/pending status; keep legacy sync signatures only as compatibility wrappers.
- [ ] Update reservation, request, notification, key, user, unit, room, class, assignment, and deletion flows to await confirmation before success toasts.
- [ ] Distinguish “persistido no servidor” from “pendente de sincronização”; never reload the server over an unconfirmed local operation.
- [ ] Run frontend tests and build.

### Task 4: Consistent shared-tab authentication

**Files:**
- Modify: `web/src/core/theme.ts`
- Modify: `web/src/core/auth.ts`
- Modify: `web/src/core/api.ts`
- Modify: `web/src/features/login/login.ts`
- Test: frontend auth/session tests

- [ ] Add tests for two profiles, storage-event identity changes, logout, token clearing, and route/permission invalidation.
- [ ] Run them red against sessionStorage identity plus global token.
- [ ] Store the active session in the same shared scope as the JWT and register a single storage/custom-event listener that reloads or redirects stale pages.
- [ ] Ensure 401 clears both token and session; require-profile checks current shared identity before rendering privileged pages.
- [ ] Run frontend tests/typecheck/build.

### Task 5: HTTP validation and password handling

**Files:**
- Modify: `backend/demo/src/main/java/conecta/demo/service/SincService.java`
- Modify: `backend/demo/src/main/java/conecta/demo/exception/ApiExceptionHandler.java` if needed
- Modify: `backend/demo/src/main/java/conecta/demo/model/Solicitacao.java` or sync materialization
- Modify: `web/src/core/storage.ts`
- Test: `SincIntegrationHardeningTest.java` and frontend security tests

- [ ] Add failing tests for Bean Validation as HTTP 400 with `campo`, omitted `solicitacoes.criadaEm`, and no password in cached user JSON.
- [ ] Make field violations raise `DadosInvalidosException` with collection-qualified field names; keep business rules at 409.
- [ ] Set missing request `criadaEm` to `Instant.now()` at the backend boundary, preserving the frontend payload contract.
- [ ] Preserve BCrypt and remove password fields from local collection snapshots, logs, API responses, and error messages.
- [ ] Run focused and full backend/frontend suites.

### Task 6: Final verification and audit update

**Files:**
- Modify: `AUDITORIA_EVIDENCIAS.md`
- Modify: `AUDITORIA_RELATORIO_FINAL.md`

- [ ] Run `./gradlew.bat test` from `backend/demo`.
- [ ] Run `npm run build` from `web`.
- [ ] Run `git diff --check` and inspect the complete diff.
- [ ] Separate results into unit, PostgreSQL, concurrency, synchronization, frontend, and E2E evidence.
- [ ] Update risks and production/homologation verdict without claiming production readiness while critical/high issues remain.
