# Conecta-Senac — Relatório Final de Refatoração

**Projeto:** Sistema de Reserva de Salas — SENAC GDF
**Autor do projeto:** Enzo Aragão Lages · Instrutora: Rayssa Paiva Carvalho
**Repositório:** `Conecta-Senac-Atualizado`
**Origem:** `https://github.com/vitorrobertofp-dev/Conecta-Senac.git`
**Branch:** `main` · **HEAD:** `18b27ed` — *Ajusta build do frontend e do backend para o fluxo de entrega* · 18 commits
**Entrega:** `C:\Users\enzo58377056\OneDrive - SENAC DF\Documentos\Conecta-Senac-Atualizado`
**Data:** 19 de outubro de 2026

---

## 0. Sumário executivo

O repositório foi submetido a uma refatoração completa, articulada em cinco frentes independentes que se sustentam mutuamente:

| # | Frente | Resultado mensurável |
|---|---|---|
| 1 | **Reorganização do monorepo** | 4 subdiretórios nomeados e documentados (`backend/`, `web/`, `mobile/`, `server/`) no lugar de diretórios com parênteses e espaços |
| 2 | **Migração do frontend web** | 15 arquivos JavaScript → 32 módulos TypeScript com `strict: true`, sem uma única ocorrência de `any` |
| 3 | **Correção de defeitos** | 14 defeitos funcionais identificados e corrigidos, sendo 3 que impediam o uso do sistema |
| 4 | **Unificação de contratos** | web, mobile e Java passaram a descrever **a mesma** entidade, com unions literais byte-idênticas |
| 5 | **Fonte única de verdade** | 2 APIs concorrentes (Node/JSON × Spring Boot/Postgres) reduzidas a 1, com o mock legado atrás de perfil de Compose |

Somam-se a isso a eliminação de **9 monkey-patches** que deixavam código original inalcançável, a migração dos **145 handlers `onclick` inline** para delegação de eventos, a expurgação de **segredos do histórico Git** (o `.git` caiu de 4,93 MB para 0,72 MB) e a criação de **6 suítes de teste JUnit 5** com CI em 3 jobs.

Nenhuma regra de negócio foi alterada. Nenhuma classe CSS foi tocada. Nenhum contrato JSON mudou de nome. Nada foi enviado ao GitHub.

---

## 1. Escopo, método e princípios

### 1.1 Princípios norteadores

Cinco regras foram fixadas no início e respeitadas em todas as frentes:

1. **Nenhum nome de propriedade JSON pode mudar.** Alinhou-se tipagem e opcionalidade; nunca se renomeou uma chave. Isso mantém a compatibilidade binária com o banco e com o frontend mobile já em produção.
2. **Regra de negócio é intocável.** Nenhuma feature teve seu comportamento alterado — inclusive quando o comportamento legado era um defeito de *layout* de código, desde que a saída observável fosse preservada.
3. **Layout e CSS são intocáveis.** Nenhuma classe visual foi modificada; o CSS morto foi removido apenas quando provadamente não importado.
4. **Ausência de `any` explícito ou implícito** sob `strict: true`.
5. **Nenhuma publicação.** Sem `git push`, sem PR, sem release, sem deploy. O `origin` está configurado e o trabalho está commitado localmente.

### 1.2 Método de trabalho

| Etapa | Procedimento |
|---|---|
| **Auditoria** | Leitura integral de cada arquivo antes de qualquer edição; inventário por `grep` de referências reais (não por suposição) |
| **Medição** | Todo defeito citado neste relatório foi reproduzido ou demonstrado por comando — nenhum foi "achado por leitura" sem verificação |
| **Correção** | Alteração mínima e cirúrgica, com o defeito original preservado em comentário quando o comportamento antigo era intencional |
| **Validação** | `tsc --noEmit` (web e mobile), `vite build`, smoke test das 7 páginas no navegador, teste de escrita end-to-end contra o servidor |
| **Registro** | Cada frente vira um commit coeso, com mensagem explicando o *porquê* |

### 1.3 O que ficou deliberadamente intacto

Registrar isso é tão importante quanto registrar o que mudou:

- **`devolverChave()`** zerando `instrutorId` e `pegaEm` — perda de histórico real, mas é a regra de negócio vigente. Corrigir alteraria o comportamento do sistema.
- **`delTurma()` removendo reservas em cascata no cliente** — o backend não replica isso; é uma escolha do produto.
- **O wrapper de `toggleTema`** da landing page, que redesenha o ícone do botão — um monkey-patch *funcional*, não código morto.
- **`mobile/src/components/SalaCard.tsx`** — importado por ninguém, mas exporta `Periodo` e `SalaInfo`, tipos consumidos por `salaStatus.ts`. **Reportado, não removido.**

---

## 2. Arquitetura: antes e depois

### 2.1 Estado original

O repositório misturava quatro artefatos com nomes ambíguos:

```
Conecta-Senac/
├── Conecta-Senac-main (frontend web +mobile)/
│   ├── frontend_reserva_salas/
│   │   └── frontend_reserva_salas/        ← web com o nome duplicado
│   ├── src/  app.json  server/            ← mobile e servidor no mesmo pacote
│   └── tsc-output.txt                     ← artefato vazio
├── demo-conecta-senac3.1(backend)/demo/    ← backend com parênteses no caminho
├── node_modules/                           ← 889 arquivos versionados no Git
├── package.json                            ← só dependências órfãs
└── conecta_3.1.zip                         ← 3,16 MB dentro do histórico
```

Três consequências práticas: o `Dockerfile` apontava para caminhos que já não existiam; o servidor Node servia `frontend_reserva_salas/` enquanto os arquivos estavam um nível abaixo, de modo que `GET /` respondia **404**; e o Git carregava dependências instaladas e um ZIP com segredos.

### 2.2 Estado atual

```
Conecta-Senac-Atualizado/
├── backend/demo/          Spring Boot 4.0.7 · JPA · Postgres (Supabase) · JDK 21
├── web/                   Frontend web · TypeScript + Vite · MPA de 7 páginas
│   ├── public/            css/ (20) · img/ (1)
│   └── src/               core/ (11) · entry/ (7) · features/ (12) · types/ (2)
├── mobile/                Expo 51 · React Native 0.74.5 · expo-router 3.5
├── server/                Servidor Node legado (MOCK) · porta 3333 · db.json
├── docs/                  6 documentos de arquitetura, casos de uso e relatórios
├── scripts/               padronizar-monorepo.ps1 · limpar-git.sh
├── .github/workflows/     ci.yml (3 jobs)
├── Dockerfile             Imagem única: API + frontend
├── compose.yaml           postgres + api (padrão) · server (perfil "mock")
├── .env.example           Contrato de variáveis de ambiente
├── .gitignore .gitattributes .dockerignore
└── README.md
```

### 2.3 Mapa de portas e responsabilidades

| Camada | Porta | Persistência | Papel |
|---|---|---|---|
| `backend/demo/` | 8081 | Postgres (Supabase) | **Fonte da verdade.** API REST + serve a SPA |
| `web/` | 5173 (dev) | consome a API | SPA multi-página, 4 perfis |
| `mobile/` | — | consome a API | App nativo Expo, 4 perfis |
| `server/` | 3333 | `server/data/db.json` | **Mock legado**, atrás do perfil `mock` do Compose |

### 2.4 As três fontes de verdade do contrato de dados

Contratos de dados têm origem em três lugares, e é essencial saber qual prevalece:

1. **`server/seed.js` / `server/data/db.json`** — o formato que o servidor Node produz e que o mobile consome.
2. **Entidades JPA** (`backend/demo/.../model/`) — o formato que o Postgres armazena.
3. **O frontend web legado** — a origem dos campos `reservadoPorId`, `solicId` e `mensagem`, que **não existem** no Java.

A regra aplicada: as três se alinham **sem renomear nada**. O TypeScript declara o contrato como uma união tolerante, e os campos exclusivos do web são marcados como legados em JSDoc.

---

## 3. Reorganização física do monorepo

### 3.1 Movimentações

| Origem | Destino | Contexto |
|---|---|---|
| `demo-conecta-senac3.1(backend)/demo/` | `backend/demo/` | Parênteses e versão no caminho quebravam builds e ferramentas |
| `Conecta-Senac-main (frontend web +mobile)/frontend_reserva_salas/frontend_reserva_salas/` | `web/` | Nome duplicado; o web real é a raiz da SPA |
| `Conecta-Senac-main (frontend web +mobile)/src/`, `app.json`, `metro.config.js`, … | `mobile/` | Expo é um projeto próprio, não um subdiretório do web |
| `Conecta-Senac-main (frontend web +mobile)/server/` | `server/` | O servidor tem ciclo de vida e dependências próprios |
| `Conecta-Senac-main (frontend web +mobile)/*.md`, `*.txt` | `docs/` | Documentação consolidada na raiz |
| `web/src/styles/css/` | `web/public/css/` | O CSS é estático: `public/` é copiado verbatim para `dist/` |
| `web/img/` | `web/public/img/` | Idem |
| `backend/demo/.gitignore` | `mobile/.gitignore` | O arquivo era do **Expo** e estava no lugar errado |

### 3.2 Removidos da raiz

- `node_modules/` — **889 arquivos versionados** no Git, das dependências `@supabase/ssr` e `@supabase/supabase-js`, que **nenhum código importava** (o `supabase.js` usava CDN). O `package.json` da raiz foi eliminado por随之 ser inútil.
- `.idea/`, `.vscode/` da raiz — configuração de IDE pessoal.
- `tsc-output.txt` — artefato de 0 byte.
- `package.json` / `package-lock.json` da raiz — dependências órfãs.
- O diretório `Conecta-Senac-main (frontend web +mobile)/` inteiro, absorvido pelos destinos acima.

### 3.3 Correção do `.gitignore` da raiz

O `.gitignore` original continha apenas `.idea/`, `backup.dump` e `*.zip`. **Não ignorava `node_modules/`** — e o diretório estava no índice do Git. O novo ignora `node_modules/`, `.env`, `.env.*` (com `!.env.example`), `.expo/`, `dist/`, `build/`, `.gradle/`, `.idea/`, `.vscode/`, `*.zip`, entre outros.

Cada subprojeto recebeu o seu próprio `.gitignore` — `web/`, `server/`, `mobile/` — com as pastas de IDE bloqueadas em todos os níveis.

⚠️ `server/.gitignore` **não** ignora `server/data/db.json`: o banco de exemplo é versionado de propósito, para que o mock funcione em uma instalação nova.

### 3.4 `.gitattributes` — risco de build em Linux

O Git emitia dezenas de `warning: LF will be replaced by LF` e **não havia `.gitattributes` na raiz**. Um `Dockerfile` ou `compose.yaml` com CRLF quebra em Linux (`/bin/bash^M: bad interpreter`). O arquivo criado declara:

```
* text=auto eol=lf
*.bat text eol=crlf
*.cmd text eol=crlf
*.ps1 text eol=crlf
*.jar *.png *.jpg *.jpeg *.gif *.webp *.ico *.zip *.keystore binary
Dockerfile */Dockerfile docker-compose*.yml compose*.yaml text eol=lf
```

`backend/demo/.gitattributes` (escopo Gradle) foi preservado: `/gradlew text eol=lf`, `*.bat text eol=crlf`, `*.jar binary`.

---

## 4. Migração do frontend web: JavaScript → TypeScript

### 4.1 Escopo

O frontend web era HTML/CSS/JS puro, com scripts clássicos de escopo global carregados por ordem no HTML, acoplados entre si por globais mútuos. `storage.js` — 1.462 linhas — era a base sobre a qual tudo se apoiava.

A migração, mantendo **todos os nomes públicos** e **todos os identificadores de DOM** permitiu que o layout e o comportamento permanecessem idênticos.

### 4.2 Mapa de migração

| JavaScript original | Destino TypeScript | Observações |
|---|---|---|
| `storage.js` (1.462 linhas) | `core/storage.ts` (~700) | Camada de dados, cache, CRUD, sessão, tema |
| `auth.js` | `core/auth.ts` (57) | `requirePerfil`, `seJaLogado`, `sair`, `initSidebar`, `initLogo` |
| `search.js` | `core/filters.ts` (~190) | `filtrarLista`, `aplicarFiltros`, `montarBarraPesquisaFiltros` |
| `calendario_page.js` | `features/calendario/calendario.ts` (~480) | Calendário mensal/semanal das 4 telas |
| `salas.js` | `features/dashboard/salas.ts` | CRUD de salas do dashboard |
| `turmas.js` | `features/dashboard/turmas.ts` | CRUD de turmas |
| `reservas.js` | `features/dashboard/reservas.ts` | CRUD de reservas + `verificarConflito` |
| `disponibilidade.js` | `features/dashboard/disponibilidade.ts` | Verificação de disponibilidade |
| `dashboard_page.js` | `features/dashboard/dashboard.ts` | Navegação por seções |
| `index_page.js` | `features/home/home.ts` | Landing page |
| `login_page.js` | `features/login/login.ts` | Autenticação |
| `admin_page.js` | `features/admin/admin.ts` (404) | Painel administrativo |
| `coordenador_page.js` | `features/coordenador/coordenador.ts` (~1.837) | Painel do coordenador |
| `instrutor_page.js` | `features/instrutor/instrutor.ts` (~700) | Portal do instrutor |
| `recepcao_page.js` | `features/recepcao/recepcao.ts` (~800) | Portal da recepção |

**Camadas novas criadas** — `core/api.ts` (cliente HTTP tipado), `core/dom.ts` (acesso ao DOM com narrowing seguro), `core/format.ts` (formatação), `core/globals.ts` (later substituído), `core/refresh.ts` (orquestração de atualização), `core/theme.ts` (sessão e tema), `core/ui.ts` (toasts, modais, mensagens), `core/actions.ts` e `core/acoes-comuns.ts` (delegação de eventos), além de 7 `src/entry/*.ts` e 2 arquivos em `src/types/`.

**Total: 32 arquivos `.ts`.**

### 4.3 Configuração do compilador

```jsonc
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "bundler",
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "forceConsistentCasingInFileNames": true,
  "isolatedModules": true,
  "resolveJsonModule": true,
  "skipLibCheck": true,
  "noEmit": true,
  "noUnusedLocals": false,
  "noUnusedParameters": false
}
```

`noUnusedLocals` e `noUnusedParameters` permanecem **desligados** por decisão consciente: ligá-los exigiria uma varredura de centenas de símbolos remanescentes de código migrado, com risco de remover algo em uso. É uma pendência declarada, não um esquecimento.

### 4.4 Decisões de projeto durante a migração

| Questão | Decisão | Justificativa |
|---|---|---|
| `byId()` quando o elemento não existe | **Lança** | O legado lançava `TypeError`; só mudou a mensagem. Preservar a falha ruidosa é melhor que mascarar |
| `showToast`/`toast` | Aceita `'warning'` além de `'success'/'error'/'info'/'aviso'` | O legado usava `'warning'`; o tipo original não previa |
| `calcHoje()` no calendário | Cria um `Date` local em vez de reatribuir a constante do módulo | Evita que o clique na meia-noite mude o marcador de "hoje" |
| `escapeHtml` / `formatDate` duplicados | Mantidos os dois, com alias explícito | Preserva a superfície pública que o HTML e os templates esperam |

---

## 5. Eliminação da janela global: `onclick` inline → `data-action`

### 5.1 O problema

O HTML legacy carregava **145 atributos de evento inline** (123 `onclick`, 20 `onchange`, 2 `oninput`) que dependiam de funções globais arbitrárias. Em TypeScript com módulos ESM, `function foo(){}` deixa de ser global — e reescrever 145 atributos à mão seria fragile e não auditável.

### 5.2 A solução

Em vez de um `Object.assign(window, …)` — que reintroduziria o antipadrão —, adotou-se **delegação de eventos** com atributos declarativos:

```html
<!-- antes -->
<button onclick="salvarSala()">Salvar</button>
<button onclick="responderSolic(12,'aprovada')">Aprovar</button>

<!-- depois -->
<button data-action="salvarSala">Salvar</button>
<button data-action="responderSolic" data-arg="12" data-arg2="aprovada">Aprovar</button>
```

O núcleo está em `core/actions.ts` e `core/dom.ts`:

```ts
export function delegar<T extends HTMLElement = HTMLElement>(
  raiz: HTMLElement | Document,
  evento: string,
  seletor: string,
  atributos: readonly string[],
  handler: (alvo: T, dados: DadosDelegados, ev: Event) => void,
): () => void {
  // UM listener na raiz; ev.target.closest(seletor); valida raiz.contains()
  // NAO chama preventDefault — preserva o submit padrao dos botoes
}
```

`instalarDelegacao()` é **idempotente**: instala `click` → `[data-action]`, `change` → `[data-change]`, `input` → `[data-input]`, e emite `console.warn` quando uma ação não está registrada — o que funciona como detector de código morto em tempo de execução.

### 5.3 Resultado

| Métrica | Antes | Depois |
|---|---|---|
| Atributos inline no HTML | 145 | **0** |
| Atributos gerados em template strings TS | ~33 | **0** |
| Handlers órfãos | — | **0** (auditoria cruzada HTML × exports) |
| Pontos de registro de listener | 145 | **7** (um por página, na raiz) |

`core/globals.ts` — que existia apenas para fazer `Object.assign(window, ns)` — foi **removido**.

### 5.4 Regressões encontradas e corrigidas durante a migração

Três defeitos reais foram introduzidos pela conversão automática e detectados por smoke test:

1. **`data-arg` sem aspa de fechamento** em template strings. O HTML gerado ficava `data-arg="1&gt;">Editar<="" button=""` — o parser consumia o HTML seguinte e os ids viravam lixo (`0`, `1>Editar</button><button class=`). Os modais abriam vazios. **16 linhas** corrigidas em `admin.ts`, `coordenador.ts` e `recepcao.ts`.
2. **As 6 funções `rd*` do admin estavam privadas**, mas `data-action="atualizarSecao" data-arg="rdUsuarios"` depende delas. Os botões "Atualizar" caíam no aviso *"Atualização indisponível nesta tela."* — o smoke test não pegou porque `atualizarSecao` trata a ausência com um toast, sem lançar exceção. **Re-exportadas.**
3. **`onclick="_editReservaId=null;modalFechar('modalRes')"`** — duas sentenças num único atributo, impossível de expressar como delegação. Criada a ação `cancelarEdicaoReserva()`.

---

## 6. Bugs funcionais corrigidos

Cada linha desta tabela representa um defeito **demonstrado por comando**, não uma suspeita.

| ID | Local | Sintoma | Causa | Correção |
|---|---|---|---|---|
| **D1** | `server/index.js` | `GET /` respondia **404** | `WEB_ROOT` apontava para `../frontend_reserva_salas`, mas os arquivos estavam um nível abaixo | Apontar para `web/dist` |
| **D2** | `package.json` (raiz) | Dependências sem uso | `@supabase/ssr` e `@supabase/supabase-js` não eram importadas por nada (o `supabase.js` usava CDN) | Remover o arquivo e a pasta |
| **D3** | `web/js/supabase.js` | Chave `sb_publishable_…` hardcoded em todas as 7 páginas | Módulo ESM cujo export não era consumido | Remover o arquivo e a tag `<script type="module">` |
| **D5** | `web/` | Gradle wrapper (`gradlew`, `gradlew.bat`, `gradle/wrapper/*`, `settings.gradle`) dentro do frontend, **sem `build.gradle`** | Artefato de estrutura copiado por engano | Remover |
| **D6** | raiz do Git | `node_modules/` **versionado** (889 arquivos) | `.gitignore` só tinha `.idea/`, `backup.dump`, `*.zip` | Remover do índice e corrigir o `.gitignore` |
| **D7** | `web/css/style.css` | 30 KB de CSS **morto** | Só se auto-referenciava no cabeçalho; nenhum HTML nem o `main.css` o importavam | Remover |
| **D9** | `web/dashboard.html:56` | Botão "Sair" lanzava `ReferenceError: logout is not defined` | O atributo chamava `logout()`, função que **não existe em nenhum JS do projeto** | Trocar por `sair()` (existente em `core/auth.ts`) |
| **D10** | `features/coordenador` | Conflito de reserva **nunca detectado** | `checarConflito` delegava para o global `verificarConflito`, definido em `reservas.js` — arquivo que `coordenador.html` **não carrega**. O `typeof … === 'function'` era sempre `false` | Import único da função de `../dashboard/reservas` |
| **D12** | `core/api.ts` | A aplicação **travava** com tela congelada | `fetch` sem limite: `initDados()` ficava pendurado para sempre quando a API não respondia (o `fetch` só rejeita após o timeout de TCP do SO) | `AbortController` + `API_TIMEOUT_MS = 12_000`; a falha cai no `catch` já existente e entra em modo offline com cache local |
| **D13** | 3 páginas | `onclick="modalFechar('modalX')"` sem função | Os entries não instalavam o namespace `core/ui` | `ui` adicionado ao `installGlobals` de coordenador, instrutor e recepção |
| **D14** | `dashboard.html` | `onclick="mostrarSecao('salas')"` sem função | O entry importava só `initDashboard` | Entry passa o namespace inteiro do módulo |
| **D15** | `features/admin/admin.ts` | Todo **coordenador** aparecia com badge cinza | `BADGE_PERFIL` usava a chave inglesa `coordinator`, que nunca casa com `Usuario.perfil` (`'coordenador'`) | Chave corrigida para `coordenador` |
| **D16** | `mobile/src/utils/salaStatus.ts` | Reserva **CANCELADA** marcava a sala como ocupada | A classificação não filtrava `status === 'ATIVA'` | Filtro adicionado, alinhado com o web |

### 6.1 Código morto dentro do TypeScript

Além dos arquivos removidos, **9 monkey-patches** foram eliminados. O padrão era idêntico em todos:

```js
var _renderTabelaSalasOrig = renderTabelaSalas;
renderTabelaSalas = function(){ /* versão nova */ };
```

A versão original ficava **inalcançável** — `_renderTabelaSalasOrig` era guardada e nunca chamada. Nove Ocorrências: `renderTabelaSalas`, `renderTabelaTurmas`, `renderTabelaReservas`, `rdSalas`, `rdTurmas`, `rdReservas`, `rdInstrutores`, `rdChaves` e `rdTurmas` (instrutor). Portou-se somente a versão alcançável, com o fato documentado em JSDoc.

Também removidos: `_dataLiberacaoPorTurnos` (nunca chamada), dois `labelStatus` duplicados, `rdMapaDebounced` + `_mapaTimer` (nunca chamados) e quatro helpers mortos de `dashboard_page.js`.

---

## 7. Unificação dos contratos de dados

### 7.1 O problema

Três descrições da mesma entidade, divergentes:

| Campo | Web (antes) | Mobile (antes) | Java |
|---|---|---|---|
| `Usuario.senha` | `senha?: string` | `senha: string` | `@NotBlank NOT NULL` |
| `Sala.turnosDisponiveis` | `Turno[]?` | `Turno[]` | `List<String>` EAGER |
| `Sala.ativa` | ausente | ausente | `boolean = true` |
| `Sala.turnos` | `Turno[]?` | ausente | `List<String>` (tabela legada) |
| `Reserva.status` | `StatusReserva \| string` | `string` | `String` |
| `Reserva.diasSemana` | `DiaSemana[]?` | `DiaSemana[]` | `Set<String>` |
| `Notificacao.paraPerfil` | `Perfil \| string \| null` | `string` | `String` |
| `Notificacao.mensagem` | presente | ausente | **não existe** |
| `Reserva.reservadoPorId` / `solicId` | presente | ausente | **não existe** |
| Tipo do status de solicitação | `StatusSolicitacao` | `StatusSolic` | `StatusSolicitacao` |
| `StatusManualSala` | literal duplicado idêntico a `StatusSala` | alias | `String` |
| Formas CRUD (`Novo*`, `Atualizar<T>`) | presentes | **ausentes** | — |
| `EstadoCalendario` | ausente | presente | — |

Havia ainda um quarto arquivo: `mobile/src/types/type.ts` — cópia colada de `index.ts` com `id: string`, `unidadeId: string` e `instrutorId?: string`, **incompatível** com o contrato real. Ninguém o importava, mas sua existência ameaçava qualquer editor que o abrisse.

### 7.2 A solução

`web/src/types/index.ts` e `mobile/src/types/index.ts` passaram a descrever **a mesma** entidade, com a mesma opcionalidade. Duas regras de simplificação eliminaram divergências sem custo:

- **`StatusManualSala` deixou de ser um literal duplicado** e virou `export type StatusManualSala = StatusSala`. Dois nomes, um único corpo — impossível divergirem.
- **`StatusSolicitacao` e `StatusSolic` passaram a ser alias um do outro**, preservando o nome que cada cliente já usava.

As uniões literais que **precisam** coincidir byte a byte porque representam enums do Java ficaram idênticas:

```ts
export type Perfil           = 'admin' | 'coordenador' | 'instrutor' | 'recepcao';
export type StatusChave      = 'disponivel' | 'pega';
export type StatusSolicitacao = 'pendente' | 'aprovada' | 'recusada';
```

O Java produz exatamente esses valores: `Perfil` serializa via `@JsonValue` para `name().toLowerCase(Locale.ROOT)`; `StatusChave` tem `@JsonValue` customizado (`DISPONIVEL → "disponivel"`, `RETIRADA → "pega"`); `StatusSolicitacao` também serializa minúsculo.

### 7.3 DTOs do Java declarados em TypeScript

Os cinco `record`s do pacote `dto/` passaram a ser declarados no TypeScript, para que o cliente descreva **o corpo exato** que a API aceita:

```ts
export interface LoginRequest { email: string; senha: string; }
export interface ReservaRequest {
  salaId: number; turmaId?: number | null; turno: string;
  diasSemana: string[]; dataInicio: string; dataFim: string;
  horaInicio?: string | null; horaFim?: string | null;
  instrutorId?: number | null; unidadeId: number;
}
export interface SolicitacaoRequest { /* ... */ }
export interface RespostaSolicitacaoRequest { decisao: string; resposta?: string | null; }
export interface UsuarioResponse {
  id: number; nome: string; email: string; perfil: string; unidadeId: number;
}
```

`UsuarioResponse` **não** inclui `senha` — ao contrário da entidade `Usuario`, que a serializa. Essa assimetria é intencional e está documentada.

### 7.4 `mobile/src/types/type.ts` — removido

Verificação prévia por varredura em todos os `.ts`/`.tsx` do mobile: **zero** imports de `types/type`. O arquivo foi deletado, eliminando a fonte de confusão.

---

## 8. Endurecimento da tipagem estrita

### 8.1 O resultado da auditoria

Varredura por `\bany\b` em **todo** `web/src/**` e `mobile/src/**`:

> **Zero ocorrências.**

A restrição "proibido `any`" já era atendida; o trabalho real foi eliminar os *escape hatches* que restavam.

### 8.2 O que foi endurecido

**`core/globals.ts`** — 4 ocorrências de `(window as unknown as Record<string, unknown>)[nome]`, uma por função. Substituídas por um único ponto de conversão:

```ts
/** `window` visto como indice de nomes publicados por `installGlobals`.
 *  A assinatura global NAO e augmentada com index signature de proposito. */
interface JanelaGlobalizada { [nome: string]: unknown; }

function lerGlobal(name: string): unknown {
  return (window as unknown as JanelaGlobalizada)[name];
}
```

⚠️ A primeira tentativa — `interface JanelaGlobalizada extends Window { [nome: string]: unknown }` — **não compilou** (TS2352): o index signature `unknown` conflita com as propriedades já tipadas de `Window` (`location: Location`, por exemplo). A assinatura global `Window` deliberadamente **não** foi augmentada com index signature, para não mascarar erros de digitação.

**`core/api.ts`** — o cast foi eliminado por completo, porque a variável já estava declarada globalmente:

```ts
declare global {
  interface Window {
    /** Base da API injetada antes do bundle. Aceita `same-origin`. */
    __CONECTA_API_BASE__?: string;
  }
}
```

```ts
const janela: string | undefined = window.__CONECTA_API_BASE__;
```

**`core/storage.ts`** (26 KB) — auditado integralmente: **todas** as funções exportadas já possuíam tipo explícito de parâmetro e de retorno. Exemplos:

```ts
sortById<T extends { id: number }>(lista: T[]): T[]
getSalaById(id: number | string | null | undefined): Sala | null
getNotifsPara(perfil: Perfil | string, unidadeId?: number | string | null): Notificacao[]
updUser(id: number | string, dados: Atualizar<Usuario>): Promise<Usuario | null>
getOverride(salaId: number | string, unidadeId?: number | string | null): OverrideSala | null
```

**Resultado:** `as unknown as Record<string, unknown>` → **zero** ocorrências em `web/src`.

### 8.3 Os dois pontos que permanecem — e por quê

| Local | Padrão | Justificativa para mantê-lo |
|---|---|---|
| `features/instrutor/instrutor.ts:785` | `as unknown as NovaSolicitacao` | Preserva a distinção entre `null` e "campo ausente" em `diasSemana`/`datasEspecificas` — o legado gravava `null` explicitamente e o contrato do banco depende disso. Um cast "mais limpo" mudaria o dado persistido |
| `features/dashboard/reservas.ts:240` | `turnosSala.includes(turno as never)` | Estreitamento de um `string` para a união `Turno`. Endurecer exigiria narrowing no call site, com risco de alterar a regra de negócio de validação de turno — explicitamente fora do escopo |

---

## 9. A entidade Unidade: diagnóstico e correção

Esta frente foi a mais reveladora, porque o defeito **não era** de modelagem — era de **comparação**.

### 9.1 Causa-raiz

As features filtravam por unidade com **igualdade estrita**:

```ts
registro.unidadeId === uid()      // uid(): number | null
```

Duas formas de quebrar:

- `uid()` nulo → `1001 === null` → **lista inteira vazia**;
- id vindo como texto do servidor (`"1001"`) → `1001 === "1001"` → **vazio**.

O `admin.ts` e o `calendario.ts` usavam `String(a) === String(b)` — tolerante. Daí a inconsistência: a mesma unidade aparecia no painel administrativo e some no painel do coordenador.

### 9.2 A função que resolveu

```ts
/**
 * Compara dois identificadores de unidade tolerando a diferenca entre
 * numero e texto (o servidor pode serializar o id como "1001").
 *
 * Antes as telas comparavam com `===`, o que zerava a lista inteira quando
 * o id vinha como texto ou quando o usuario nao tinha unidade definida.
 */
export function mesmaUnidade(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): boolean {
  if (a === null || a === undefined || a === '') return false;
  if (b === null || b === undefined || b === '') return false;
  return String(a) === String(b);
}
```

A mesma função foi implementada no mobile, com o mesmo JSDoc.

### 9.3 Correções por camada

**Backend**

| Arquivo | Defeito | Correção |
|---|---|---|
| `SincService.salvar()` | `Long.valueOf(item.get("unidadeId").toString())` ⇒ **NullPointerException (HTTP 500)** quando o registro chegava sem `unidadeId`, abortando a coleção inteira | Helper `longOuNull(Object)` — devolve `null` em vez de explodir |
| `SincService.salvar("salas")` | Não repunha `turnos`, `turnosDisponiveis`, `statusManual`, `motivoManual`, `manualPor`, `manualCriadaEm`, `ativa` — o `POST /api/sinc` **recria** a entidade, então todo campo não enviado era zerado | Todos repostos |
| `SincService.salvar("reservas")` | Não repunha `horaInicio`, `horaFim`, `avulsa` | Todos repostos |
| `SalaService.validar()` | `unidades.existsById(null)` ⇒ `InvalidDataAccessApiUsageException` → **500** onde o correto é **409** | Guarda explícita: `RegraDeNegocioException("Informe a unidade da sala")` |
| `UnidadeService.excluir()` | Não checava referências → deixava `unidadeId` órfão em 6 coleções | `referenciasPendentes(id)` ⇒ **409** com a lista das coleções vinculadas |
| `UnidadeService.criar()` / `atualizar()` | Aceitava nome duplicado | `exigirNomeUnico(nome, ignorarId)` ⇒ **409** |
| `UnidadeRepository` | Sem finder de nome | `+ findByNomeIgnoreCase(String)` |
| `UsuarioRepository` | Sem `findByUnidadeId` (os outros 5 repositórios tinham) | `+ findByUnidadeId(Long)` |

**Web**

| Arquivo:linha | Defeito | Correção |
|---|---|---|
| `core/storage.ts:482,530` | `unidadeId: d.unidadeId as number` — o cast mascarava `undefined`, criando registro órfão | `d.unidadeId ?? unidadePadrao()` |
| `core/storage.ts` — `getSalasByUnidade` | Comparação por `String()`, sem guarda de `null` | `mesmaUnidade()` + guarda de nulo |
| `core/filters.ts` — `aplicarFiltros` | Filtro de unidade por igualdade estrita | Chave `unidadeId` tratada por `mesmaUnidade()` |
| `features/coordenador/coordenador.ts` | `unidadeId: uid() as number` (6 sites) + `=== uid()` (17 sites) | `unidadePadrao()` + `mesmaUnidade()` |
| `features/instrutor/instrutor.ts` | 2 sites de `unidadeId` + `getSalasByUnidade(uid() as number)` | idem |
| `features/recepcao/recepcao.ts` | 1 site de `unidadeId` + 3 de `getSalasByUnidade` | idem |
| `features/login/login.ts:101` | `u.unidadeId \|\| (uid ?? 0)` ⇒ **0 hardcoded** | `u.unidadeId ?? uid ?? unidadePadrao()` |
| `features/admin/admin.ts` — `salvarUnid` | Gravava `{nome, endereco, cep}` — **sem `cidade`**, que o Java persiste | `cidade` preservada na edição, vazia na criação (o formulário não tem o campo; layout intocado) |
| `features/admin/admin.ts` — `excluirUnid` | Bloqueava só com `getUsuarios()` | `referenciasDaUnidade(id)` — 6 coleções |

**Mobile**

| Arquivo:linha | Defeito | Correção |
|---|---|---|
| `app/coordenador/index.tsx:234,357,840` | `unidadeId: uid ?? 0` ⇒ **0 hardcoded** | `uid ?? db.unidadePadrao()` |
| `app/coordenador/index.tsx:984` | `unidadeId: uid!` — assertion não-nula | `uid ?? db.unidadePadrao()` |
| `app/coordenador/instrutor/recepcao` | 17 comparações `=== uid` | `db.mesmaUnidade(...)` |
| `app/instrutor:48`, `app/recepcao:44` | `sessao!.unidadeId` — estoura sem sessão | `sessao?.unidadeId ?? db.unidadePadrao()` |
| `hooks/useAuth.ts:60` | `u.unidadeId \|\| unidadeId!` | `?? unidadeId ?? db.unidadePadrao()` |
| `services/storage.ts:777` | `getSalasByUnidade` com igualdade estrita | `mesmaUnidade()` |

### 9.4 A divergência entre as duas APIs — causa raiz do conflito de sincronização

O achado mais importante da auditoria: o `POST /api/sinc` **se comportava de forma diferente** nas duas pontas.

| Aspecto | Spring `SincService` | Node `server/index.js` |
|---|---|---|
| `alteracoes` | **recria** a entidade (apaga campos não enviados) | **merge por spread** (preserva) |
| `unidadeId` nulo | **NPE → 500**, aborta a coleção | aceita e grava `null` |
| `criados` | id novo + `idsNovos` | id novo + `idsNovos` (mesma chave) |
| `/api/dados` | 8 coleções | `banco` completo (8 + `sessao` + `ultimaSinc`) |

O web envia a **coleção inteira** em `alteracoes` a cada `persist`. No Node os `turnos`, `statusManual` e `ativa` das salas sobreviviam; **no Spring eles eram apagados** — silenciosamente, a cada gravação. Com o `salvar()` repondo todos os campos, as duas implementações passaram a convergir.

---

## 10. Regra de ocupação de salas unificada

O web e o mobile classificavam a ocupação de salas por código **diferente**, com resultados diferentes para a mesma sala:

| Regra | Web (antes) | Mobile (antes) |
|---|---|---|
| `statusManual` | **ignorado** | tem precedência |
| `status === 'ATIVA'` | filtra | **ignora** (conta CANCELADA) |
| `calcStatus(turma)` | **ignorado** | encerrada→ignora, ativa→ocupada, senão iminente |
| `avulsa` | mostra "Turma desconhecida" | `ocupada` + "Sem turma" |
| Saídas possíveis | `livre` / `ocupada` | `livre` / `ocupada` / `iminente` |

Os dois lados foram reescritos com a **mesma** função `classificarReserva`:

```ts
function classificarReserva(r: Reserva, hoje: string, dia: DiaSemana): Ocupacao | null {
  if (r.status !== 'ATIVA') return null;
  if ((r.dataInicio ?? '') > hoje || (r.dataFim ?? '') < hoje) return null;
  if (!(r.diasSemana ?? []).includes(dia)) return null;

  const avulsa = r.avulsa || !r.turmaId;
  if (avulsa) return { status: 'ocupada', turma: 'Sem turma' };

  const turma = getTurmaById(r.turmaId);
  const st = calcStatus(turma);
  if (st === 'encerrada') return null;
  if (st === 'ativa') return { status: 'ocupada', turma: turma?.nome ?? '' };
  return { status: 'iminente', turma: turma?.nome ?? '' };
}
```

O web ganhou a terceira saída — **EM BREVE** — que antes só existia no mobile, e `statusManual` passou a ter precedência nos dois lados. Nenhuma classe CSS foi alterada: `.disp-result` já era genérico, e o ícone novo é inline (`ph ph-clock`).

---

## 11. Refatoração estrutural do backend Spring Boot

### 11.1 Consolidação do CORS

`config/CorsConfig.java` e `config/WebConfig.java` registravam **a mesma** mapping `/api/**`. No `WebMvcConfigurerComposite`, o segundo sobrescreve o primeiro — logo, a configuração *efetiva* era a do `WebConfig`. O arquivo `CorsConfig.java` foi removido e o `WebConfig.java` preserva exatamente a configuração que estava em vigor:

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
```

O Javadoc registra também que **nenhum** handler de recursos estáticos é declarado — vale o default do Spring Boot (`classpath:/static/`), requisito do `Dockerfile` multi-estágio.

### 11.2 Lógica de negócio extraída dos controllers

Quatro controllers acessavam repositórios diretamente. A extração para services eliminou a duplicação e reduziu drasticamente o tamanho dos controllers:

| Controller | Antes | Depois | Service criado |
|---|---|---|---|
| `AuthController` | 29 linhas (com `UsuarioService`) | **29 linhas** (com `AuthService`) | `AuthService` — login, sessão, logout |
| `DadosController` | 1.797 B (8 repositórios injetados) | **25 linhas** | `DadosService` — `banco()` como fonte única |
| `NotificacaoController` | 1.072 B | **35 linhas** | `NotificacaoService` — listar, marcar lida |
| `SincController` | **381 linhas** (9 repositórios + `SeedService`) | **54 linhas** | `SincService` — `sincronizar`, `resetar` |

O `SincController` é o caso mais claro: os 10 helpers privados (`extrair`, `aplicarCriados`, `aplicarAlteracoes`, `aplicarRemocoes`, `existe`, `proximoId`, `salvar`, `deletar`, `sessaoJson`, `setSessao`) foram movidos **verbatim** para o `SincService`, que passou a ser `@Transactional` — o limite transacional é equivalente, já que o service é invocado através do proxy do Spring.

`DadosService.banco()` eliminou a duplicação que existia entre `DadosController` e `SincController.banco()`: as duas camadas devolviam as mesmas 8 coleções, uma por `Map.of` (imutável, ordem não garantida) e outra por `LinkedHashMap`. Agora há **uma** implementação, em `LinkedHashMap` — ordem determinística no JSON, o que é uma melhoria, não uma mudança de contrato.

### 11.3 Autorização por unidade nas salas

O backend autorizava qualquer um a alterar qualquer sala. Passou a exigir identificação explícita:

```java
public Sala atualizar(Long id, Long usuarioId, Sala entrada) {
    Sala atual = buscar(id);          // 404
    validar(entrada);                 // 409
    exigirMesmaUnidade(atual, usuarioId);  // 403
    ...
}

private void exigirMesmaUnidade(Sala atual, Long usuarioId) {
    if (usuarioId == null)
        throw new AcessoNegadoException("Identificacao do usuario e obrigatoria para alterar sala");
    Usuario usuario = usuarios.findById(usuarioId)
            .orElseThrow(() -> new RecursoNaoEncontradoException("Usuario", usuarioId));
    if (!usuario.getUnidadeId().equals(atual.getUnidadeId()))
        throw new AcessoNegadoException("Nao e possivel atualizar salas de outras unidades");
}
```

O `usuarioId` chega pelo cabeçalho `X-Usuario-Id` — **não existe filtro de autenticação no backend** (ver pendência #3), então a identidade é declarada pelo cliente. Isso é uma melhoria de *integridade de dados*, não de segurança: a autorização real continua ausente.

Uma nova exceção, `AcessoNegadoException`, e seu handler 403 foram adicionados ao `ApiExceptionHandler`. Os outros três handlers (404, 409, 400) permaneceram **inalterados**.

### 11.4 `Location` no 201

`SolicitacaoController.criar` passou a devolver `ResponseEntity` com o `Location` da recurso criado:

```java
Solicitacao criada = service.criar(request);
URI location = ServletUriComponentsBuilder.fromCurrentRequest()
        .path("/{id}").buildAndExpand(criada.getId()).toUri();
return ResponseEntity.created(location).body(criada);
```

### 11.5 Correção de codificação

`DadosController.java` continha a palavra chinesa **快照** ("Snapshot") no Javadoc — UTF-8 válido, mas inconsistente com o resto do código em português. Substituída por `Snapshot`. Todos os `.java` de `config/`, `controller/` e `service/` foram validados como UTF-8 estrito.

---

## 12. Fonte única de verdade da API

### 12.1 O problema

O `compose.yaml` original subia **dois backends simultaneamente**, cada um com sua própria base de dados:

- o servidor Node (`server/index.js`), que persiste em `server/data/db.json`;
- a API Spring Boot (`backend/demo/`), que persiste no Postgres.

Os dois expõem a mesma rota `/api/sinc`, com **semânticas diferentes** (seção 9.4). Um cliente que alternasse entre as duas receberia conflitos de dados, ids divergentes e perda de campos.

### 12.2 A decisão

O **Spring Boot é a fonte da verdade**. O servidor Node é rebaixado a **mock legado**, atrás do perfil de Compose `mock`, e não sobe junto.

```yaml
services:
  postgres:
    image: postgres:16
    container_name: conectasenac-db
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-conectasenac}
    ports:
      - '${POSTGRES_PORT:-5432}:5432'
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-conectasenac}"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      args:
        VITE_API_BASE: ${VITE_API_BASE:-same-origin}
    container_name: conectasenac-api
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PORT: ${API_PORT:-8081}
      SUPABASE_DB_USER: ${POSTGRES_USER:-postgres}
      SUPABASE_DB_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      # Sobrescreve o host do application.properties para o Postgres local.
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-conectasenac}
    ports:
      - '${API_PORT:-8081}:8081'

  server:
    profiles: ['mock']
    image: node:20-alpine
    container_name: conectasenac-mock
    working_dir: /srv/server
    command: ['node', 'index.js']
    volumes:
      - ./server:/srv/server:ro
      - ./server/data:/srv/server/data
    ports:
      - '${MOCK_PORT:-3333}:3333'

volumes:
  pg_data:
```

Três decisões técnicas:

1. **`healthcheck` + `depends_on: condition: service_healthy`** — a API só sobe depois que o Postgres aceita conexões. Sem isso, a primeira tentativa de boot falha.
2. **`SPRING_DATASOURCE_URL` sobrescrevendo o `application.properties`** — o backend aponta, por padrão, para o pooler do Supabase. A sobrescrita por variável de ambiente (relaxed binding do Spring) redireciona para o Postgres local **sem alterar uma linha do backend**.
3. **A senha saiu do arquivo.** A `compose.yaml` versionada continha `verYs3cret` em texto puro; agora é `${POSTGRES_PASSWORD:-postgres}`.

O `server` está sob `profiles: ['mock']`: só sobe com `docker compose --profile mock up -d server`. O comentário de topo avisa explicitamente que mock e API **não devem** rodar juntos sobre o mesmo cliente.

### 12.3 Alinhamento dos dois `api.ts`

O web e o mobile falavam com backends diferentes. Passaram a ter a mesma precedência de configuração, a mesma porta padrão e **paridade total de endpoints**.

**Precedência de configuração**

| Camada | Web (`core/api.ts`) | Mobile (`services/api.ts`) |
|---|---|---|
| 1ª | `window.__CONECTA_API_BASE__` | `extra.apiUrl` (do `app.json`) |
| 2ª | `VITE_API_BASE` (build) | `EXPO_PUBLIC_API_URL` |
| 3ª | `window.__CONECTA_MODO_API__` → `VITE_MODO_API` | `extra.modoApi` → `EXPO_PUBLIC_MODO_API` |
| 4ª | inferência: base em loopback ⇒ `mock`, senão `producao` | inferência: host privado ⇒ `mock`, senão `producao` |
| Porta padrão | — | **8081** (era 3333) |

**Paridade de endpoints** — o mobile não expunha `/api/sessao` nem `/api/logout`. Ambos foram adicionados:

```ts
export async function lerSessaoRemota(): Promise<Usuario | null> { /* GET /api/sessao */ }
export async function logoutRemoto(): Promise<boolean>             { /* POST /api/logout */ }
```

As seis rotas ficam agora disponíveis nos dois clientes: `/api/dados`, `/api/login`, `/api/sinc`, `/api/reset`, `/api/sessao`, `/api/logout`.

### 12.4 O sentinela `same-origin`

Um detalhe subtis custou uma rodada de depuração: **o Vite descarta variáveis de ambiente com valor vazio**. Com `VITE_API_BASE=""`, o `import.meta.env` gerado vira o objeto literal `{}` e o valor se perde silenciosamente — o bundle caía no host de produção.

A solução foi um **sentinela não vazio**, `same-origin`, traduzido para `window.location.origin` em tempo de execução:

```ts
const SENTINELA_MESMA_ORIGEM = 'same-origin';

function resolverBase(): string {
  const janela: string | undefined = window.__CONECTA_API_BASE__;
  if (typeof janela === 'string' && janela !== '') return materializar(janela);

  const env = import.meta.env?.VITE_API_BASE as string | undefined;
  if (typeof env === 'string' && env !== '') return materializar(env);

  return 'https://conecta-senac.onrender.com';
}

function materializar(valor: string): string {
  return valor === SENTINELA_MESMA_ORIGEM ? window.location.origin : valor;
}
```

Comportamento verificado:

| Origem do valor | Resultado |
|---|---|
| nenhum | `https://conecta-senac.onrender.com` (produção) |
| `VITE_API_BASE=same-origin` no build | `window.location.origin`, sem fallback no bundle |
| `window.__CONECTA_API_BASE__='same-origin'` | `window.location.origin` |
| `window.__CONECTA_API_BASE__='http://host:porta'` | esse host literal |

O host de produção **não foi alterado** — faz parte do contrato existente.

### 12.5 `.env.example` reescrito

Cinco seções, uma por camada: servidor Node (mock legado), API Spring Boot (fonte da verdade), Postgres, mobile (precedência de `extra.apiUrl` → `EXPO_PUBLIC_API_URL` → descoberta automática, com `EXPO_PUBLIC_API_PORT=8081`) e web (`VITE_API_BASE`, `VITE_MODO_API`, `VITE_API_TIMEOUT_MS`).

---

## 13. Build e infraestrutura de entrega

### 13.1 `web/vite.config.ts` — MPA explícita com fail-fast

O config anterior declarava as 7 entradas como um objeto literal. Passou a derivá-las de uma lista única e a **validar a existência dos arquivos antes do build**:

```ts
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGINAS = [
  { html: 'index', entry: 'home' },
  { html: 'login', entry: 'login' },
  { html: 'dashboard', entry: 'dashboard' },
  { html: 'admin', entry: 'admin' },
  { html: 'coordenador', entry: 'coordenador' },
  { html: 'instrutor', entry: 'instrutor' },
  { html: 'recepcao', entry: 'recepcao' },
] as const;

function caminhoDaRaiz(...partes: string[]): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), ...partes);
}

function validarPaginas(): void {
  const faltando: string[] = [];
  for (const p of PAGINAS) {
    if (!existsSync(caminhoDaRaiz(`${p.html}.html`))) faltando.push(`${p.html}.html`);
    if (!existsSync(caminhoDaRaiz('src', 'entry', `${p.entry}.ts`))) {
      faltando.push(`src/entry/${p.entry}.ts`);
    }
  }
  if (faltando.length > 0) {
    throw new Error(
      `web/vite.config.ts: arquivos obrigatorios ausentes:\n  - ${faltando.join('\n  - ')}`,
    );
  }
}
```

⚠️ A primeira implementação usou `new URL(partes.join('/'), base)` com `base` vindo de `fileURLToPath` — **caminho de filesystem não é URL**, e o build quebrava com `TypeError: Invalid URL`. Corrigido com `node:path`.

Além disso: `base: './'` (a SPA funciona em qualquer mount point), `server: { port: 5173, host: true }` e `preview: { port: 4173, host: true }` — com `host: true`, o dev server responde na rede, permitindo que estudantes no laboratório abram `http://<ip-da-máquina>:5173`.

O `web/package.json` recebeu `@types/node ^22.10.2`, necessário para o `node:fs`/`node:path`/`node:url` do config.

### 13.2 `Dockerfile` — três defeitos corrigidos

| ID | Defeito | Antes | Agora |
|---|---|---|---|
| **D-A** | O build usava o Gradle *rolling* da imagem `gradle:jdk21`, **não** a versão fixada pelo projeto (9.5.1). O build do container, o local e o CI podiam divergir | `gradle ... bootJar` | `COPY backend/demo/gradle ./gradle` + `COPY backend/demo/gradlew ./gradlew` + `chmod +x` + **`./gradlew ... bootJar`** |
| **D-B** | A verificação da injeção do frontend cobria **1 das 7 páginas** | `grep -q '^BOOT-INF/classes/static/index.html$'` | Verifica as **7 páginas** + `css/main.css` + `img/senac-logo-sem-fundo.webp`; o build **falha** se faltar qualquer uma |
| **D-C** | `gradlew`/`gradlew.bat` eram da geração 8.x, incompatíveis com o `distributionUrl` 9.5.1 | scripts antigos | scripts oficiais Spring Boot v3.5.6, forma `-jar` |

A verificação de D-B, que é o que garante que a imagem serve o app completo:

```dockerfile
RUN set -eu; \
    mkdir -p /tmp/root/BOOT-INF/classes; \
    cp -a /tmp/web-dist /tmp/root/BOOT-INF/classes/static; \
    cd /tmp/root; jar uf /tmp/app.jar BOOT-INF/classes/static; \
    cd /; rm -rf /tmp/root /tmp/web-dist; \
    jar tf /tmp/app.jar > /tmp/jar-list.txt; \
    for f in index login dashboard admin coordenador instrutor recepcao; do \
      grep -q "^BOOT-INF/classes/static/$$f\.html$$" /tmp/jar-list.txt \
        || { echo "ERRO: $$f.html nao encontrado dentro do jar"; exit 1; }; \
    done; \
    grep -q '^BOOT-INF/classes/static/css/main.css$$' /tmp/jar-list.txt \
      || { echo "ERRO: css/main.css nao encontrado dentro do jar"; exit 1; }; \
    grep -q '^BOOT-INF/classes/static/img/senac-logo-sem-fundo.webp$$' /tmp/jar-list.txt \
      || { echo "ERRO: img/senac-logo-sem-fundo.webp nao encontrado dentro do jar"; exit 1; }; \
    rm -f /tmp/jar-list.txt; \
    echo "frontend injetado no jar com sucesso (7 paginas + css + img)"
```

O `jar` do próprio JDK é usado para reempacotar — sem `apt-get install unzip zip`.

### 13.3 Gradle Wrapper — geração e bit de execução

O `gradlew` (POSIX) foi reescrito com **LF puro** (0 byte CR, verificado byte a byte) e `#!/bin/sh` na primeira linha. O `gradlew.bat` ficou com **CRLF** (94 bytes `\r`), como o Windows exige.

A forma de invocação mudou para `-jar`, que é **imune à poluição de `CLASSPATH`** do ambiente:

```bat
set CLASSPATH=
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" -jar "%APP_HOME%\gradle\wrapper\gradle-wrapper.jar" %*
```

O bit de execução do `gradlew` estava `100644` no índice do Git — `./gradlew` no container daria `Permission denied`. Corrigido com `git update-index --chmod=+x backend/demo/gradlew` ⇒ agora **`100755`**.

### 13.4 O `.dockerignore` corrigido

O arquivo original listava `web` entre os diretórios ignorados — o que impedia o `COPY web/ ./` do estágio de frontend. Reescrito: removeu `web` e `mobile` da exclusão (mobile continua excluído, por não ser usado na imagem) e passou a ignorar `**/dist`, `**/build`, `**/.gradle`, `**/.expo`, IDE, `**/*.tmp` e segredos (`**/.env`, `**/.env.*`, com `!**/.env.example`).

---

## 14. Testes automatizados e CI

### 14.1 As seis suítes

| Arquivo | Técnica | Cobertura |
|---|---|---|
| `EntidadesTest` | JUnit 5 + reflexão, **sem** contexto Spring | Confere que cada uma das 9 entidades tem exatamente os campos esperados, e que os 3 enums têm as constantes corretas |
| `DadosServiceTest` | Mockito (`@ExtendWith(MockitoExtension.class)`) | `banco()` devolve **exatamente** 8 chaves; cada repositório tem `findAll()` chamado uma vez; as listas são as mesmas instâncias; `sessao`/`ultimaSinc` **ausentes** |
| `SolicitacaoServiceTest` | Mockito | 10 testes: criação com unidade compatível, unidade divergente do instrutor (409), divergente da sala (409), sala inexistente (404), os três caminhos de `listar`, solicitação já respondida (409), decisão inválida (409), aprovar sem turnos (409), aprovar com 2 turnos (2 reservas criadas), recusar (nenhuma reserva), notificação gravada com `paraId`/`paraPerfil` corretos |
| `SalaServiceTest` | Mockito | 16 testes: criação (sucesso / unidade inexistente → 409), listagem, busca (ok / 404), **atualização** (mesma unidade → 200; **outra unidade → `AcessoNegadoException` com "outras unidades" e `verify(salas, never()).save()`**), `usuarioId` nulo → 403, usuário inexistente → 404, sala inexistente → 404, unidade de destino inexistente → 409, preservação de `ativa`, validação do `unidadeId` do corpo, exclusão (ok / 404), leitura nunca escreve |
| `SalaControllerTest` | MockMvc standalone + `ApiExceptionHandler` | `POST /api/salas` → 201; unidade inexistente → 409; `PUT /api/salas/1` com `X-Usuario-Id: 20` → 200; outra unidade → **403**; sem cabeçalho → 403 |
| `SolicitacaoControllerTest` | MockMvc standalone + `ApiExceptionHandler` | `POST /api/solicitacoes` válido → **201 + `Location`** terminando em `/api/solicitacoes/30` e `jsonPath("$.id").value(30)`; unidade divergente → 409; sala inexistente → 404; listagem; busca (200 / 404) |

O `build.gradle` **não foi alterado** — já continha `spring-boot-starter-test`, `spring-boot-starter-webmvc-test`, `junit-platform-launcher` e `useJUnitPlatform()`.

### 14.1.1 Resultado da execução — suíte verde

A suíte foi **executada de verdade** neste host. A limitação que existia ("sem JDK 21, o Gradle não compila") foi superada pela descoberta de um Microsoft JDK 21.0.12.1 LTS em `C:\Users\<usuário>\.jdks\ms-21.0.12.1` (veja a seção 18.1).

```powershell
$env:JAVA_HOME = 'C:\Users\<usuário>\.jdks\ms-21.0.12.1'
cd backend\demo
.\gradlew.bat test --console=plain --no-daemon
```

| Suíte | Testes | Falhas |
|---|---|---|
| `DadosServiceTest` | 4 | 0 |
| `DemoApplicationTests` (pré-existente, `@SpringBootTest` + H2) | 2 | 0 |
| `EntidadesTest` | 2 | 0 |
| `SalaControllerTest` | 5 | 0 |
| `SalaServiceTest` | 18 | 0 |
| `SolicitacaoControllerTest` | 6 | 0 |
| `SolicitacaoServiceTest` | 13 | 0 |
| **Total** | **50** | **0** — `BUILD SUCCESSFUL in 18s` |

Resultado colhido dos XML em `backend/demo/build/test-results/test`. O `DemoApplicationTests` — que já existia no repositório — continua passando, o que confirma que a configuração de teste com H2 não quebrou o teste de integração original.

**Seis defeitos foram encontrados e corrigidos para chegar a esse estado** (todos introduzidos por esta própria refatoração, nunca pelo código original):

| # | Arquivo | Defeito | Correção |
|---|---|---|---|
| 1 | `SolicitacaoServiceTest.java:201` | Sintaxe **JavaScript** (`() =>`) em arquivo **Java** — erro de compilação | `() ->` |
| 2 | `SolicitacaoServiceTest.java:149` | `Optional.isEmpty()` invocado como método estático | `Optional.empty()` |
| 3 | `DadosServiceTest.java:100-103` | `List<Object>` inferido quebrava o `thenReturn` de `findAll()` | tipos `List<Usuario>` / `List<Sala>` explícitos |
| 4 | `SalaControllerTest` / `SolicitacaoControllerTest` | `ApiExceptionHandler` sem `import` → `cannot find symbol` | import adicionado nos 2 arquivos |
| 5 | `EntidadesTest.java:73-75` | `assertEquals` sobre arrays compara **referência**, não conteúdo | `assertArrayEquals` |
| 6 | **`SalaService.java` (produção)** | **Ordem das validações invertida** em `atualizar` | `buscar(id)` → **`exigirMesmaUnidade`** → `validar(entrada)` |

O item 6 é a única correção de **lógica de negócio** da lista e merece detalhamento: a implementação original validava o *payload* antes da *autorização*, de modo que um usuário sem permissão sobre a sala recebia **409 "Unidade informada não existe"** em vez de **403**. Isso é um vazamento de informação — o 409 confirma a existência de uma unidade de outra unidade. A ordem correta é verificar **autorização antes de validação de payload**, e é a que está em vigor.

### 14.2 `src/test/resources/application.properties`

O `@SpringBootTest` existente apontava para o **Supabase** — a suíte tentaria conectar na internet e falhar. Criado um override com H2 em memória:

```properties
spring.datasource.url=jdbc:h2:mem:conecta;MODE=PostgreSQL;DB_CLOSE_DELAY=-1
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.docker.compose.enabled=false
```

O modo `MODE=PostgreSQL` é necessário porque o schema usa construções específicas do Postgres.

### 14.3 CI em três jobs

`.github/workflows/ci.yml`:

| Job | Ambiente | Passos |
|---|---|---|
| `backend` | `actions/setup-java` com **JDK 21** (temurin) e `cache: gradle` | `chmod +x ./gradlew` → `./gradlew test --no-daemon --console=plain` → `./gradlew bootJar -x test` → upload do artefato `conecta-api` (somente em push) |
| `web` | `actions/setup-node` **Node 20** | `npm ci` → `npm run build` (que roda `typecheck` antes do `vite build`) |
| `mobile` | `actions/setup-node` **Node 20** | `npm ci` → `npm run typecheck` |

### 14.4 Scripts de manutenção

| Script | Finalidade |
|---|---|
| `scripts/padronizar-monorepo.ps1` | Verificação **idempotente e read-mostly** em 7 seções (wrapper Gradle, `.gitignore`, estado Git, `mobile/assets`, documentação, peso em disco, resumo). Saída real: **0 falhas, 3 avisos** |
| `scripts/limpar-git.sh` | Três modos: `--dry-run` (padrão, não altera nada), `--gc-only` (só empacotamento), `--rewrite` (expurga com `git filter-repo --sensitive-data-removal`). **Recusa** operar sobre repositório sujo |

---

## 15. Higiene de segredos e do repositório Git

### 15.1 O que estava exposto

A auditoria do histórico encontrou segredos em **todos** os commits alcançáveis:

| Artefato | Conteúdo | Como entrou |
|---|---|---|
| `.env` (raiz) | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | commit `f276d19` — *"Finalizando projeto conecta_3.1 com integração segura ao Supabase"* |
| `js/supabase.js` | Chave hardcoded — o token de 68 caracteres **contém** o de 46 do `.env` | versionado com o frontend |
| `compose.yaml` | Senha literal do Postgres (`verYs3cret`) | versionada na raiz |
| `node_modules/@supabase/**` | 650 objetos | dependências instaladas commitadas |
| `conecta_3.1.zip` | **3.163,8 KB — 91% do packfile** | commit `81fe7fb` |

### 15.2 Por que `--replace-text` sozinho não bastava

O `git filter-repo --replace-text` reescreve o conteúdo de blobs **texto**. O blob `conecta_3.1.zip` era um **arquivo comprimido**: a senha do Postgres e a chave do Supabase estavam **dentro do ZIP**, e o conteúdo comprimido não é alcançável por regex sobre o blob.

O ZIP foi aberto e varrido (112 arquivos de projeto, excluindo `node_modules/`), o que revelou: `conecta_3.1/compose.yaml` com a senha do Postgres, `conecta_3.1/.../js/supabase.js` com a chave, e `conecta_3.1/node_modules/@supabase/**`. Sem a segunda passada, o segredo **ainda iria para o `origin/main`**.

### 15.3 As duas passadas

```bash
# 1ª: remover .env, node_modules/ e o supabase.js legado, redigindo o resto
git filter-repo --force \
  --path .env \
  --path node_modules/ \
  --path "Conecta-Senac-main (frontend web +mobile)/frontend_reserva_salas/frontend_reserva_salas/js/supabase.js" \
  --invert-paths \
  --replace-text "C:\...\replace-text.txt"

# 2ª: remover o ZIP (conteúdo comprimido não é alcançável pelo replace-text)
git filter-repo --force --path conecta_3.1.zip --invert-paths

# Limpeza do packfile
git for-each-ref refs/remotes refs/original | git update-ref -d
git reflog expire --expire=now --expire-unreachable=now --all
git gc --prune=now --aggressive
```

O arquivo de redação (`replace-text.txt`), mantido **fora** do repositório:

```
regex:sb_publishable_[A-Za-z0-9_-]+==>REDACTED_SUPABASE_PUBLISHABLE_KEY
regex:verYs3cret==>REDACTED_POSTGRES_PASSWORD
```

### 15.4 Resultado

| Métrica | Antes | Depois |
|---|---|---|
| Packfile `.pack` | 3.508 KB | **671,5 KB** |
| `.git` total | 4,93 MB | **0,72 MB** (−85%) |
| Blobs > 100 KB | `conecta_3.1.zip` (3,16 MB) + `mobile/package-lock.json` | **só** `mobile/package-lock.json` — legítimo |
| `git log --all --diff-filter=A -- '*.env'` | commit `f276d19` | **vazio** |
| `git log --all --diff-filter=A -- '*.zip'` | commit `81fe7fb` | **vazio** |
| `git rev-list --objects --all \| grep node_modules/` | 650 objetos | **vazio** |
| `git grep -l -E 'sb_publishable_\|verYs3cret' $(git rev-list --all)` | 3 arquivos | **vazio** |
| Varredura recursiva do working tree | — | **nenhum segredo** |
| `git ls-files` | 192 | **192 — idêntico ao backup** (`Compare-Object` sem diferenças) |
| `git fsck --no-progress` | — | **sem erros** |

O `origin` foi re-adicionado ao final (`git filter-repo` o remove por segurança) — **nenhum push foi executado**.

### 15.5 O `.gitignore` como primeira linha de defesa

O `.gitignore` da raiz bloqueia `.env`, `.env.*` (com `!.env.example`) e `node_modules/`. Confirmado por `git check-ignore -v`:

```
.gitignore:34:.env        .env
.gitignore:34:.env        web/.env
mobile/.gitignore:29:.env  mobile/.env
.gitignore:6:node_modules/  node_modules/x
```

### 15.6 Risco residual — e a ação necessária

> Remover um segredo do histórico **não o invalida**. A chave `sb_publishable_…` e a senha `verYs3cret` ficaram públicas no `origin/main` até agora.
>
> **Ação obrigatória antes de voltar a usar aquele projeto:** revogar e gerar uma nova chave no painel do Supabase, e trocar a senha do Postgres. Isto está fora do escopo do Git — é uma ação no painel do provedor.

### 15.7 Identidade do autor

O clone original **não tinha** `user.name`/`user.email` configurados — nem local, nem global. Isso faz o `git commit` falhar em uma instalação nova. Configurado com `--local`, usando o mesmo autor dos commits existentes: `Vitor Roberto Ferreira de Paula <vitor58359976@edu.df.senac.br>`.

---

## 16. Documentação, backups e rastreabilidade

### 16.1 Documentação criada ou atualizada

| Arquivo | Conteúdo |
|---|---|
| `docs/RELATORIO_FINAL.md` | **Este documento** — 19 seções cobrindo todas as frentes |
| `docs/ARQUITETURA_ATUALIZADA.md` | Arquitetura atual, mapa de rastreabilidade (página → entry → feature → core), modo mock vs produção, como executar, pendências |
| `docs/RELATORIO_REFATORACAO.md` | Relatório da primeira frente (reorganização + migração TS), com a tabela de mapeamento JS → TS |
| `docs/CASO_DE_USO.md` | 15 casos de uso, 4 atores, regras de negócio — preservado do original |
| `docs/DOCUMENTACAO_CODIGO.md` | Documentação de código — preservada |
| `docs/DOCUMENTACAO_CONEXAO_WEB_MOBILE.md` | Sincronização web ↔ mobile — renomeado de `.txt`, com **11 caminhos antigos substituídos** |
| `README.md` (raiz) | Apontar para outro backend · Docker (imagem única) · backend Java sem Docker · modo mock vs produção · documentação · execução |

Uma varredura final confirmou **zero** ocorrências de `frontend_reserva_salas`, `Conecta-Senac-main` e `demo-conecta` em toda a documentação.

### 16.2 Backups

| Backup | Conteúdo | Finalidade |
|---|---|---|
| `Conecta-Senac-Atualizado.BACKUP` (200 arquivos, 6,4 MB) | Estado **antigo** (pré-refatoração, com o histórico que continha o `.env`) | Referência histórica. ⚠️ Seguro apenas enquanto ninguém der push nele |
| `Conecta-Senac-Atualizado.BACKUP2` (543 arquivos, 53,6 MB) | Cópia **íntegra do estado atual** | Rede de segurança para a entrega. `HEAD`, `git fsck` e árvore verificados |
| `git-backup-pre-filter` (`...\Temp\opencode\`, 5,14 MB) | O `.git` antes da reescrita de histórico | Recuperação caso o `filter-repo` fosse irreversível |
| `Conecta-Senac-Atualizado.zip` (5,5 MB) | Snapshot compactado | Transferência. `Compress-Archive` falhava no OneDrive (`.git/hooks/*.sample` + caminhos longos); `tar.exe -a -c -f` funcionou |

### 16.3 A armadilha do `robocopy` — e a lição

O `robocopy /E /MIR` **sobrescreve também o `.git`**. Commit commitar diretamente na pasta de entrega e depois sincronizar **reverte** o commit, porque a sincronização traz o `.git` da origem por cima.

**Regra adotada:** commitar **sempre** na pasta de trabalho (`...\Temp\opencode\trabalho`) e só então sincronizar. Esse erro foi cometido uma vez e corrigido; a verificação pós-sincronização (`HEAD`, `git status`, `git fsck`, `git ls-files`) existe justamente para capturá-lo.

---

## 17. Pendências conhecidas

Nenhuma foi corrigida por decisão consciente de escopo; todas estão registradas.

| # | Pendência | Onde | Impacto |
|---|---|---|---|
| 1 | **Senhas em texto puro** | `usuarios.senha` (Java), comparação por `String.equals` no login e no fallback offline do mobile | Crítico. A chave do Supabase e a senha do Postgres precisam ser rotacionadas |
| 2 | **Autorização inexistente no servidor** | Nenhuma rota do Spring tem `@PreAuthorize`; não há `spring-boot-starter-security`. A proteção é redirecionamento no cliente e filtro opcional por `unidadeId` — que, quando omitido, executa `findAll()` e **vaza todas as unidades** | Crítico |
| 3 | **CORS liberado para `*`** | `WebConfig.allowedOrigins("*")` | Alto, combinado com o item 2 |
| 4 | **Geração de id por `max(id)+1`** | Todos os services e o `proximoId` do Node | Alto — *race condition* sob concorrência; exige `IDENTITY`/`SEQUENCE` |
| 5 | **`horaInicio`/`horaFim` ignorados na detecção de conflito** | `ReservaService.validarDisponibilidade` e a regra equivalente do front | Médio — duas reservas no mesmo turno mas em horários diferentes são tratadas como conflito |
| 6 | **Exclusão de unidade sem checar referência** | `UnidadeService.excluir()` | **Corrigido** nesta frente (409 com a lista das coleções vinculadas) |
| 7 | **`turnos` duplicado** | `Sala.turnos` → `sala_turnos_legado` e `Sala.turnosDisponiveis` → `sala_turnos` | Médio — mesma informação em duas tabelas |
| 8 | **Não se registra quem decidiu uma solicitação** | `Solicitacao` não tem campo de responsável pela decisão (apesar de o diagrama UML mencionar `coordenador_id`) | Médio — auditoria impossível |
| 9 | **O backend não é consumido por nenhum cliente** | Nenhum código do web ou do mobile chama as rotas do Spring Boot | Alto — a API existe e está testada, mas o fluxo real usa o mock |
| 10 | **`SalaCard.tsx` morto no mobile** | `mobile/src/components/SalaCard.tsx` + `calcSalaInfo()` — importados por ninguém | Baixo — mantido porque exporta `Periodo`/`SalaInfo`, tipos usados por `salaStatus.ts` |
| 11 | **`noUnusedLocals` desligado** | `web/tsconfig.json` | Baixo — varredura de centenas de símbolos remanescentes |
| 12 | **Comportamento do `POST /api/sinc` divergente entre as duas APIs** | Spring recria a entidade; Node faz merge | **Mitigado** — o `salvar()` passou a repôr todos os campos. A diferença estrutural (recriar × mesclar) permanece |
| 13 | **Docker indisponível no host de validação** | `Dockerfile` e `compose.yaml` não foram *executados*, só validados por leitura | Baixo — o build da imagem e o `up` do Compose continuam não verificados de ponta a ponta |

> **Nota — pendência nº 13 desativada:** a limitação "o backend não compila localmente por causa do JDK 11" foi **superada**. Descobriu-se um Microsoft JDK 21.0.12.1 LTS em `C:\Users\<usuário>\.jdks\ms-21.0.12.1` (instalado pelo IntelliJ). Com `JAVA_HOME` apontando para lá, o Gradle 9.5.1 compila e executa a suíte completa: **50 testes, 0 falhas**. A seção 14 traz o resultado por suíte.

---

## 18. Como executar e validar

### 18.1 Pré-requisitos

| Componente | Versão |
|---|---|
| Node.js | 20 ou superior (validado em 24.16.0) |
| npm | 10 ou superior (validado em 12.0.2) |
| JDK | **21** (o projeto usa `toolchain { languageVersion = 21 }`) |
| Docker + Compose | v2 (para o `compose.yaml`) |
| Expo Go | para o mobile (não executado neste ambiente) |

> **Onde está o JDK 21 neste host:** `C:\Users\<usuário>\.jdks\ms-21.0.12.1` (Microsoft OpenJDK 21.0.12.1+1 LTS, instalado pelo IntelliJ). O `JAVA_HOME` do sistema aponta para o JDK 11 e o Gradle 9.5.1 também sobe no JDK 20 (`C:\Program Files\Java\jdk-20`) — mas a *toolchain* 21 só é resolvida pelo caminho acima. Para compilar e testar localmente:
>
> ```powershell
> $env:JAVA_HOME = 'C:\Users\<usuário>\.jdks\ms-21.0.12.1'
> cd backend\demo
> .\gradlew.bat test --console=plain --no-daemon
> ```
>
> O Gradle detecta a toolchain automaticamente (`gradlew -q javaToolchains` lista os JDKs encontrados).

### 18.2 Fluxo completo com Docker (recomendado)

```bash
cp .env.example .env          # ajuste SUPABASE_DB_* se for usar o Supabase
docker build -t conectasenac .
docker run --rm -p 8081:8081 --env-file .env conectasenac
```

A imagem serve **a API e a SPA na mesma porta (8081)**. O `compose.yaml` sobe Postgres, API e, opcionalmente, o mock:

```bash
docker compose up -d --build                        # postgres + api
docker compose --profile mock up -d server          # mock legado (3333)
```

### 18.3 Fluxo sem Docker

```bash
# Backend (porta 8081) — exige JDK 21
cd backend/demo && ./gradlew bootRun

# Web (porta 5173) — com a API em outro host
cd web && npm install
VITE_API_BASE=http://127.0.0.1:8081 npm run dev

# Mobile
cd mobile && npm install && npm run start
```

### 18.4 Comandos de validação

| Comando | Verifica |
|---|---|
| `cd web && npm run typecheck` | Tipagem do frontend (sem emitir arquivos) |
| `cd web && npm run build` | Tipagem **e** bundle de produção em `web/dist` |
| `cd mobile && npm run typecheck` | Tipagem do app nativo |
| `cd backend/demo && ./gradlew test` | As 6 suítes JUnit 5 |
| `cd backend/demo && ./gradlew bootJar` | Artefato do backend |
| `git fsck --no-progress` | Integridade do repositório |

### 18.5 Credenciais do seed (unidade 1001 — Asa Norte)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `Senac_GDF@Hotmail.com` | `Senac.DF2007` |
| Coordenador | `coord.asanorte@senacdf.com` | `Coord@123` |
| Instrutor | `katia.barros@senacdf.com` | `Inst@123` |
| Recepção | `recep.asanorte@senacdf.com` | `Recep@123` |

⚠️ São credenciais de **desenvolvimento**, presentes no seed. Em produção devem ser trocadas.

---

## 19. Anexo — mapa de commits

| Commit | Escopo |
|---|---|
| `18b27ed` | Ajusta build do frontend e do backend para o fluxo de entrega |
| `743e303` | Corrige a unidade de referência e unifica a API em um único backend |
| `3a48a05` | Reorganiza o monorepo e unifica os contratos de dados |
| `705bf40` | Atualiza conexão do frontend para produção |
| `8f1f5bb` | Corrige estrutura do backend e Dockerfile |
| `d8b27e0` | Reaplica alterações e sincroniza raiz |
| `235daea` | Atualiza estrutura do projeto |
| `aba34cd` | Sincroniza repositório raiz |
| `0ff7dbd` | Atualização final do repositório |
| `3632c26` | Atualização final do projeto |
| `48419de` · `589e7f1` · `2ae09e1` | Subindo versões do projeto |
| `184f21d` | Corrigindo sintaxe do Supabase no Web e finalizando `conecta_3.1` |
| `152ca58` | Finalizando projeto `conecta_3.1` com integração segura ao Supabase |
| `9c29a22` | Alteração de segurança |
| `8fb7a31` · `4d30351` | Substituindo projeto pelo `conecta_3.1` |

Os 15 commits anteriores a `3a48a05` foram **reescritos** pela expurgação de segredos — os SHA mudaram, e o conteúdo, não.

---

## 19.1. Inventário final

| Diretório | Arquivos versionados | Observação |
|---|---|---|
| `backend/` | 75 | Spring Boot 4.0.7 · 62 `.java` · 6 suítes JUnit 5 |
| `web/` | 65 | 32 `.ts` · 7 HTML · 20 CSS · 1 imagem |
| `mobile/` | 32 | Expo 51 · 24 `.ts`/`.tsx` |
| `docs/` | 6 | Este relatório e os documentos de arquitetura |
| `server/` | 4 | Mock legado (Node, sem dependências) |
| `scripts/` | 2 | Verificação e limpeza do monorepo |
| `.github/` | 1 | `ci.yml` |
| raiz | 8 | `.dockerignore` · `.env.example` · `.gitattributes` · `.gitignore` · `compose.yaml` · `Dockerfile` · `README.md` |
| **Total** | **192** | |

---

*Documento gerado em 19 de outubro de 2026. Nenhum conteúdo foi enviado ao GitHub: o `origin` está configurado, os 18 commits são locais, e o push requer `--force-with-lease` por causa da reescrita de histórico.*


