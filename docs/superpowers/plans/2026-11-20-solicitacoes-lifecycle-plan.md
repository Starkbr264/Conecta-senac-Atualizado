# Evolução do Ciclo de Vida das Solicitações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralizar o ciclo de vida das solicitações no backend, expirando pendências vencidas com segurança, preservando histórico e refletindo os estados completos no coordenador.

**Architecture:** O backend será a autoridade para transições: um serviço transacional de expiração será reutilizado pelo agendador, pelas consultas, pela aprovação e pela sincronização. Solicitação de dia único expira à meia-noite da data; período contínuo expira no início (`dataInicio`); `datasEspecificas` mantém a lista original e registra cada ocorrência vencida em uma coleção histórica própria, mantendo a solicitação pendente enquanto houver datas futuras. Aprovação, cancelamento e expiração usarão busca com bloqueio pessimista para impedir transições concorrentes inválidas.

**Tech Stack:** Spring Boot, Spring Data JPA, PostgreSQL/H2, JUnit 5/Mockito/MockMvc, TypeScript, Vite, Vitest.

**Spec:** Requisitos fornecidos pelo usuário em 20/11/2026 — “EVOLUÇÃO DO CICLO DE VIDA DAS SOLICITAÇÕES — CONECTA-SENAC”.

## Global Constraints

- Trabalhar somente na branch `feat/evoluir-solicitacoes`.
- Preservar as alterações locais existentes dos ícones; não tocar no clone antigo.
- Não fazer commit, push, merge, deploy, alteração de Render/Vercel/Supabase ou migração destrutiva.
- Usar `America/Sao_Paulo`; expiração é determinada pela data, nunca pelo horário do turno.
- Não excluir registros históricos fisicamente.
- O backend permanece autoridade final sobre status, permissões, unidade, IDs e concorrência.
- Não usar `git reset --hard`, `git clean -fd`, comandos prune ou `sleep()` para concorrência.

## Review Focus

- Payload antigo tentando restaurar `EXPIRADA`/terminal para `PENDENTE`: teste no Task 4 deve provar que o servidor preserva a transição terminal.
- Solicitação `modo=especificas` com primeira data vencida e data futura: teste no Task 2 deve provar que o registro não expira cedo.
- Aprovação e expiração concorrentes: teste com lock/transação no Task 3 deve provar que apenas uma transição válida vence.
- ID ausente, zero, negativo ou inexistente no dispatcher/API: testes no Task 5 devem provar erro explicativo sem chamada `/0/resposta`.
- Usuário coordenador de outra unidade tentando encerrar solicitação: teste no Task 3 deve provar rejeição sem alteração do histórico.

---

### Task 1: Modelo e contrato de estados

**Files:**
- Modify: `backend/demo/src/main/java/conecta/demo/model/StatusSolicitacao.java`
- Modify: `backend/demo/src/main/java/conecta/demo/model/Solicitacao.java`
- Create: `backend/demo/src/main/java/conecta/demo/model/SolicitacaoDataExpirada.java`
- Modify: `web/src/types/index.ts`
- Modify: `mobile/src/types/index.ts`
- Modify: `backend/demo/src/main/java/conecta/demo/service/SincService.java`
- Test: testes de modelo/sincronização existentes e novo teste de contrato, se necessário

**Interfaces:**
- `StatusSolicitacao`: `PENDENTE`, `APROVADA`, `RECUSADA`, `CANCELADA`, `EXPIRADA`, serializados em minúsculas.
- `Solicitacao`: `expiradaEm`, `origemStatus` e `motivoStatus`, além dos campos atuais.
- `SolicitacaoDataExpirada`: embeddable com `data`, `expiradaEm`, `origem` e `motivo`, armazenado em `solicitacao_datas_expiradas` e vinculado à solicitação.
- Motivo exato de expiração: `Data solicitada atingida sem decisão do coordenador`.
- Origem exata da expiração: `SISTEMA`.

- [ ] Escrever testes que validem serialização/deserialização dos cinco status e preservação dos campos novos no JSON de `/api/sinc`.
- [ ] Executar os testes e confirmar a falha por enum/campos ausentes.
- [ ] Adicionar os campos e a coleção histórica com `ddl-auto=update`, sem alterar ou apagar colunas existentes, e ampliar o mapeamento de sincronização.
- [ ] Executar testes focados e verificar que status desconhecido continua rejeitado com 400.

### Task 2: Serviço central de expiração temporal

**Files:**
- Create: `backend/demo/src/main/java/conecta/demo/service/SolicitacaoExpiracaoService.java`
- Modify: `backend/demo/src/main/java/conecta/demo/repository/SolicitacaoRepository.java`
- Modify: `backend/demo/src/main/java/conecta/demo/service/SolicitacaoService.java`
- Modify: `backend/demo/src/main/java/conecta/demo/DemoApplication.java`
- Test: `backend/demo/src/test/java/conecta/demo/SolicitacaoExpiracaoServiceTest.java`

**Interfaces:**
- `LocalDate dataEfetivaDeExpiracao(Solicitacao)` — usa `data` para dia único e `dataInicio` para período contínuo.
- `int expirarVencidas()` — expira períodos/dias únicos vencidos e registra cada data específica `<= hoje`, sem tocar em datas futuras.
- `void expirarSeVencida(Solicitacao)` — operação idempotente usada antes de aprovar/consultar; para datas específicas atualiza ocorrências e só fecha o pedido quando não restar data futura.

- [ ] Escrever testes com `Clock.fixed`: futuro, último dia anterior, meia-noite, três turnos, aprovação/recusa/cancelamento preservados, repetição idempotente, período expirando no início e datas específicas expirando individualmente com datas futuras preservadas.
- [ ] Executar o teste temporal e confirmar falhas antes da implementação.
- [ ] Implementar cálculo por data, sem consultar início/fim de turno, usando lock pessimista nos pendentes; para período usar `dataInicio` e para datas específicas gravar ocorrências vencidas.
- [ ] Registrar `expiradaEm`, `origemStatus=SISTEMA`, motivo e manter `resposta`/dados originais.
- [ ] Ativar rotina agendada no backend para execução periódica; a rotina será apenas complemento, não a única garantia.
- [ ] Executar testes focados e confirmar que a data local é calculada pelo relógio/fuso do servidor.

### Task 3: Transições, cancelamento, autorização e concorrência no backend

**Files:**
- Modify: `backend/demo/src/main/java/conecta/demo/service/SolicitacaoService.java`
- Modify: `backend/demo/src/main/java/conecta/demo/repository/SolicitacaoRepository.java`
- Modify: `backend/demo/src/main/java/conecta/demo/controller/SolicitacaoController.java`
- Test: `backend/demo/src/test/java/conecta/demo/SolicitacaoServiceTest.java`
- Test: novo `backend/demo/src/test/java/conecta/demo/SolicitacaoLifecycleApiTest.java`

**Interfaces:**
- `POST /api/solicitacoes/{id}/cancelar` para coordenador/admin, com motivo opcional.
- `SolicitacaoService.cancelar(Long id, String motivo)` — somente `PENDENTE` ou cópia duplicada ainda válida; unidade/permissão verificadas.
- `SolicitacaoService.responder(...)` — bloqueia o registro, expira antes de aprovar e rejeita `EXPIRADA`, `CANCELADA` e demais estados terminais.

- [ ] Escrever testes para aprovação de expirada, cancelamento válido, cópia duplicada, cancelamento repetido, perfil/unidade inválidos e disputa aprovação×expiração.
- [ ] Executar testes e confirmar falhas por ausência de endpoint/transições.
- [ ] Implementar `findByIdForUpdate`/consulta de pendentes com `PESSIMISTIC_WRITE`, transições explícitas e notificações sem exclusão física.
- [ ] Fazer `listar`/`buscar` chamar a expiração de recuperação antes de devolver pendências; nunca usar `@Transactional(readOnly=true)` nesse caminho de mutação.
- [ ] Preservar a regra atual de disponibilidade e impedir aprovações conflitantes entre instrutores diferentes.
- [ ] Na aprovação de datas específicas, criar reservas apenas para ocorrências futuras ainda não expiradas, sem recriar reservas para ocorrências já registradas como expiradas.
- [ ] Executar API tests e confirmar respostas HTTP e histórico preservado.

### Task 4: `/api/sinc`, IDs persistidos e autoridade do servidor

**Files:**
- Modify: `backend/demo/src/main/java/conecta/demo/service/SincService.java`
- Modify: `backend/demo/src/main/java/conecta/demo/service/SolicitacaoService.java`
- Test: `backend/demo/src/test/java/conecta/demo/SincSolicitacaoTemporalTest.java`
- Test: `backend/demo/src/test/java/conecta/demo/SincBusinessRulesTest.java`

**Interfaces:**
- `SincService.sincronizar(...)` executará recuperação de expirações antes de aplicar lotes.
- Payload antigo não poderá restaurar registro terminal/expirado para pendente nem remover ocorrências expiradas.
- IDs de operações REST devem ser positivos; IDs provisórios de lote continuam tratados apenas no fluxo de criação e mapeamento.

- [ ] Escrever testes para cache antigo, status `EXPIRADA`, histórico aprovado/recusado/cancelado e ID zero/inexistente.
- [ ] Executar testes e confirmar falhas reproduzindo restauração de status e aceitação de ID inválido.
- [ ] Separar transição de status do simples merge de campos no `salvar("solicitacoes", ...)`; preservar status terminal do banco e metadados de expiração.
- [ ] Mesclar `datasEspecificas` sem apagar a coleção histórica de ocorrências expiradas; status enviado pelo cliente só poderá manter estado compatível, nunca reabrir estado terminal.
- [ ] Rejeitar IDs REST `<= 0` com erro de domínio/404 apropriado, sem alterar registros.
- [ ] Executar testes de sincronização e verificar idempotência por `operacaoId`.

### Task 5: Correção definitiva do ID zero no web e cancelamento de duplicidades

**Files:**
- Modify: `web/src/entry/coordenador.ts`
- Modify: `web/src/core/api.ts`
- Modify: `web/src/core/storage.ts`
- Modify: `web/src/types/index.ts`
- Modify: `web/src/features/coordenador/coordenador.ts`
- Modify: `web/coordenador.html`
- Test: `web/src/features/coordenador/coordenador.solicitacoes.test.ts`
- Test: novo teste de dispatcher/API de solicitações

**Interfaces:**
- Nenhum handler de solicitação usará `num ?? 0`; ID ausente/zero exibirá erro e não fará request.
- `cancelarSolicitacao(id, motivo)` usará o endpoint dedicado e exigirá `Number.isSafeInteger(id) && id > 0`.
- Duplicidade continuará separada de conflito entre instrutores; cópia terá indicador, ID original e ação de cancelamento.

- [ ] Escrever testes para ausência/zero de ID, request correta, aba Expiradas, cinco contadores, cópia duplicada e conflito entre instrutores.
- [ ] Executar testes e confirmar falhas no fallback `0` e nos estados/abas ausentes.
- [ ] Corrigir dispatcher, storage e API para validar ID persistido antes de qualquer chamada; não usar fallback silencioso.
- [ ] Adicionar abas Pendentes/Aprovadas/Recusadas/Canceladas/Expiradas e manter Aprovar ausente em estados não pendentes.
- [ ] Atualizar diagnóstico para diferenciar duplicidade real, conflito e cópia cancelável; mostrar justificativa `Solicitação duplicada da solicitação #ID`.
- [ ] Executar Vitest focado e confirmar que o registro histórico continua visível após cancelamento.

### Task 6: Interface do instrutor/mobile e compatibilidade de contratos

**Files:**
- Modify: `web/src/features/instrutor/instrutor.ts`
- Modify: `mobile/src/types/index.ts`
- Modify: `mobile/src/services/storage.ts`
- Modify: `mobile/src/app/coordenador/index.tsx`
- Modify: `mobile/src/app/instrutor/index.tsx`
- Test: testes web/mobile existentes e novos testes de status

- [ ] Atualizar tipos, badges, filtros e contadores para `CANCELADA`/`EXPIRADA`, sem permitir reativação local.
- [ ] Exibir no histórico as ocorrências expiradas individualmente quando existirem datas futuras ainda pendentes.
- [ ] Garantir que dados retornados pelo backend substituam cache antigo e que status expirado não seja convertido em pendente.
- [ ] Ajustar cancelamento/consulta no mobile somente onde o contrato realmente for consumido; não criar regra paralela de expiração.
- [ ] Executar testes de tipo e testes disponíveis do mobile/web.

### Task 7: Verificação integral e relatório

**Files:**
- Inspect only: `backend/demo/build/test-results/test/*.xml`
- Inspect only: `git diff`, status e relatórios de build

- [ ] Executar `backend/demo/gradlew build` e conferir todos os XMLs da versão atual.
- [ ] Executar `npm test`, `npm run typecheck`, `npm run build` em `web`.
- [ ] Executar testes/build configurados do mobile, se disponíveis sem instalação ou alteração externa.
- [ ] Executar `git diff --check` e confirmar que apenas arquivos planejados mais as alterações locais de ícones estão presentes.
- [ ] Relatar causa do ID zero, expiração/recuperação, duplicidades, conflitos, histórico, banco, testes e pendências de homologação.
- [ ] Parar sem commit, push, merge ou deploy e aguardar autorização.

## Decisões de compatibilidade

- `ddl-auto=update` adicionará apenas colunas novas; não haverá exclusão, reset ou alteração de dados reais.
- Para `datasEspecificas`, cada data vencida será registrada individualmente em `solicitacao_datas_expiradas`; as datas originais e futuras permanecerão preservadas. O status do pedido só vira `EXPIRADA` quando não restarem ocorrências futuras.
- Para período contínuo, a solicitação inteira vira `EXPIRADA` quando começa (`dataInicio`), conforme a regra do ciclo de vida; não haverá expiração parcial de dias do período.
- `CANCELADA` será uma transição explícita de solicitação, não uma remoção via `/api/sinc`.
- As alterações de ícones locais existentes serão mantidas separadas e não serão commitadas nesta etapa.
