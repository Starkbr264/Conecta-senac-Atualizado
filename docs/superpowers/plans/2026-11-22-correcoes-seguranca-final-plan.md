# Correções Finais de Segurança — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar identidade, idempotência, cache e fila offline seguros contra troca de conta e concorrência, preservando o isolamento já implementado.

**Architecture:** O backend aceitará apenas identidades derivadas de JWTs com `uid`, fará reserva global atômica de `operacaoId` dentro da mesma transação dos efeitos e obterá o usuário autenticado pelo contexto de segurança. O web usará lock cross-tab com fallback seguro e o mobile armazenará cache/fila por usuário. A estrutura SQL será declarada por migration versionada, sem execução em banco compartilhado.

**Tech Stack:** Java 21, Spring Boot 4, Spring Data JPA, PostgreSQL, Gradle, TypeScript, Vitest, React Native/Expo AsyncStorage.

**Spec:** Solicitação de correção final de segurança — JWT, idempotência, cache e fila offline.

## Global Constraints

- Não fazer commit, push, merge ou deploy.
- Não executar migrations nem escrever em Supabase, Render ou Vercel.
- Preservar os planos `2026-11-20-solicitacoes-lifecycle-plan.md` e `2026-11-22-cache-fila-isolamento-plan.md`.
- Não restaurar leitura de cache privado global sem identidade válida.
- Não confiar em `userId` ou `X-Usuario-Id` fornecidos pelo cliente.

## Review Focus

- Token antigo sem `uid` em `/api/sinc` e endpoints autenticados: deve exigir novo login.
- Mesmo `operacaoId` em duas transações: somente uma pode aplicar efeitos.
- Troca de identidade durante HTTP ou flush: resposta antiga não pode tocar cache/fila atual.
- Cache mobile após logout/401: conta seguinte não pode herdar dados ou pendências.
- Schema parcialmente migrado: aplicação deve falhar de forma explícita, sem backfill fictício.

### Task 1: Identidade backend

**Files:** `JwtAuthenticationFilter`, `UsuarioAtual`, `SincService`, `SalaController`, `SalaService`, testes de segurança.

- [ ] Adicionar testes falhos para `uid` ausente/inválido, usuário divergente e header não confiável.
- [ ] Expor/resolver identidade autenticada somente pelo JWT validado.
- [ ] Rejeitar tokens sem `uid` nos endpoints autenticados que exigem identidade.
- [ ] Remover `X-Usuario-Id` da assinatura de atualização de sala.
- [ ] Executar testes backend focados.

### Task 2: Idempotência atômica

**Files:** `SincOperacao`, `SincOperacaoRepository`, `SincService`, migration, testes de concorrência.

- [ ] Adicionar testes concorrentes reais com barreira e threads.
- [ ] Reservar `operacaoId` globalmente antes dos efeitos, com proprietário autenticado.
- [ ] Manter reserva, efeitos e resposta na mesma transação.
- [ ] Tratar concorrente vencedor/perdedor sem devolver resposta a outro proprietário.
- [ ] Verificar rollback de reserva e efeitos.

### Task 3: Fila web e 401

**Files:** `web/src/core/storage.ts`, `web/src/core/api.ts`, `web/src/core/auth.ts`, testes de storage/API.

- [ ] Adicionar testes falhos para lock entre abas, reler fila sob lock e 401.
- [ ] Implementar Web Locks quando disponível e lease fallback com expiração.
- [ ] Revalidar sessão antes de cada envio e antes de aplicar resposta.
- [ ] Invalidar memória/cache/contexto imediatamente no 401, sem tratar 403 como logout.

### Task 4: Cache e fila mobile

**Files:** `mobile/src/services/storage.ts`, `mobile/src/services/api.ts`, testes mobile existentes ou novos.

- [ ] Namespacear coleções e estado de sync pelo ID imutável.
- [ ] Migrar leituras/escritas da conta atual sem apagar namespaces de outras contas.
- [ ] Quarentenar pendências sem proprietário.
- [ ] Invalidar memória no logout e 401.

### Task 5: Migration e configuração

**Files:** migration versionada, `application.properties`, `build.gradle` se necessário.

- [ ] Identificar mecanismo de migration adotado pelo projeto.
- [ ] Criar migration nullable para `usuario_id`, índice e unicidade global existente.
- [ ] Não fazer backfill de registros legados.
- [ ] Remover dependência de `ddl-auto=update` no ambiente de produção sem alterar configurações compartilhadas.

### Task 6: Regressão e fechamento

**Files:** fixtures de `sala-status.test.ts` e `coordenador.solicitacoes.test.ts`, testes de regressão.

- [ ] Criar sessão de teste válida e usar chaves namespaceadas.
- [ ] Executar backend completo, web completo, typecheck/build/Playwright e mobile typecheck.
- [ ] Comparar falhas com HEAD limpo sem descartar alterações.
- [ ] Revisar status, diff e ausência de operações remotas.
