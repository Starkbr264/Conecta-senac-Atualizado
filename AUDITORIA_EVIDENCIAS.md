# AUDITORIA — Evidências em andamento (não commitar)

Trabalho em curso. Restrições do kickoff: sem commit/push/merge/deploy, sem alterar `main-Versão-4.0`,
sem mexer em credenciais de produção, sem excluir registros reais, preservar backups.
Texto original do kickoff: `AUDITORIA_KICKOFF_ORIGINAL.txt` (na raiz desta worktree).

## Etapa 1 — Arquitetura (CONCLUÍDA)
- Ver resumo no contexto: frontend Vercel (build `web/`), backend Render (Spring Boot, healthCheck `/api/dados`),
  banco Supabase Postgres via `SPRING_DATASOURCE_URL`, JWT Bearer, token em `localStorage['conecta_token']`.

## Etapa 2 — Testes com PostgreSQL REAL (CONCLUÍDA)

Infra: `testImplementation 'io.zonky.test:embedded-postgres:2.2.2'` em `backend/demo/build.gradle`
(PostgreSQL 14.22 embutido, banco temporário por JVM de teste — não toca no Supabase de produção).
Teste: `backend/demo/src/test/java/conecta/demo/PostgresRealAuditTests.java` (perfil `test`,
`@DynamicPropertySource` lazy, `JdbcTemplate` para asserts diretos, ids provisórios 96xxx/99xxx
com DELETE de limpeza). **14 testes PG: 0 falhas. Suíte completa: 103 testes / 0 falhas.**

### 2.1 Estrutura do banco (PASSOU)
- Todas as 8 tabelas criadas via JPA (`ddl-auto=update`) no PG real; PK, UNIQUE de `email`
  (usuarios), `codigo` (turmas/chaves) e `nome` (unidades) funcionando; colunas de datas DATE.
- Commit persiste; rollback desfaz (testes de transação isolada).

### 2.2 id_sequences (PASSOU)
- Tabela criada e `initializeCollections` idempotente (2 execuções = mesmas 8 linhas;
  ON CONFLICT DO NOTHING no PG). Coexistência: id 99010 já existente não colide com alocação seguinte.
- **Concorrência real**: 8 threads × 5 IDs = 40 IDs únicos, 0 duplicados, 0 perdidos.
- **Lock**: `SELECT ... FOR UPDATE` serializa (thread B espera A commitar); lock liberado após
  commit E após rollback (B avança nos dois casos).
- **Duas instâncias do backend**: 2ª aplicação Spring (`SpringApplicationBuilder`, contexto e
  Hikari próprios) no MESMO PG — sincronizações simultâneas geraram ids distintos (1011 × 1012),
  sem colisão, ambos persistidos. Falha anterior do teste: `.properties()` do builder tem
  precedência BAIXA e o H2 de `src/test/resources/application.properties` vencia — corrigido com
  `ApplicationContextInitializer` + `addFirst` (armadilha de teste, não bug do produto).
- **Sem caminho `MAX(id)+1` no runtime**: os 9 services recebem `IdAllocatorService` pelo
  construtor `@Autowired`; o fallback `max+1` só existe no construtor legado sem allocator
  (instanciação manual) e dentro de `next()` como piso ANTES do lock — não há alocação
  concorrente sem sequence.
- **Seed**: `SeedService.semear()` insere unidades com ids **1001–1010** (só se tabela vazia);
  primeira alocação livre = 1011 (piso max+1) — correto.

### 2.3 Transações do lote (PASSOU — 5 cenários do kickoff)
1. Tudo válido → persiste tudo.
2. Erro no 1º item → NADA persiste (rollback total).
3. Erro no meio do lote → nada persiste.
4. Erro no último item → nada persiste.
5. Duas sincronizações simultâneas → sem IDs duplicados, sem perda.
- Lote inválido nunca deixa gravações parciais (contagem = baseline após cada falha).

## Etapa 3 — Regras de negócio no PostgreSQL REAL (CONCLUÍDA)

Teste: `backend/demo/src/test/java/conecta/demo/PostgresBusinessRulesAuditTests.java`
(Embedded Postgres zonky, MockMvc sem filtros + `TestingAuthenticationToken`, seed idempotente,
limpeza de ids > seeds com tabelas coleção antes das pais). **39 testes PG: 0 falhas.
Suíte completa: 142 testes / 0 falhas.** Cada cenário valida código HTTP + corpo (`$.erro`/`$.campo`)
+ estado final no banco (contagem após a falha = baseline; nada persiste em erro).

### Grupo 1 — Usuários (6 cenários)
- Cadastro válido → 200, hash BCrypt (`$2a$/$2b$`), e-mail único no banco.
- Senha < 8 chars → 409 `A senha deve ter pelo menos 8 caracteres`; nada gravado.
- E-mail duplicado (case-insensitive) → 409 `Ja existe um usuario com este e-mail`; original permanece único.
- Edição sem senha no payload → 200, nome atualizado e hash da senha PRESERVADO (não re-hasheia).
- Perfil ausente → 409 `Dados do usuario invalidos`; perfil desconhecido → 400 campo `usuarios.perfil`.

### Grupo 2 — Unidades (4 cenários)
- Cadastro válido → 200, CEP gravado normalizado (`70000-001`).
- Nome vazio (Bean @NotBlank) → 409 `Dados invalidos`.
- Nome duplicado → 409 `Ja existe uma unidade com este nome` (só o seed permanece).
- CEP malformado → 409 `CEP deve conter 8 digitos`.

### Grupo 3 — Salas e turmas (5 cenários)
- Sala válida → 200 (turnos aceitos como lista); capacidade 0 (@Positive) → 409 `Dados invalidos`;
  sem turnos → 409 `Informe ao menos um turno da sala`.
- Turma com instrutor inexistente → 409 `Instrutor informado nao existe`; instrutor de outra
  unidade → 409 `Instrutor deve pertencer a mesma unidade da turma`; cadastro válido → 200.

### Grupo 4 — Reservas (5 cenários)
- Válida (sala 5004 sem reserva, turma Noturno) → 200.
- Conflito com seed 7001 (sala 5001/Matutino/seg-sex) → 409 `Ja existe reserva para esta sala, periodo e turno`;
  estado final: exatamente 1 reserva ATIVA naquele sala/turno (a original).
- Sala inexistente → 404; sala de outra unidade → 409 `A sala nao pertence a unidade informada`;
  status `EMPRESTADA` → 400 campo `reservas.status`.

### Grupo 5 — Chaves (4 cenários)
- Cadastro válido → 200 com status default `DISPONIVEL`; código duplicado → 409 `Ja existe uma chave com este codigo`;
  sala inexistente → 404; instrutor tentando criar chave → 403 `Perfil nao pode sincronizar a colecao chaves`.

### Grupo 6 — Solicitações e notificações (9 cenários)
- Solicitação válida (com `criadaEm`) → 200; sala inexistente → 409 `Sala da solicitacao nao existe`;
  turma inexistente → 409 `Turma da solicitacao nao existe`; instrutor de outra unidade → 409
  `Solicitacao deve usar instrutor, sala e unidade compativeis`; unidade inexistente → 409
  `Unidade da solicitacao nao existe`; data malformada → 400 campo `solicitacoes.data`.
- Notificação válida → 200; destinatário de outra unidade → 409
  `Notificacao e usuario destinatario devem pertencer a mesma unidade`.

### Grupo 7 — Segurança e autorização (5 cenários)
- Recepção 1001 removendo chave da unidade 1002 → 403 `Usuario nao pode remover registro de outra unidade`
  (registro intacto).
- Sem perfil no token → 403 `Perfil nao autorizado para sincronizacao`.
- Recepção criando turma → 403 `Perfil nao pode sincronizar a colecao turmas` (nada gravado).
- Coleção desconhecida no payload → 403 `Perfil nao autorizado para sincronizacao`.
- Contornar validações alterando ids no payload (recepção troca salaId de chave própria para sala
  de outra unidade) → 409 `A sala nao pertence a unidade informada`; banco inalterado.

### ACHADO ETAPA-3-1 (MÉDIO) — Payload de solicitação sem `criadaEm` → 409 genérico
- `SincService` linha 565 só seta `criadaEm` se vier no payload; coluna `criada_em` é NOT NULL →
  `DataIntegrityViolationException` → handler devolve **409 `{"erro":"Conflito de integridade de dados"}`
  sem `campo`**, em vez de 400 indicando `solicitacoes.criadaEm` (ou default `Instant.now()`).
- O frontend real envia `criadaEm` (`web/src/core/storage.ts:851`), então o fluxo de produção não cai
  aqui; um cliente API que omita o campo leva 409 genérico. Cenário
  `solicitacaoSemCriadaEmFalhaCom409Generico` documenta o comportamento.

### Armadilhas de teste encontradas (não são bugs do produto)
- Tabelas coleção (`reserva_dias_semana`, `solicitacao_turnos/dias_semana/datas_especificas`,
  `sala_turnos*`) têm FK para as pais — limpeza deve deletar filhas antes.
- Colunas Hibernate em snake_case (`sala_id`, `criada_em`), não os nomes dos atributos Java.
- Spring Boot 4 usa Jackson 3 (`tools.jackson.databind.ObjectMapper`), não `com.fasterxml.jackson`.

## Etapa 4 — E2E pelo navegador (CONCLUÍDA)

Checklist 4.2 dos 16 fluxos: (1) site ✓, (2) logins admin/coordenador/instrutor/recepção ✓,
(3) carregamento de dados ✓, (4) usuário id 9 ✓, (5) edição nome+perfil ✓, (6) unidade id 5 ✓,
(7) sala id 7 ✓, (8) turma — UI FALHOU 409 / API ✓ id 5, (9) reserva — UI FALHOU 409 / API ✓ id 6,
(10) chave ✓ id 6 (com CRÍTICO-6 restaurado), (11) solicitação — UI FALHOU 409 / API ✓ id 6,
(12) notificação — UI FALHOU junto / API ✓ id 7, (13) sincronizações executadas ✓, (14) reload ✓,
(15) novo login (logout+login admin) ✓, (16) registros conferidos no servidor ✓.
Console: sem erros de JS; só "Failed to load resource" 400/401/403/409 das falhas de sinc (esperadas).
Critério "não aprovar só pela UI" atendido: 3 criações de UI anunciaram sucesso sem persistir.

Ambiente: `https://conecta-senac-test-yw11.vercel.app` → `https://conecta-senac-test.onrender.com` → Supabase.
Abas: `tab_7e876250-...` = admin; `tab_082d9382-...` = coordenador `email@gmail.com` (id 7, unidade 1).

### Evidências aprovadas
1. Login admin (`Senac_GDF@Hotmail.com`, unidade 1) → painel; console sem erros de JS.
2. `GET /api/dados` (CORS) → 200; dados do Supabase espelhados em `sn_v6_*`.
3. Sondas autenticadas em `/api/sinc` → validações novas ATIVAS no Render:
   - id textual → 400 `{campo:"turmas.id"}`
   - data inválida → 400 `reservas.dataInicio`
   - status de solicitação desconhecido → 400
   - item sem id → 400 `turmas.id` obrigatório
   - `alteracoes.turmas` como string → 400
   - coleção desconhecida → 403 `Perfil nao autorizado para sincronizacao`
   - sem token → 401 `Nao autenticado`
4. Usuário criado pela UI → id 9 (`auditor.e2e@senac.test`), persistiu no servidor; edição de nome persistiu.
5. Unidade `CPS Auditoria E2E` → id 5, persistiu (cidade vazia no payload).
6. Sala `Lab E2E 01` → id 7, unidade 1, criada pelo painel do coordenador (admin é read-only em salas).
7. Turma via API `criados` (id provisório 77001) → id oficial 5, `idsNovos` remapeado corretamente.
8. Reserva via API `criados` (77002) → id 6 persistiu.

### ACHADO ALTO-1 — Lote de `alteracoes` derrubado por dado legado incoerente (regressão da branch)
- O frontend (`web/src/core/storage.ts` → `pushColecao`) envia a COLEÇÃO INTEIRA em `alteracoes` a cada
  `persist()`. A branch passou a validar CADA item (`SincService.salvar(..., criacao=false)` chama
  `turmaService.validarParaSincronizacao` / `reservaService.validarParaSincronizacao` / `validarNotificacao` /
  `solicitacaoService...`). Um único registro legado inválido → 409 → LOTE INTEIRO falha (rollback total).
- Evidência prática no banco de produção (leitura apenas):
  - turmas 1, 2, 4: `instrutorId=3` (unidade 3) com turmas nas unidades 1, 2, 4 → lote turmas → 409
    `Instrutor deve pertencer a mesma unidade da turma`.
  - reserva id 5: turno `Matutino` × turma 2 `Vespertino` → lote reservas → 409
    `O turno da reserva deve ser o turno da turma`.
  - lote notificações → 409 `Notificacao e usuario destinatario devem pertencer a mesma unidade`.
  - lote solicitações → 409 `Solicitacao deve usar instrutor, sala e unidade compativeis`.
  - lotes usuarios/unidades/salas/chaves → 200.
- Consequência E2E: criação de turma e de reserva feitas pela UI EXIBIRAM toast de sucesso mas NÃO
  persistiram (`total` de turmas permaneceu 4; reserva só entrou via chamada direta `criados`).
  `salvarReserva()` chama `toast('Reserva criada!')` logo após `addReservaAsync()` (fire-and-forget,
  `storage.ts:711` só faz escrita local + `pushColecao` em background) — sucesso anunciado sem aguardar API.
- Na falha, `pushColecao` chama `sincronizarServidor()` que substitui o cache pelo servidor → criação
  local é DESCARTADA em silêncio (toast ficou mentindo).

### ACHADO MÉDIO-2 — Senha em texto claro no payload `/api/sinc`
- Criação de usuário pela UI envia `"senha":"Senac.DF2007"` em claro no JSON (o backend faz hash com BCrypt
  ao receber, mas o payload trafega em claro por HTTPS — registrar como observação; design atual).

### ACHADO MÉDIO-3 — Toast de sucesso sem confirmação da API
- `coordenador.ts:886` `toast('Reserva criada!')` imediato; idem edição (`874`). Violação do critério do
  usuário: "não considere aprovado só porque a UI exibiu sucesso".

### ACHADO ALTO-1 (reincidência E2E, instrutor) — solicitação + notificação perdidas com toast de sucesso
- Painel instrutor (`tab_813897f0-...`, enzo@gmail.com id 5) → "Solicitar Sala" (sala 7, 2026-11-10, 08:00-12:00).
- `instrutor.ts:788-806`: `addSolic()` + `addNotif()` locais e `toast('Solicitação enviada! Aguarde aprovação.')`
  SEM aguardar a API (idem MÉDIO-3 no coordenador).
- O `pushColecao` enviou lote só de `notificacoes` → servidor 409
  `Notificacao e usuario destinatario devem pertencer a mesma unidade` (dado legado).
- Resultado: solicitação e notificação DESCARTADAS do localStorage (voltou a 5 e 6) e ausentes no servidor,
  apesar do toast de sucesso. Modal já havia fechado. Usuário perde a solicitação silenciosamente.
- Envolvidos: notificação legada incoerente + lote por coleção inteira (ver ALTO-1).

### Outras observações da Etapa 4
- Edição de perfil do usuário 9 → `recepcao`: primeiro envio falhou com `net::ERR_ABORTED` timeout 60s
  (Render acordando: `/api/dados` deu 503 e depois 401 sem token = comportamento esperado do free tier);
  reenvio manual persistiu `perfil=recepcao` no servidor. NÃO é bug de lógica.
- Bean Validation violada no backend → 409 `{"erro":"Dados invalidos"}` (ex.: turma sem `nome`) — ver MÉDIO-4.
- `GET /api/dados` responde `cache-control` sem `no-store`; fetch com `cache:'no-store'` evita falso negativo.
- `ALTERACOES`: turmas criadas pela UI do coordenador usam `unidadeId` do usuário logado e exigem
  instrutor da mesma unidade (409 `Instrutor deve pertencer a mesma unidade da turma` quando o select
  oferece instrutor de outra unidade — aqui o select já filtra; a 409 veio do dado legado no lote).

### ACHADO MÉDIO-4 — Bean Validation responde 409 (não 400) sem detalhar o campo
- `SincService.validarEntidade` (linha 653-657) lança `RegraDeNegocioException("Dados invalidos")` quando a
  entidade viola `@NotBlank` etc. → HTTP 409 sem `campo`, enquanto o `ApiExceptionHandler` já sabe devolver
  400 `{"erro":"Dados invalidos","campo":...}` para `MethodArgumentNotValidException`. Evidência: turma sem
  `nome` enviada direto → 409 `{"erro":"Dados invalidos"}`.
- Impacto: inconsistência de contrato 400 vs 409 + cliente não recebe o campo para exibir mensagem útil.

### ACHADO MÉDIO-5 — Sessão única compartilhada entre abas (Etapa 5)
- `localStorage` é compartilhado por todas as abas da mesma origem: o login como instrutor e depois como
  recepção (aba instrutor) SUBSTITUIU silenciosamente o token usado pela aba admin (perfil no JWT virou
  `recepcao` com `sub=auditor.e2e@senac.test`). A aba admin continuou exibindo a UI de administrador.
- O `/api/dados` filtra por unidade/perfil do token (totais "caíram" para os da unidade 1), o que confirma
  que NÃO houve remoção de registros — apenas troca de sessão. Não há revalidação contínua de perfil na UI.
- Efeito prático: ações de admin na aba herdariam 403 do servidor (a UI só descobre no envio).

### Sondas de autorização por perfil (token recepção, `alteracoes` vazio)
- `chaves` → 200 (RECEPCAO pode: chaves, notificacoes)
- `usuarios` → 403 `Perfil nao pode sincronizar a colecao usuarios`
- `unidades` → 403 `Perfil nao pode sincronizar a colecao unidades`
- `reservas` → 403 `Perfil nao pode sincronizar a colecao reservas`
- Mapa (SincService:150-154): ADMIN→todas; COORDENADOR→salas/turmas/reservas/solicitacoes/notificacoes;
  INSTRUTOR→solicitacoes/notificacoes; RECEPCAO→chaves/notificacoes; coleção desconhecida→403.

### ACHADO MÉDIO-5 — Identidade da UI × identidade autenticada dessincronizadas entre abas (Etapa 5)
- Sessão (`getSessao`) vive em `sessionStorage` (POR ABA — `theme.ts:46/66`), mas o JWT fica em
  `localStorage['conecta_token']` (GLOBAL — `api.ts`/`salvarToken`). Login em uma aba troca o JWT de TODAS.
- Evidência: após login de recepção na outra aba, a aba `admin.html` recarregou exibindo o painel
  **Administrador** (sessionStorage ainda admin) com `Authorization` de `perfil=recepcao` (localStorage).
  Resultado: UI de admin operando com dados filtrados pelo servidor (totais da unidade 1) e ações
  administrativas retornando 403 — a UI só descobre no envio, sem mensagem de sessão divergente.
- `requirePerfil` (`auth.ts:25`) compara apenas a sessão local da aba; nada valida que a sessão da aba
  corresponda ao perfil do JWT usado nas chamadas.
- Não houve remoção de dados (o "sumiço" de registros foi só o filtro por unidade do novo token).

### ACHADO CRÍTICO-6 — Registro real SOBRESCRITO por geração de id no cliente (perda de dado em produção)
- A criação de chave pela UI da recepção gerou `id=2` (`nextId(CACHE.chaves)` no cliente) SOBRE o cache
  FILTRADO por unidade (`/api/dados` retorna só a unidade do token → só CH-101 id 1 visível → próximo = 2).
- O backend grava com JPA `save()` (upsert por PK) sem checar colisão para `chaves` → **sobrescreveu o
  registro real CH-102 (id 2, unidade 2, sala 2)**. A permissão RECEPCAO permite sincronizar `chaves`
  (a validação de unidade do payload compara com a unidade do usuário — a nova era unidade 1 = ok — mas
  não protege o registro de outrа unidade já existente naquela PK).
- Evidência: totais de chaves continuaram 4 (1, 3, 4 + nova id 2); CH-102 sumiu do banco.
- DADOS ORIGINAIS RECUPERADOS de captura de rede antiga (aba coordenador, request `:64`):
  `{"andar":"2 Andar","codigo":"CH-102","id":2,"instrutorId":null,"pegaEm":null,"salaId":2,"status":"disponivel","unidadeId":2}`
- Mesma causa raiz do risco de `proximoId` no servidor para coleções sem realocação automática
  (usuarios tem realocação por email; chaves não tem nada).
- **RESTAURADO com autorização do usuário** (opção "Restaurar agora"): remoção da chave de teste do id 2
  (`remocoes`) + recriação de CH-102 + recriação da chave de teste. Resultado final: 5 chaves —
  CH-101 id 1, CH-103 id 3, CH-104 id 4, **CH-102 id 5** (conteúdo idêntico ao original; o backend
  realocou o PK para o próximo livre em vez de honrar `id:2`), Chave E2E Auditoria id 6.
  Todos os campos de CH-102 conferem com o original (andar 2 Andar, salaId 2, unidadeId 2, disponivel).

### Dados criados pela auditoria (marcados como teste, NÃO excluir sem autorização)
- usuario id 9 `auditor.e2e@senac.test` (perfil alterado para `recepcao` para testar o painel)
- unidade id 5 `CPS Auditoria E2E`
- sala id 7 `Lab E2E 01`
- turma id 5 `2026.01.901` / `Turma E2E 901`
- reserva id 6 (sala 7, turma 1, Matutino, 2026-11-09..13, seg/qua)

## Etapas 5–8 — fechamento da auditoria

### Etapa 5 — sincronização entre sessões
- Abas normais da mesma origem compartilham `localStorage['conecta_token']`; login em uma aba substitui o JWT das demais.
- `sessionStorage` mantém a identidade visual por aba, mas não acompanha a troca global do JWT. A UI pode continuar mostrando administrador enquanto o servidor recebe token de recepção e retorna 403/filtra dados.
- Como não havia janela anônima disponível, não foi possível aprovar propagação entre duas sessões autenticadas realmente isoladas. O comportamento observado é um achado de segurança/consistência, não perda de dados.

### Etapa 6 — infraestrutura/configuração
- API publicada respondeu `401` sem token com `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`; chamadas autenticadas anteriores responderam `200` e leram o Supabase.
- Render recebe `SPRING_DATASOURCE_URL`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` e `JWT_SECRET` por variáveis; nenhuma credencial foi copiada para as evidências.
- CORS permite o domínio Vercel de teste e localhost; a comunicação Vercel → Render foi comprovada no navegador.
- `spring.jpa.hibernate.ddl-auto=update` permanece ativo. Funciona, mas exige migrações controladas antes de produção. Não há limites/timeouts Hikari explícitos no arquivo principal.

### Etapa 7 — erros
- Foram observados contratos `401` (sem autenticação), `403` (autorização), `404` (recurso inexistente), `409` (regra/integridade) e `400` (payload inválido) sem stack trace exposto.
- Cold start/timeout do Render foi observado em primeira chamada; o frontend possui timeout e caminho offline, mas os toasts de sincronização ainda podem confirmar antes da API.

### Etapa 8 — relatório
- Relatório consolidado em `AUDITORIA_RELATORIO_FINAL.md`, com seções A–G e parecer objetivo para os itens 1–9 do kickoff.
