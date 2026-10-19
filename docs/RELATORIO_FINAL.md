# Conecta-Senac — Relatório Final de Refatoração

**Repositório:** `Conecta-Senac-Atualizado`
**Data:** outubro de 2026
**Escopo:** reorganização do monorepo, migração do frontend web para TypeScript,
unificação de contratos web↔mobile↔Java, refatoração estrutural do backend Spring
Boot, testes automatizados e este relatório.

---

## Sumário

1. [Arquitetura do monorepo](#1-arquitetura-do-monorepo)
2. [Reorganização física](#2-reorganização-física)
3. [Migração do web para TypeScript](#3-migração-do-web-para-typescript)
4. [Bugs corrigidos](#4-bugs-corrigidos)
5. [Código morto removido](#5-código-morto-removido)
6. [Unificação de contratos web↔mobile↔Java](#6-unificação-de-contratos-webmobilejava)
7. [Endurecimento de tipagem do `web/src/core/`](#7-endurecimento-de-tipagem-doesrc-core)
8. [Ajustes estruturais](#8-ajustes-estruturais)
9. [Refatoração do backend Spring Boot](#9-refatoração-do-backend-spring-boot)
10. [Modo Mock vs. Modo Produção](#10-modo-mock-vs-modo-produção)
11. [Higiene do monorepo](#11-higiene-do-monorepo)
12. [Migração de eventos inline para `data-action`](#12-migração-de-eventos-inline-para-data-action)
13. [Padronização web ↔ mobile](#13-padronização-web--mobile)
14. [Testes automatizados e CI](#14-testes-automatizados-e-ci)
15. [Pendências conhecidas](#15-pendências-conhecidas)
16. [Como executar](#16-como-executar)

---

## 1. Arquitetura do monorepo

O repositório contém **três aplicações independentes** e um servidor de dados
compartilhado:

| Camada | Caminho | Stack | Porta |
|---|---|---|---|
| Backend Java | `backend/demo/` | Spring Boot 4.0.7 / JPA / Postgres (Supabase) | 8081 |
| Servidor de dados | `server/` | Node puro, CommonJS, `server/data/db.json` | 3333 |
| Frontend web | `web/` | TypeScript estrito + Vite + HTML | 5173 |
| Frontend mobile | `mobile/` | Expo 51 / React Native 0.74.5 / TypeScript estrito | — |

> **Fato importante:** nenhum dos dois frontends consome as rotas do Spring Boot.
> Ambos falam com o servidor Node (`server/`, porta 3333), que é a **fonte da
> verdade dos dados** em produção. O backend Java permanece como projeto
> paralelo (pendência #9).

### Fontes de verdade do contrato de dados

1. **`server/seed.js`** — define a forma exata dos objetos que web e mobile
   trocam com o servidor Node (`POST /api/sinc`, `GET /api/dados`).
2. **`backend/demo/src/main/java/conecta/demo/model/`** — as 12 entidades JPA,
   que descrevem as colunas das tabelas.
3. **Campos `LEGADO`** — `Reserva.reservadoPorId`, `Reserva.solicId` e
   `Notificacao.mensagem` existem só no servidor Node e no web. O backend Java
   **não** os possui. Foram preservados como opcionais.

**Regra de ouro adotada:** *nenhum nome de propriedade JSON pode ser alterado;
alinha-se tipagem e opcionalidade, nunca se renomeiam chaves.*

---

## 2. Reorganização física

| Antes | Depois |
|---|---|
| `demo-conecta-senac3.1(backend)/demo/` | `backend/demo/` |
| `Conecta-Senac-main (frontend web +mobile)/frontend_reserva_salas/frontend_reserva_salas/` | `web/` |
| `Conecta-Senac-main (frontend web +mobile)/src/` + `app.json` | `mobile/` |
| `Conecta-Senac-main (frontend web +mobile)/server/` | `server/` |

**Infraestrutura ajustada:**

- `.gitignore` na raiz — antes não ignorava `node_modules/`, que estava
  **versionado com 889 arquivos**.
- `.gitattributes` na raiz (`* text=auto eol=lf`) — sem isso, `Dockerfile`,
  `compose.yaml` e `gradlew` versionados com CRLF quebravam o build Linux.
- `Dockerfile` na raiz — multi-stage (node → Gradle → JRE).
- `compose.yaml` na raiz — 3 serviços (`postgres`, `api`, `server`).
- `.dockerignore` na raiz.
- `.env.example` na raiz.
- `backend/demo/.gitattributes` e `backend/demo/.gitignore` restaurados com o
  conteúdo Gradle/Java.
- `mobile/.gitignore` reescrito com o conteúdo Expo/RN.
- `web/.gitignore` e `server/.gitignore` criados (o de `server/` **não** ignora
  `data/db.json`, que é dado versionado).
- `.gitignore` de IDE em **todos** os subprojetos (raiz, `web/`, `server/`,
  `mobile/`, `backend/demo/`).

---

## 3. Migração do web para TypeScript

**15 arquivos JavaScript convertidos** para 31 arquivos TypeScript estritos
(7 944 linhas), mantendo 100% de paridade visual e comportamental.

### Mapeamento JS → TS

| Arquivo JS | Destino TS | Linhas |
|---|---|---|
| `storage.js` | `core/storage.ts` | ~700 |
| `auth.js` | `core/auth.ts` | 57 |
| `search.js` | `core/filters.ts` | ~190 |
| `calendario_page.js` | `features/calendario/calendario.ts` | ~480 |
| `salas.js` / `turmas.js` / `reservas.js` / `disponibilidade.js` / `dashboard_page.js` | `features/dashboard/*` | — |
| `index_page.js` | `features/home/home.ts` | — |
| `login_page.js` | `features/login/login.ts` | — |
| `admin_page.js` | `features/admin/admin.ts` | 404 |
| `coordenador_page.js` | `features/coordenador/coordenador.ts` | ~1837 |
| `instrutor_page.js` | `features/instrutor/instrutor.ts` | ~700 |
| `recepcao_page.js` | `features/recepcao/recepcao.ts` | ~800 |

**Camadas novas:** `core/{api,dom,format,globals,refresh,theme,ui}.ts`,
`entry/` (7 inicializadores), `types/index.ts`, `vite-env.d.ts`.

**Configuração:**

- `tsconfig.json` — `strict: true`, `noImplicitAny`, `strictNullChecks`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `forceConsistentCasingInFileNames`, `isolatedModules`.
  `noUnusedLocals` / `noUnusedParameters` **desligados** (pendência documentada).
- `vite.config.ts` — `base: './'`, `publicDir: 'public'`, `outDir: 'dist'`,
  `target: 'es2020'`, 7 inputs (um por página HTML).
- `package.json` — `conecta-senac-web`, `"type": "module"`, scripts
  `dev` / `build` (= `typecheck` + `vite build`) / `build:somente-bundle` /
  `preview` / `typecheck`.

### Mecanismo dos handlers inline

Os 7 HTML **não** foram reescritos. Cada `src/entry/<página>.ts` reproduz a
ordem exata dos `<script>` clássicos e republica os módulos em `window` via
`installGlobals(...)` (`core/globals.ts` → `Object.assign(window, ns)`), de modo
que os atributos `onclick="..."` continuam funcionando de forma idêntica aos
scripts clássicos.

### Renomeação de nomenclatura

`web/src/features/coordinator/` → **`web/src/features/coordenador/`**
(`git mv`), alinhando o web ao mobile, que já usa `src/app/coordenador/`.
Nenhum arquivo em inglês permaneceu no repositório.

---

## 4. Bugs corrigidos

| ID | Defeito | Correção |
|---|---|---|
| **D1** | `server/index.js`: `WEB_ROOT` apontava para pasta inexistente → `GET /` dava 404 | Apontado para `web/dist` |
| **D9** | `dashboard.html`: `onclick="logout()"` sem função definida em lugar nenhum | Trocado para `onclick="sair()"` |
| **D10** | Painel do coordenador chamava `verificarConflito` de `reservas.js`, que `coordenador.html` **não carrega** — conflito de reserva **nunca** era detectado | Import único da regra (`features/dashboard/reservas.ts`) |
| **D12** | `fetch` sem timeout congelava a aplicação quando a API não respondia | `AbortController` + `API_TIMEOUT_MS = 12_000` |
| **D13** | `modalFechar` ausente em `coordenador.html`, `instrutor.html` e `recepcao.html` | `core/ui` adicionado ao `installGlobals` desses 3 entries |
| **D14** | `mostrarSecao` ausente no `dashboard.html` | Namespace `dashboard` inteiro publicado no `installGlobals` |
| — | `admin.ts`: `BADGE_PERFIL` usava a chave `coordinator` (inglês), que **nunca casava** com `Perfil` — todo coordenador caía no fallback `bdg-muted` | Corrigido para `coordenador` |
| — | `DadosController.java`: palavra chinesa `快照` ("Snapshot") no Javadoc | Substituída por `Snapshot` |
| — | `mobile/src/constants/assets.ts`: `require` apontava para `../../frontend_reserva_salas/img/senac-logo-sem-fundo.webp`, caminho inexistente desde a reorganização | Imagem copiada para `mobile/assets/` e `require` repontado |
| — | `SincController.salvar()` **perdia dados**: `POST /api/sinc` não repunha `turnos`, `turnosDisponiveis`, `statusManual`, `motivoManual`, `manualPor`, `manualCriadaEm`, `ativa` (salas) nem `horaInicio`, `horaFim`, `avulsa` (reservas) | **Não corrigido** — ver pendência #1 |

---

## 5. Código morto removido

**Arquivos inteiros:**

- 6 JS de uma SPA antiga (`script.js`, `admin.js`, `coordenador.js`,
  `instrutor.js`, `recepcao.js`, `supabase.js`) — zero referências.
- `supabase.js` — módulo ESM que injetava URL e chave publicavel do Supabase (`chave-publicavel-do-supabase` + token)
  hardcoded e cujo export `supabase` **não era consumido** por nada.
- `css/style.css` (30 KB) — não importado por nenhum HTML nem por `main.css`.
- `css/index.css` — cópia antiga de `landing.css`.
- `static_js_check.py`, `tsc-output.txt`.
- Gradle wrapper órfão dentro de `web/`.
- `node_modules/` versionado (889 arquivos).
- `package.json` raiz com dependências órfãs (`@supabase/ssr`,
  `@supabase/supabase-js`).
- `.idea/`, `.vscode/` da raiz.

**Dentro do TypeScript:**

- **9 monkey-patches** nos quais a versão original da função ficava inalcançável
  (sobrescrita antes de ser chamada).
- `_dataLiberacaoPorTurnos` (função nunca chamada).
- 2 `labelStatus` duplicados.
- `rdMapaDebounced` (timer nunca agendado).
- 4 helpers mortos de `dashboard_page.js`.

**Preservado deliberadamente:**

- O wrapper de `toggleTema` da landing — o entry expõe
  `window.toggleTema = alternarTema`, que redesenha o ícone (monkey-patch do
  legado).
- `devolverChave()` zerando `instrutorId` / `pegaEm` — perda de histórico de
  movimentações, comportamento pré-existente.
- `delTurma()` removendo em cascata as reservas vinculadas no cliente.

---

## 6. Unificação de contratos web↔mobile↔Java

### Tabela comparativa (principais divergências corrigidas)

| Campo | Antes (mobile ↔ web) | Depois | Referência |
|---|---|---|---|
| `Unidade.cep/cidade/endereco` | obrigatórios ↔ `string?` | ambos `string?` | Java: colunas nullable |
| `Sala.ativa` | ausente ↔ `ativa?: boolean` | ambos têm | Java: `boolean ativa = true` |
| `Sala.turnos` | ausente ↔ `turnos?: Turno[]` | ambos têm | Tabela `sala_turnos_legado` |
| `Sala.turnosDisponiveis` | obrigatória ↔ opcional | obrigatória | Java: `@ElementCollection(EAGER)` |
| `Reserva.status` | `status?: string` ↔ `StatusReserva \| string` | ambos `StatusReserva \| string` | Java: `String` |
| `Notificacao.paraPerfil` | `string` ↔ `Perfil \| string \| null` | ambos `string \| null` | Java: `String` |
| `Notificacao.mensagem` | ausente ↔ `mensagem?` | ambos têm | **LEGADO** — não existe no Java |
| `Solicitacao.status` | `StatusSolic` ↔ `StatusSolicitacao` | unificado (`StatusSolic` = alias) | Java: enum |
| `StatusManualSala` vs `StatusSala` | alias ↔ literal duplicado idêntico | alias em ambos | Java: `String` |
| `ModoData` vs `ModoDataSolicitacao` | — | unificado → alias | Java: `String modo` |
| `Usuario.senha` | obrigatória ↔ opcional | obrigatória | Java: `@NotBlank NOT NULL` |
| DTOs Java (5 `record`) | inexistentes no mobile | declarados no `web` | `dto/` |
| `EstadoCalendario` | só no mobile | adicionado ao web | — |

**Unificações confirmadas como já corretas:** `Perfil`
(`'admin'|'coordenador'|'instrutor'|'recepcao'`), `StatusChave`
(`'disponivel'|'pega'`) e `StatusSolicitacao` (`'pendente'|'aprovada'|'recusada'`)
estavam byte-idênticos nos dois arquivos.

`mobile/src/types/type.ts` **deletado** — duplicado incompatível
(`id: string`, `unidadeId: string`) e não importado por nenhum arquivo.

**Formas CRUD** (`Novo*` / `Nova*` / `Atualizar<T>`) adicionadas ao mobile.

---

## 7. Endurecimento de tipagem do `web/src/core/`

| Métrica | Antes | Depois |
|---|---|---|
| `\bany\b` em `web/src/**` | — | **0** |
| `\bany\b` em `mobile/src/**` | — | **0** |
| `as unknown as Record<string, unknown>` | 5 | **0** |

- `core/globals.ts` — 4 acessos com cast longo → **1 cast por função** via
  `interface JanelaGlobalizada { [nome: string]: unknown; }` e
  `lerGlobal(name)`.
  - *Nota:* `extends Window` **não compilava* (TS2352 — o index signature
    `unknown` conflita com propriedades já tipadas de `Window`).
- `core/api.ts` — cast eliminado; leitura direta de
  `window.__CONECTA_API_BASE__` (declarado em `declare global`).
- `core/storage.ts` (26 KB) — já estava 100% tipado; todas as funções exportadas
  com parâmetro e retorno explícitos.
- `Object.assign(window, ns)` mantido em `globals.ts` (mecanismo dos 145
  handlers inline).

---

## 8. Ajustes estruturais

1. `web/src/features/coordinator/` → `web/src/features/coordenador/`
   (`git mv`), com todos os imports atualizados.
2. `.vscode` / `.idea` removidos do índice do Git e do disco.
3. `.gitignore` de IDE em todos os subprojetos.
4. `.gitattributes` na raiz (LF) e em `backend/demo/`.
5. `Dockerfile` multi-stage na raiz — imagem única API + web, com injeção de
   `web/dist` em `BOOT-INF/classes/static/` do jar (sem alterar uma linha do
   backend).
6. `compose.yaml` na raiz com 3 serviços (`postgres`, `api`, `server`).
7. `.dockerignore` ajustado (`web` removido da lista de exclusão).
8. Sentinela `same-origin` em `web/src/core/api.ts` — o Vite **descarta**
   variáveis de ambiente com valor `""` (`import.meta.env` vira `{}`), então foi
   necessário um token não vazio.
9. `backend/demo/gradlew.bat` criado (73 linhas, Gradle 9.5.1).
10. `scripts/padronizar-monorepo.ps1` (verificação idempotente, 7 seções) e
    `scripts/limpar-git.sh` (3 modos, não executado — reescrita de histórico é
    irreversível).

---

## 9. Refatoração do backend Spring Boot

### Consolidação do CORS

`config/CorsConfig.java` **removido**. Ambos os arquivos registravam a **mesma**
mapping `/api/**`; no `WebMvcConfigurerComposite` o segundo sobrescrevia o
primeiro, logo a configuração **efetiva** era a de `WebConfig` (com
`allowedHeaders("*")`). `WebConfig.java` consolidado preserva exatamente essa
configuração efetiva.

### Services novos (`service/`)

| Service | Responsabilidade |
|---|---|
| `AuthService` | Login (envelope `{"usuario": ...}`), sessão única (`ID_SESSAO_UNICA = 1L`), logout |
| `DadosService` | `banco()` — fonte única dos 8 `findAll()` (eliminou duplicação entre `DadosController` e `SincController.banco()`) |
| `NotificacaoService` | `listar(paraId)` e `marcarLida(id)` |
| `SincService` | `sincronizar(map)` e `resetar()`, com `@Transactional` no service (limite transacional equivalente) |

### Controllers reescritos

Endpoint, verbo e corpo **idênticos** aos originais:

| Controller | Antes | Depois |
|---|---|---|
| `AuthController` | — | 29 linhas |
| `DadosController` | — | 25 linhas |
| `NotificacaoController` | — | 35 linhas |
| `SincController` | 381 linhas | 54 linhas |

### `SalaService` — isolamento de unidade

- `atualizar(Long id, Long usuarioId, Sala entrada)` — o id do usuário passou a
  ser informado pelo chamador via **parâmetro de método** (o controller recebe
  do cabeçalho `X-Usuario-Id`), pois o backend **não possui filtro de
  autenticação** de onde lê-lo de forma implícita.
- Nova regra: só é permitido alterar salas da **própria unidade** do usuário.
  Caso contrário → `AcessoNegadoException` → **HTTP 403**.
- `exigirMesmaUnidade()` valida também `usuarioId == null` e usuário inexistente.

### `SolicitacaoController` — Location header

`criar()` passou a devolver `ResponseEntity<Solicitacao>` com
`ResponseEntity.created(location)`, satisfazendo **201 + `Location`** (o corpo
permanece idêntico).

### Nova exceção

`AcessoNegadoException` (em `exception/`) → mapeada para **403** em
`ApiExceptionHandler`, com corpo `{"erro": <mensagem>}` (mesmo padrão dos
demais handlers).

---

## 10. Modo Mock vs. Modo Produção

Isolamento de `server/data/` (o servidor Node) com variáveis de ambiente
documentadas em `.env.example`:

### Web (`web/src/core/api.ts` + `web/src/types/vite-env.d.ts`)

Ordem de resolução da **base da API**:
1. `window.__CONECTA_API_BASE__` (runtime)
2. `VITE_API_BASE` (build) — aceita o token `same-origin`
3. `https://conecta-senac.onrender.com` (produção)

Ordem de resolução do **modo**:
1. `window.__CONECTA_MODO_API__`
2. `VITE_MODO_API` (`'mock'` | `'producao'`)
3. Inferência: base em loopback/IP privado → `mock`; host público → `producao`

Extras: `VITE_API_TIMEOUT_MS` (valores ≤ 0 → 12 000 ms).

### Mobile (`mobile/src/services/api.ts` + `app.json`)

1. `extra.apiUrl` / `extra.modoApi` no `app.json`
2. `process.env.EXPO_PUBLIC_API_URL` / `process.env.EXPO_PUBLIC_MODO_API`
3. Inferência por host privado (loopback/`.local` + RFC 1918)

**Justificativa:** `server/data/db.json` permanece **versionado** no repositório
para que o primeiro arranque do servidor Node funcione sem seed externo — por
isso o modo `mock` é o padrão em ambiente de desenvolvimento.

---

## 11. Higiene do monorepo

- **3 das 4 premissas originais estavam erradas:**
  1. `mobile/src/constants/assets.ts` **não** estava vazio nem sem uso —
     exporta `Assets.senacLogo`, usado em **3 tags `<Image>`**. Apagar
     quebraria o build em 2 arquivos.
  2. `backend/demo/gradlew.bat` **estava** ausente (só `gradlew`).
  3. `server/` **não** é legado — é o backend que web e mobile usam de fato.
- `.git` pesava 4,93 MB contra 1,74 MB de working tree: **676 objetos
  alcançáveis** de `node_modules` (651), `.idea` (17), `.vscode` (5),
  `Conecta-Senac-main/.../.vscode` (3). `git gc --prune` **não** resolve — só
  apaga inalcançáveis; é necessário `git filter-repo` (`scripts/limpar-git.sh`).
- ZIP de entrega gerado: `Conecta-Senac-Atualizado.zip` (5,50 MB, 462
  entradas, sem `node_modules`).

---

## 12. Migração de eventos inline para `data-action`

`core/globals.ts` (`Object.assign(window, ns)`) **eliminado**. Toda a ligação
HTML↔TS passou a usar um registro de ações tipado + **delegação de eventos**.

| Antes | Depois |
|---|---|
| `onclick="editarSala(5)"` | `data-action="editarSala" data-arg="5"` |
| `onclick="return atualizarSecao('rdSalas', this)"` | `data-action="atualizarSecao" data-arg="rdSalas"` |
| `onclick="_editReservaId=null;modalFechar('modalRes')"` | `data-action="cancelarEdicaoReserva"` |
| `onchange="calFiltrar()"` | `data-change="calFiltrar"` |
| `oninput="rdMapa()"` | `data-input="rdMapa"` |

**Escopo:** 145/145 atributos convertidos nos 7 HTML + 33 em template strings
TS. Handlers inline residuais: **0**.

**Arquivos novos:**

- `core/actions.ts` — registro tipado (`registrarAcao`, `registrarAcoes`,
  `temAcao`, `obterAcao`, `contextoSemAlvo`, `executarAcao`,
  `instalarDelegacao`) e `ContextoAcao` (`alvo`, `arg`, `arg2`, `arg3`, `num`,
  `botao`, `campo`, `seletor`, `evento`).
- `core/acoes-comuns.ts` — ações compartilhadas entre páginas.
- `core/dom.ts` — 4 APIs novas: `dadoDe`, `delegar` (1 listener na raiz),
  `asButton` / `asInput` / `asSelect` / `asAnchor` (narrowing por
  `instanceof`).

**Ganho líquido:** 34 das ~60 nomes globais *não precisavam* existir — o TS já
os importava diretamente.

**Regressões encontradas e corrigidas durante a migração:**

1. `data-arg` gerado em template strings saía **sem a aspa de fechamento**
   (`data-arg="1&gt;">Editar`) — o parser HTML consumia o HTML seguinte e os
   IDs viravam lixo. Corrigido em `admin.ts`, `coordenador.ts`, `recepcao.ts`.
2. `data-action="atualizarSecao"` no admin dependia de `rdUsuarios`,
   `rdUnidades`, etc., que estavam **privadas** — re-exportadas.

---

## 13. Padronização web ↔ mobile

### Regra de ocupação de salas

`web/src/features/dashboard/disponibilidade.ts` e `mobile/src/utils/salaStatus.ts`
passaram a aplicar **exatamente a mesma regra**:

```
classificarReserva(r, hoje, dia):
  r.status !== 'ATIVA'                          -> null
  dataInicio > hoje || dataFim < hoje            -> null
  !(r.diasSemana ?? []).includes(dia)            -> null
  avulsa || !turmaId                            -> OCUPADA ("Sem turma")
  calcStatus(turma) == 'encerrada'              -> null
  calcStatus(turma) == 'ativa'                  -> OCUPADA
  senao                                          -> IMINENTE
```

Saídas unificadas: **LIVRE** / **OCUPADA** / **EM BREVE**.

**Bug real corrigido no mobile:** o legado **não** filtrava
`status === 'ATIVA'` — uma reserva `CANCELADA` ainda marcava a sala como
ocupada.

**Filtro por unidade:** `popularSelectDispSalas()` no web passou a filtrar por
`getSessao()?.unidadeId` (sem sessão → lista completa, como no legado).

---

## 14. Testes automatizados e CI

### Testes JUnit 5 criados (`backend/demo/src/test/java/conecta/demo/`)

| Arquivo | Tipo | O que cobre |
|---|---|---|
| `EntidadesTest.java` | JUnit 5 puro + reflexão | As 12 entidades declaram exatamente os campos esperados; enums `Perfil`, `StatusChave`, `StatusSolicitacao` com os valores corretos |
| `DadosServiceTest.java` | JUnit 5 + Mockito | `banco()` devolve mapa com as 8 coleções; cada repositorio consultado 1× com `findAll()`; `sessao`/`ultimaSinc` ausentes |
| `SolicitacaoServiceTest.java` | JUnit 5 + Mockito | Criar com unidade compatível (salva) / divergente do instrutor (409) / divergente da sala (409) / sala inexistente (404); `listar` nos 3 modos; `responder` (aprovada/recusada/inválida/já respondida/sem turnos) |
| `SalaServiceTest.java` | JUnit 5 + Mockito | Criar (unidade existente/inexistente); `listar`; `buscar`; **atualizar** (mesma unidade 200 / outra unidade 403 / sem usuário 403 / usuário inexistente 404 / sala inexistente 404); `excluir` |
| `SalaControllerTest.java` | MockMvc standalone | `POST /api/salas` → 201; `PUT /api/salas/{id}` → 200 (mesma unidade), **403** (outra unidade), 403 (sem cabeçalho) |
| `SolicitacaoControllerTest.java` | MockMvc standalone | `POST /api/solicitacoes` → **201 + `Location`**; 409 (unidade divergente); 404 (sala inexistente); `GET /api/solicitacoes`; `GET /api/solicitacoes/{id}` |

**Convenção:** os testes de controller usam
`MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new ApiExceptionHandler())`
— o MockMvc completo (status, corpo e mapeamento de exceções) **sem subir o
contexto do Spring e sem tocar no banco**, conforme permitido pelo briefing.

### Infraestrutura

| Arquivo | Conteúdo |
|---|---|
| `.github/workflows/ci.yml` | 3 jobs: `backend` (JDK 21, `./gradlew test` + `bootJar`, upload do artefato), `web` (Node 20, `npm ci` + `npm run build`), `mobile` (Node 20, `npm ci` + `npm run typecheck`) |
| `backend/demo/Dockerfile` | Multi-stage `gradle:jdk21` → `eclipse-temurin:21-jre-alpine` |
| `backend/demo/compose.yml` | Postgres 16 + API, com healthcheck e `SPRING_DATASOURCE_URL` sobrescrito |
| `backend/demo/src/test/resources/application.properties` | Override com **H2 em memória** (`MODE=PostgreSQL`) — os testes não podem depender do Supabase |
| `backend/demo/build.gradle` | Já continha `spring-boot-starter-test` (JUnit 5, AssertJ, Mockito, Spring Test), `spring-boot-starter-webmvc-test` e `useJUnitPlatform()` — nenhuma alteração necessária |

### Exemplo: rodando os testes

```bash
# Unitários + slice de MockMvc (H2 em memória, sem rede)
cd backend/demo
./gradlew test --no-daemon --console=plain

# Ou com Postgres local via Compose
docker compose -f backend/demo/compose.yml up -d --build
docker compose -f backend/demo/compose.yml exec api ./gradlew test --no-daemon
```

### Exemplo: CI

```bash
git push origin main
# GitHub Actions executa backend + web + mobile automaticamente
```

---

## 15. Pendências conhecidas

| # | Pendência | Impacto |
|---|---|---|
| 1 | **`SincService.salvar()` perde dados** — `POST /api/sinc` não repõe `turnos`, `turnosDisponiveis`, `statusManual`, `motivoManual`, `manualPor`, `manualCriadaEm`, `ativa` (salas) nem `horaInicio`, `horaFim`, `avulsa` (reservas) | Perda silenciosa de dados na sincronização |
| 2 | Senhas em texto puro (`usuarios.senha`) | Vazamento em caso de acesso indevido ao banco |
| 3 | CORS `allowedOrigins("*")` sem autenticação | Qualquer origem pode chamar a API |
| 4 | Geração de id manual `max(id)+1` | Race condition sob concorrência |
| 5 | `horaInicio` / `horaFim` ignorados na detecção de conflito | Reservas sobrepostas no mesmo turno |
| 6 | `delUnidade` não valida referências | Orfãos em `salas`/`turmas`/`usuarios` |
| 7 | `Sala.turnos` duplicado (`sala_turnos` + `sala_turnos_legado`) | Duplicação de informação |
| 8 | Não registra quem decidiu a solicitação (`coordenador_id` não existe) | Auditoria impossível |
| 9 | Backend Spring não é consumido por nenhum frontend | Dois backends divergentes |
| 10 | `noUnusedLocals` / `noUnusedParameters` desligados no `web/tsconfig.json` | Código morto potencial não detectado pelo compilador |
| 11 | `mobile/src/components/SalaCard.tsx` e `calcSalaInfo()` **não são importados** por nada (componente morto) | Código órfão |
| 12 | `.git` com 676 objetos alcançáveis de `node_modules`/IDE | Repositório pesado; requer `git filter-repo` |
| 13 | Backend Java não compilado localmente (JDK 11 disponível; projeto exige JDK 21) | Validação estática apenas |

---

## 16. Como executar

### Requisitos

- Node.js 20+, npm 10+
- JDK 21 (para o backend)
- Docker + Docker Compose (opcional)

### 1. Subir o servidor de dados (Node, porta 3333)

```bash
node server/index.js
```

### 2. Frontend web (porta 5173)

```bash
cd web
npm ci
npm run dev
# ou: npm run build && npm run preview
```

### 3. Frontend mobile

```bash
cd mobile
npm ci
npm start        # ou: npm run android / ios / web
```

### 4. Backend Java (opcional)

```bash
cd backend/demo
./gradlew bootRun          # ou: ./gradlew test
# ou via Docker:
docker build -f Dockerfile -t conecta-api .
docker run --rm -p 8081:8081 --env-file .env conecta-api
```

### 5. Testes do backend

```bash
cd backend/demo
./gradlew test --no-daemon --console=plain
```

### Credenciais de teste (seed, unidade 1001)

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | `Senac_GDF@Hotmail.com` | `Senac.DF2007` |
| Coordenador | `coord.asanorte@senacdf.com` | `Coord@123` |
| Instrutor | `katia.barros@senacdf.com` | `Inst@123` |
| Recepção | `recep.asanorte@senacdf.com` | `Recep@123` |

---

## Anexos

- `docs/ARQUITETURA_ATUALIZADA.md` — arquitetura detalhada, mapa de
  rastreabilidade e modo Mock vs. Produção.
- `docs/CASO_DE_USO.md` — casos de uso originais.
- `docs/DOCUMENTACAO_CONEXAO_WEB_MOBILE.md` — sincronização web↔mobile.
- `.env.example` — variáveis de ambiente documentadas.
- `scripts/padronizar-monorepo.ps1` — verificação de higiene (idempotente).
- `scripts/limpar-git.sh` — expurga de histórico (`--dry-run` por padrão).
