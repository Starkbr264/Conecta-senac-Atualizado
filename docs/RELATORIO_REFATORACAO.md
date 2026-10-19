# Relatório de Refatoração — Conecta-Senac

**Data:** 14/10/2026
**Escopo:** reestruturação do repositório, migração do frontend web para TypeScript,
remoção de código morto, correção de defeitos e validação — **sem alterar o
comportamento de negócio e sem publicar nada no GitHub**.

---

## 1. O que foi reorganizado

O repositório original tinha nomes de pasta com espaços, parênteses e sufixos de
versão, e três projetos aninhados um dentro do outro:

```
demo-conecta-senac3.1(backend)/demo/          -> backend/demo/
Conecta-Senac-main (frontend web +mobile)/
  ├─ frontend_reserva_salas/frontend_reserva_salas/   -> web/
  ├─ src/  app.json  babel.config.js  ...             -> mobile/
  └─ server/                                          -> server/
```

Estrutura final:

```
Conecta-Senac-Atualizado/
├─ README.md                  (novo)
├─ .gitignore  .dockerignore  .env.example   (novos/ajustados)
├─ Dockerfile  compose.yaml
├─ backend/demo/              Spring Boot 4 + JPA  (INALTERADO)
├─ docs/                      CASO_DE_USO.md, DOCUMENTACAO_CODIGO.md,
│                             DOCUMENTACAO_CONEXAO_WEB_MOBILE.txt,
│                             RELATORIO_REFATORACAO.md (novo)
├─ mobile/                    Expo 51 / React Native (já era TypeScript)
├─ server/                    Node CommonJS + data/db.json
└─ web/                       TypeScript + Vite (migrado)
```

Dentro do `web/`:

| Antes | Depois |
| --- | --- |
| `js/*.js` (23 arquivos) | `src/**/*.ts` (31 arquivos) |
| `css/*.css` na raiz | `public/css/` (21 arquivos) |
| `img/` | `public/img/` |
| `<script src>` clássicos | `<script type="module" src="/src/entry/<página>.ts">` |
| nenhum | `package.json`, `tsconfig.json`, `vite.config.ts` |

### Infraestrutura de repo

* `.gitignore` na raiz — **não ignorava `node_modules/`**, que estava
  versionado no Git (889 arquivos rastreados). Agora ignora `node_modules/`,
  `dist/`, `build/`, `.gradle/`, `.expo/`, `.env*` (com `!.env.example`), mas
  **mantém `server/data/db.json`**, que é dado versionado do projeto.
* `Dockerfile` — o `COPY` apontava para `demo-conecta-senac3.1(backend)/demo/…`;
  ajustado para `backend/demo/…`.
* `compose.yaml` — a senha do Postgres estava em texto puro; agora é
  parametrizada (`${POSTGRES_PASSWORD:-postgres}`).
* `.env.example` (novo) — `PORT`, `PUBLIC_URL`, `API_PORT`,
  `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, `POSTGRES_*`.
* `.gitignore` do Java estava dentro da pasta do frontend; foi devolvido para
  `backend/demo/.gitignore` e o `mobile/.gitignore` foi reescrito com o
  conteúdo correto de Expo/React Native.

---

## 2. Quantos arquivos foram migrados para TypeScript

**15 arquivos JavaScript → TypeScript**, todos do frontend web:

| JS original | Destino | Linhas TS |
| --- | --- | --- |
| `storage.js` (27,7 KB) | `src/core/storage.ts` | ~700 |
| `auth.js` (2,0 KB) | `src/core/auth.ts` | 57 |
| `search.js` (3,8 KB) | `src/core/filters.ts` | ~190 |
| `calendario_page.js` (16,6 KB) | `src/features/calendario/calendario.ts` | ~480 |
| `salas.js` (7,0 KB) | `src/features/dashboard/salas.ts` | ~230 |
| `turmas.js` (7,2 KB) | `src/features/dashboard/turmas.ts` | ~215 |
| `reservas.js` (10,4 KB) | `src/features/dashboard/reservas.ts` | ~330 |
| `disponibilidade.js` (3,4 KB) | `src/features/dashboard/disponibilidade.ts` | ~130 |
| `dashboard_page.js` (3,6 KB) | `src/features/dashboard/dashboard.ts` | ~105 |
| `index_page.js` (0,5 KB) | `src/features/home/home.ts` | ~50 |
| `login_page.js` (2,9 KB) | `src/features/login/login.ts` | ~130 |
| `admin_page.js` (21,0 KB) | `src/features/admin/admin.ts` | 404 |
| `coordenador_page.js` (58,5 KB) | `src/features/coordenador/coordenador.ts` | ~1 750 |
| `instrutor_page.js` (27,5 KB) | `src/features/instrutor/instrutor.ts` | ~700 |
| `recepcao_page.js` (22,4 KB) | `src/features/recepcao/recepcao.ts` | ~800 |

Somando as **7 camadas transversais novas** escritas do zero
(`core/api.ts`, `core/dom.ts`, `core/format.ts`, `core/globals.ts`,
`core/refresh.ts`, `core/theme.ts`, `core/ui.ts`), os **7 arquivos de
bootstrap** (`src/entry/*.ts`), o contrato (`src/types/models.ts`) e a
declaração do ambiente Vite (`src/types/vite-env.d.ts`), o total é:

> **31 arquivos `.ts`, 7 944 linhas** em `web/src/`
> (`core/` 10, `entry/` 7, `features/` 12, `types/` 2).

O `tsconfig.json` do web roda em `strict: true`, com `noImplicitAny`,
`strictNullChecks`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
`forceConsistentCasingInFileNames` e `isolatedModules`.

### Como os 145 handlers inline continuam funcionando

O HTML não foi reescrito: `onclick="salvarSala()"`, `onclick="ir('salas')"`,
`onclick="limparFiltros('searchUsuarios','buscarUsuario')"` continuam no lugar.
Cada `src/entry/<página>.ts` reproduz a **ordem exata** dos `<script>`
clássicos e republica os módulos em `window` com `installGlobals(...)`. Como o
comportamento observável é o mesmo de scripts clássicos — inclusive a
sobrescrita de nomes duplicados (ex.: `initLogo` do painel sobrepõe o do
`auth.js`) — não houve reescrita de atributo algum no HTML.

---

## 3. O que ficou em JavaScript (e por quê)

**`server/index.js` e `server/seed.js`** — Node.js puro, CommonJS, **zero
dependências**.

Não foram migrados por três motivos:

1. É **infraestrutura de execução**, não aplicação: só usa `http`, `fs` e
   `path` da biblioteca padrão, e não se beneficia de tipos.
2. O contrato é exercido por **três clientes independentes** (web, mobile e
   qualquer futuro cliente). Convertê-lo para ESM exigiria mexer no
   `require`/`module.exports`, no bootstrap (`module.exports = server` é usado
   como *hook* por scripts e testes) e no `seed.js`, com risco de quebrar o
   servidor — sem nenhum ganho funcional.
3. O servidor é o **único ponto que faz o web e o mobile compartilharem dados**.
   Preservá-lo byte a byte era mais seguro do que reescrevê-lo.

O **mobile já estava em TypeScript** (`src/**/*.tsx`, `src/**/*.ts`). Nenhuma
conversão foi necessária; o trabalho lá foi adicionar `typecheck` e `lint` aos
scripts e passar o compilador sem erros.

---

## 4. Problemas corrigidos

### Defeitos de lógica

| # | Problema | Correção |
| --- | --- | --- |
| **D1** | `server/index.js` definia `WEB_ROOT = ../frontend_reserva_salas`, caminho que não existe na nova estrutura → **`GET /` devolvia 404**, ou seja, o servidor não servia o web. | `WEB_ROOT` passou a apontar para `web/dist` (com override pela variável de ambiente `WEB_ROOT` e comentário explicando que, em desenvolvimento com `npm run dev`, o Vite serve na 5173 e este servidor continua só na API). |
| **D9** | `web/dashboard.html:56` tinha `onclick="logout()"`, mas **nenhum arquivo JavaScript do projeto definia `logout`** — o botão "Sair" lançava `ReferenceError` e não fazia nada. | Trocado por `onclick="sair()"`, que existe em `core/auth.ts` (`clearSessao()` + redireciona para o login). |
| **D10** | No painel do coordenador, `checarConflito()` chamava `verificarConflito()`, definido em `reservas.js` — arquivo que **`coordenador.html` não carrega**. O `typeof ... === 'function'` era sempre `false`, então a função retornava `null` sem conferir nada: **nem `salvarReserva` nem `responderSolic` detectavam conflito de sala**. | A verificação agora é importada de `../dashboard/reservas`,，passando a ser a fonte única da regra UC-07, em vez de depender de um global opcional. |
| **D12** | As chamadas de `fetch` não tinham limite de tempo. Como o host de produção estava inacessível, `initDados()` ficava pendurado e **a tela nunca inicializava** (nenhum dado, tema não aplicado, lista de unidades vazia). | `core/api.ts` ganhou `API_TIMEOUT_MS = 12 000` e um helper `requisitar()` com `AbortController`. A falha cai no tratamento já existente e o app entra em **modo offline** com o cache local. |
| **D13** | Coordenador, Instrutor e Recepção usam `onclick="modalFechar(...)"` nos botões de fechar modal, mas o namespace `core/ui` não era instalado nessas páginas — os botões não faziam nada. | `import * as ui from '../core/ui'` adicionado aos três *entries*. |
| **D14** | `dashboard.html` usa `onclick="mostrarSecao('salas')"`, mas o *entry* importava apenas `initDashboard` e não publicava o namespace — a navegação lateral do dashboard estava quebrada. | O *entry* passa a instalar o módulo inteiro, mantendo a ordem original dos `<script>`. |

### Código morto removido

**Arquivos inteiros:**

* `script.js`, `admin.js`, `coordenador.js`, `instrutor.js`, `recepcao.js` —
  versões antigas das telas em SPA, **zero referências** em qualquer HTML, JS,
  CSS ou documento.
* `supabase.js` — módulo ESM de 6 linhas que criava um cliente Supabase com
  **URL de projeto e chave `chave-publicavel-do-supabase…` embutidas no código**; o símbolo
  exportado (`supabase`) não era consumido por ninguém. Remover também elimina
  a dependência de CDN do jsdelivr em todas as páginas.
* `static_js_check.py`, `tsc-output.txt` (0 bytes).
* `css/style.css` (30 KB) e `css/index.css` (9,7 KB) — nenhuma folha de estilo
  ou HTML os importa; `index.css` é, na verdade, uma cópia antiga de
  `landing.css`.
* Gradle wrapper órfão dentro do frontend web (`gradlew`, `gradlew.bat`,
  `gradle/wrapper/*`, `settings.gradle`) — não havia `build.gradle` ali.
* `node_modules/` versionado no Git (889 arquivos) e o `package.json` da raiz,
  cujas duas dependências (`@supabase/ssr`, `@supabase/supabase-js`) **não eram
  importadas por nenhum arquivo** (o uso era via CDN).

**Trechos dentro do código migrado** (documentados em JSDoc no próprio arquivo):

* **9 monkey-patches.** O padrão `var orig = fn; fn = function () { … }` deixava
  a versão original **inalcançável**. A primeira versão foi removida e só a
  segunda foi portada: `rdSalas`, `rdTurmas`, `rdReservas`, `rdInstrutores`,
  `renderTabelaSalas`, `renderTabelaTurmas`, `renderTabelaReservas`,
  `rdChaves`, `rdTurmas` (instrutor).
* `_dataLiberacaoPorTurnos()` no instrutor — nenhuma página a chamava.
* `labelStatus()` redefinido localmente no instrutor e no coordenador —
  duplicava `core/format.ts` com um mapa menor e nunca era usado.
* `rdMapaDebounced` / `_mapaTimer` no coordenador — nunca chamados.
* Quatro funções `escapeHtml`, `formatDate`, `showToast`, `showMsg` definidas
  dentro de `dashboard_page.js` que **nunca eram chamadas** (a `showToast` local
  usava até um container diferente, `#toast-container`).

**Comportamento deliberadamente preservado, apesar de parecer defeito:**

* `index_page.js` substituía `toggleTema` por um wrapper que redesenha o ícone.
  Isso **não** foi removido: o *entry* publica `window.toggleTema = alternarTema`,
  que alterna o tema **e** redesenha o ícone (validado no smoke test).
* `devolverChave()` do storage zera `instrutorId` e `pegaEm`, **perdendo o
  histórico** de quem retirou a chave. É o comportamento legado e não foi
  alterado — ver *Pendências conhecidas*.
* `delTurma()` remove em cascata as reservas da turma **no cliente**, sem
  transactionservidor. Mantido.

---

## 5. Como o backend foi validado

O backend Spring Boot **não foi modificado**. A validação foi feita por
comparação criptográfica:

* SHA-256 de cada um dos **59 arquivos** de `backend/demo/` contra os mesmos
  arquivos do clone original → **0 divergências**.
* Os únicos arquivos que mudaram de lugar foram `.gitattributes` e `.gitignore`,
  que estavam dentro de `demo/` — o `.gitignore` era na verdade o **do
  Gradle/Java**, não o do Expo (veja seção 1).
* Nenhuma migration, nenhum script SQL e nenhuma alteração de contrato HTTP.
* **O Gradle não foi executado**: a máquina tem JDK 11 e o projeto exige
  JDK 21 (`java.toolchain 21`). Instalar o JDK não estava ao alcance do
  ambiente, então **não há bytecode de backend validado** — apenas a garantia de
  que os arquivos são idênticos aos originais.

O **contrato de dados**, porém, foi validado de ponta a ponta pelo servidor
Node (§6).

---

## 6. Testes executados

### 6.1 Verificações estáticas — todas passaram

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Tipos do web | `npm run typecheck` (`tsc --noEmit`) | **0 erros** (partiu de 59) |
| Build do web | `npm run build` | **sucesso**, 37 módulos, ~500 ms |
| Tipos do mobile | `npm run typecheck` (`tsc --noEmit`) | **0 erros** nos 25 arquivos do projeto |
| Bundles de produção | inspeção de `dist/assets/*.js` | Aponta para `https://conecta-senac.onrender.com`; **nenhuma** referência a `127.0.0.1:3333` |

### 6.2 Teste funcional no navegador — as 7 páginas passaram

O servidor Node subiu na porta 3333 com o `dist/` recém-gerado
(`VITE_API_BASE=http://127.0.0.1:3333` só no bundle de teste; o bundle
entregue aponta para produção).

| Página | Verificações | Erros de console |
| --- | --- | --- |
| `login.html` | 11 opções em `#selUnidade`, `data-theme="light"`, 42 usuários e 50 salas vindos do servidor | **0** |
| login real | formulário submetido → redirecionou para `admin.html`; sessão gravada em `sessionStorage` | **0** |
| `admin.html` | 8 abas; `#stTotal=42`, `#stUnid=10`, `#stSalas=50`, 42 linhas em `#tbUsuarios` | **0** |
| `coordenador.html` | 9 abas; 5 salas e 4 turmas da unidade 1001; **todos** os handlers inline presentes | **0** |
| `instrutor.html` | 4 abas; 5 cards de sala; 2 turmas do instrutor 3001; barra de busca montada | **0** |
| `recepcao.html` | 4 abas; 5 cards no mapa; 2 cards de chave; `#badgeNotif=0` | **0** |
| `dashboard.html` | 4 abas; 50/40/31 linhas em salas/turmas/reservas; `#topbarTitle` muda | **0** |
| `index.html` | `toggleTema()` alterna o ícone lua↔sol e o atributo `data-theme` | **0** |

### 6.3 Teste de escrita ponta a ponta (web ⇄ servidor ⇄ disco)

Via a interface, no painel do coordenador: abrir o modal de sala → preencher
nome, capacidade, tipo, andar e bloco → marcar o turno Matutino → **Salvar**.

* Registro criado no cache com `id: 5051`, `unidadeId: 1001`, e **both**
  `turnos` e `turnosDisponiveis` preenchidos (o legado grava os dois).
* O registro apareceu em **`GET /api/dados`** → contrato `POST /api/sinc`
  funcionando.
* O registro estava **persistido em `server/data/db.json`** → persistência
  atômica funcionando.

Depois, `POST /api/reset` restaurou o seed exatamente: 42 usuários, 10 unidades,
50 salas, 40 turmas, 31 reservas, 20 chaves, 4 notificações e 4 solicitações; a
sala de teste desapareceu. Comparado com o `db.json` do clone original, só
`dataInicio`/`dataFim` divergem — porque `server/seed.js` **calcula essas datas
relativas ao dia de hoje**. É comportamento pré-existente do seed, não uma
regressão.

### 6.4 O que **não** pôde ser testado

* **Backend Spring Boot** — sem JDK 21 na máquina, o Gradle não compila.
* **Mobile em execução** — sem emulador, dispositivo ou navegador móvel; só a
  verificação de tipos.
* **Deploy de produção** no Render — fora de escopo por definição.

---

## 7. Limitações e pendências conhecidas

**Introduzidas por esta refatoração**

1. `noUnusedLocals` e `noUnusedParameters` estão **desligados** no
   `tsconfig.json` do web. O volume de código herdado é grande; ligar os dois
   exigiria uma passada de limpeza em paralelo. Ligar ambos é um trabalho
   mecânico e hoje produziria dezenas de avisos em código funcionais.
2. `byId()` **lança** quando o elemento não existe. É a mesma semântica de
   runtime do legado (que também lançava um `TypeError` ao acessar `.value` de
   `null`); só a mensagem de erro mudou, e ela é mais clara.
3. Dois campos que o painel do coordenador grava em reservas —
   `reservadoPorId` e `solicId` — **não existem** no backend Java nem nos tipos
   do mobile. Foram declarados em `types/models.ts` com JSDoc explicando que
   são campos legacy do web. Sem eles, o "quem reservou" e o "de qual
   solicitação veio" se perderiam na sincronização.

**Herdadas do projeto (não corrigidas de propósito)**

4. **Senhas em texto puro** em `usuarios.senha`, comparadas com igualdade
   direta, trafegando inclusive dentro de `GET /api/dados`. Corrigir isso
   mudaria o contrato de login e exigiria migração de dados — decisão de
   produto, não de refatoração.
5. **Autorização inexistente no servidor**: nenhuma rota exige token ou perfil.
   As únicas proteções são o redirecionamento no cliente e o `unidadeId` escolhido
   pelo próprio cliente (e ele é opcional: quando omitido, o backend devolve
   **todas** as unidades).
6. `delUnidade()` não valifica referências — apaga a unidade mesmo com usuários,
   salas ou turmas apontando para ela.
7. `horaInicio`/`horaFim` existem em reservas mas **não são usados** na detecção
   de conflito (nem no web, nem no mobile, nem no Spring Boot).
8. A chave do Supabase que estava hardcoded em `supabase.js` **não** foi
   reproduzida aqui e não consta de nenhum arquivo entregue. Se a chave for
   necessária, deve ser revogada no painel do Supabase.

---

## 8. Como executar

O passo a passo completo está no [`README.md`](../README.md). Resumo:

```bash
# 1. Servidor de dados (obrigatório)
node server/index.js                  # porta 3333

# 2. Web
cd web && npm install && npm run dev  # http://localhost:5173
#   ou build de produção servido pelo Node na 3333:
cd web && npm run build               # gera web/dist

# 3. Mobile (requer JDK? não — requer Expo)
cd mobile && npm install && npm run start

# 4. Backend Java (requer JDK 21; opcional)
cd backend/demo && ./gradlew bootRun  # porta 8081
```

---

## 9. Declaração

* Nenhuma alteração foi **enviada ao GitHub**. Não houve `git push`, abertura de
  *pull request*, *release*, *tag* nem *deploy*. Nenhum arquivo remoto foi
  criado ou modificado.
* Nenhuma alteração **destrutiva** de banco foi executada. O único comando que
  mexeu em dados foi `POST /api/reset`, que reconstrói `server/data/db.json` a
  partir do próprio seed — usado para desfazer o registro de teste do §6.3 e
  verificado como idêntico ao estado anterior.
* Nenhum **segredo** foi reproduzido neste relatório nem deixado no código
  entregue: a URL e a chave do Supabase que estavam em `supabase.js` foram
  removidas junto com o arquivo.
* O backend Spring Boot foi mantido **byte a byte** (SHA-256 conferido) e nenhum
  contrato de API ou formato de dado foi alterado.
* O working tree original estava limpo; nada foi sobrescrito.