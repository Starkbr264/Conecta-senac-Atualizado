# Arquitetura Atualizada — Conecta-Senac

> Documento de referência técnica. Substitui as referências a caminhos antigos
> que existiam em `README.md` e `DOCUMENTACAO_CONEXAO_WEB_MOBILE.txt`.
> Última atualização: reorganização do monorepo + migração do web para
> TypeScript + refatoração estrutural do backend Spring Boot.

---

## 1. Visão geral

O repositório é um monorepo com **quatro** componentes independentes. Nenhum
frontend consome as rotas do backend Spring Boot: web e mobile falam com o
servidor Node (`server/`), que é a fonte da verdade em desenvolvimento.

```
conecta-senac/
├── backend/demo/          API Spring Boot 4 + JPA -> Postgres/Supabase
├── mobile/                Expo 51 / React Native 0.74 (TypeScript)
├── server/                Servidor de dados Node (CommonJS, sem deps)
│   └── data/db.json       Persistencia (fonte da verdade em dev)
├── web/                   Frontend web (TypeScript + Vite)
├── docs/                  Este documento e os casos de uso
├── Dockerfile             Imagem unica: Spring Boot servindo o frontend
├── compose.yaml           Stack de desenvolvimento (postgres + api + server)
└── .env.example           Variaveis de ambiente (sem segredos no repo)
```

### Mapa de portas e responsabilidades

| Componente | Porta | Tecnologia | Persiste em |
|---|---|---|---|
| `backend/demo` | 8081 | Spring Boot 4.0.7 / JPA / Java 21 | Postgres (Supabase por padrão) |
| `server` | 3333 | Node puro (`http`, `fs`, `path`) | `server/data/db.json` |
| `web` (dev) | 5173 | Vite dev server | — (bundle em memória) |
| `web` (build) | — | Vite build -> `web/dist/` | `web/dist/` |
| `mobile` | — | Expo / Metro | AsyncStorage no aparelho |

---

## 2. Árvore do frontend web

```
web/
├── index.html  login.html  dashboard.html
├── admin.html  coordenador.html  instrutor.html  recepcao.html
├── public/                 Copiado verbatim para dist/ (sem hash no nome)
│   ├── css/                20 folhas; main.css é o ponto de entrada
│   │                       (@import dos demais)
│   └── img/senac-logo-sem-fundo.webp
├── src/
│   ├── types/
│   │   ├── index.ts        CONTRATO UNICO (entidades, DTOs, rede)
│   │   └── vite-env.d.ts   Tipagem de import.meta.env
│   ├── core/               10 modulos compartilhados
│   │   ├── api.ts          Cliente HTTP + modo mock/producao + timeout
│   │   ├── auth.ts         requirePerfil, seJaLogado, sair, initSidebar
│   │   ├── dom.ts          byId/tryById/on/qsa com tipagem por elemento
│   │   ├── filters.ts      Busca + selects de filtro (ex search.js)
│   │   ├── format.ts       escapeHtml, fmtData, calcStatus, htmlStatus
│   │   ├── globals.ts      installGlobals -> Object.assign(window, ...)
│   │   ├── refresh.ts      atualizarSecao (spinner + recarga)
│   │   ├── storage.ts      CACHE, getters, CRUD, sincronizacao
│   │   ├── theme.ts        Sessao (sessionStorage) e tema (localStorage)
│   │   └── ui.ts           toast, fmsg, showMsg, modalAbrir/Fechar
│   ├── entry/              1 arquivo por pagina HTML
│   │   ├── admin.ts  home.ts  login.ts  dashboard.ts
│   │   └── coordenador.ts  instrutor.ts  recepcao.ts
│   └── features/           Modulos por funcionalidade
│       ├── admin/          admin.ts
│       ├── calendario/     calendario.ts
│       ├── coordenador/    coordenador.ts
│       ├── dashboard/      dashboard.ts disponibilidade.ts reservas.ts
│       │                   salas.ts turmas.ts
│       ├── home/  login/  instrutor/  recepcao/
│       └── ...
```

### Contrato único de tipos

`web/src/types/index.ts` e `mobile/src/types/index.ts` descrevem **as mesmas
entidades**, com o mesmo nome de propriedade e a mesma opcionalidade. As três
fontes de verdade, em ordem de precedência:

1. **`server/seed.js`** — o que o servidor Node realmente persiste e devolve.
2. **`backend/demo/.../model/`** — entidades JPA e `dto/`.
3. **Legado** — campos que existem no web e nao em nenhum backend
   (`Reserva.reservadoPorId`, `Reserva.solicId`, `Notificacao.mensagem`).

> Regra de ouro: **nenhum nome de propriedade pode mudar**. Alinhar tipagem e
> opcionalidade e permitido; renomear chaves nao.

---

## 3. Fluxo de inicializacao de uma pagina

```
1. <script type="module" src="/src/entry/<pagina>.ts">   (no HTML)
2. entry importa os modulos de core/ e features/
3. installGlobals(...)   ->  Object.assign(window, modulos)
4. void init<Pagina>()   ->  bootstrap assincrono da feature
```

`installGlobals` existe porque o HTML preserva **91 handlers inline**
(`onclick`, `onchange`, `oninput`) herdados do codigo original. Publicar as
funcoes em `window` e o equivalente mecanico dos antigos `<script>` classicos,
o que garante **paridade comportamental de 100%** sem reescrever o HTML.

A ordem dos argumentos de `installGlobals` reproduz a ordem dos `<script>` de
cada pagina original, para que sobreposicoes de nome (ex.: `initLogo` existe
em `core/auth.ts` e em `features/dashboard/dashboard.ts`) resolvam exatamente
como antes.

### Mapa de rastreabilidade

| Pagina | Entry | Feature principal | Core |
|---|---|---|---|
| `index.html` | `entry/home.ts` | `features/home/home.ts` | `storage`, `theme` |
| `login.html` | `entry/login.ts` | `features/login/login.ts` | `storage`, `auth`, `theme` |
| `dashboard.html` | `entry/dashboard.ts` | `features/dashboard/*` (5 arquivos) | `storage`, `auth`, `filters` |
| `admin.html` | `entry/admin.ts` | `features/admin/admin.ts` | `storage`, `calendario`, `auth`, `filters`, `theme`, `refresh` |
| `coordenador.html` | `entry/coordenador.ts` | `features/coordenador/coordenador.ts` | + `ui` |
| `instrutor.html` | `entry/instrutor.ts` | `features/instrutor/instrutor.ts` | + `ui` |
| `recepcao.html` | `entry/recepcao.ts` | `features/recepcao/recepcao.ts` | + `ui` |

---

## 4. Backend Spring Boot — camadas

```
backend/demo/src/main/java/conecta/demo/
├── config/WebConfig.java          Unico @Configuration (CORS)
├── controller/                    Apenas contrato HTTP
├── dto/                           Records de entrada/saida
├── exception/                     ApiExceptionHandler + 2 excecoes
├── model/                         12 entidades JPA
├── repository/                    9 repositorios Spring Data
└── service/                       Regra de negocio
```

**Principio aplicado:** o controller mapeia verbo + caminho + corpo; o service
carrega a logica; a exception traduz erro para HTTP. Nenhum controller fala
diretamente com repositorio.

| Controller | Linhas | Service | Rotas |
|---|---|---|---|
| `AuthController` | 29 | `AuthService` | `POST /api/login` |
| `DadosController` | 25 | `DadosService` | `GET /api/dados` |
| `NotificacaoController` | 35 | `NotificacaoService` | `GET /api/notificacoes`, `POST /api/notificacoes/{id}/lida` |
| `SincController` | 54 | `SincService`, `AuthService` | `POST /api/sinc`, `POST /api/reset`, `GET|POST /api/sessao`, `POST /api/logout` |

### Consolidacao do CORS

`CorsConfig.java` e `WebConfig.java` registravam **a mesma** mapping
`/api/**`. Como o `WebMvcConfigurerComposite` aplica os configuradores em
sequencia e a segunda mapping sobrescreve a primeira, o efetivo era o do
`WebConfig` (com `allowedHeaders("*")`). A consolidacao preserva exatamente
essa configuracao efetiva e remove `CorsConfig.java`.

```java
registry.addMapping("/api/**")
        .allowedOrigins("*")
        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
        .allowedHeaders("*");
```

> **Pendencia de seguranca:** `allowedOrigins("*")` sem autenticacao
> significa que qualquer origem pode chamar a API. Ver §7.

### Contratos HTTP inalterados

Nenhuma rota, verbo, parametro ou corpo de resposta foi alterado na
refatoracao. `ApiExceptionHandler` continua traduzindo
`RecursoNaoEncontradoException` -> 404, `RegraDeNegocioException` -> 409 e
`MethodArgumentNotValidException` -> 400. `SeedService` nao foi tocado.

---

## 5. Modo Mock vs Modo Producao

O repositorio mantem **duas** camadas de persistencia com o **mesmo** contrato
HTTP. A selecao agora e explicita, nao implicita na URL.

| | Modo MOCK | Modo PRODUCAO |
|---|---|---|
| Componente | `server/` (Node puro) | `backend/` (Spring Boot) |
| Persistencia | `server/data/db.json` | Postgres / Supabase |
| Porta | 3333 | 8081 |
| Consumidores | web + mobile | nenhum frontend hoje |
| Padrao do web | nao | `https://conecta-senac.onrender.com` |

### Web — `web/src/core/api.ts`

Ordem de resolucao da base:

1. `window.__CONECTA_API_BASE__` (injetado em runtime)
2. `VITE_API_BASE` do build — token `same-origin` = mesma origem
3. host de producao

Resolucao do modo (`MODO_API: 'mock' | 'producao'`):

1. `window.__CONECTA_MODO_API__` (runtime)
2. `VITE_MODO_API=mock|producao` (build)
3. inferencia: base em loopback -> `mock`; host publico -> `producao`

```bash
# Modo MOCK
VITE_API_BASE=http://127.0.0.1:3333 VITE_MODO_API=mock npm run build

# Modo PRODUCAO
VITE_API_BASE=https://api.exemplo.com VITE_MODO_API=producao npm run build

# Mesmo backend, sem digitar a URL (imagem Docker)
VITE_API_BASE=same-origin npm run build
```

> Use o token `same-origin`, **nao** string vazia: o Vite descarta variaveis
> com `""` e o `import.meta.env` gerado viraria `{}`.

### Mobile — `mobile/src/services/api.ts`

Resolucao da base: `extra.apiUrl` do `app.json`, senao o IP do host Metro +
`:3333`.

Resolucao do modo: `extra.modoApi` do `app.json`; senao inferido por host
loopback ou IP privado (RFC 1918) -> `mock`, host publico -> `producao`.

```jsonc
// app.json
{
  "expo": {
    "extra": {
      "apiUrl":  "http://192.168.0.20:3333",
      "modoApi": "mock"
    }
  }
}
```

### Por que `server/data/` continua versionado

`server/data/db.json` e o estado do servidor mock e esta no Git de proposito:
permite que um clone novo suba com dados de exemplo sem rodar seed. O
`.gitignore` do `server/` ignora apenas `data/*.tmp` (arquivos temporarios da
escrita atomica), nunca o `.json`.

---

## 6. Como executar

```bash
# 1. Servidor de dados (obrigatorio para web e mobile em dev)
node server/index.js                      # :3333

# 2. Frontend web
cd web && npm install && npm run dev      # :5173
npm run build                             # typecheck + vite build -> web/dist
npm run preview                           # serve web/dist

# 3. Mobile
cd mobile && npm install && npm run start

# 4. Backend Spring Boot (precisa JDK 21)
cd backend/demo && ./gradlew bootRun      # :8081

# 5. Stack completa via Docker
cp .env.example .env                      # preencha as senhas
docker build -t conectasenac .            # SEMPRE a partir da raiz
docker run --rm -p 8081:8081 --env-file .env conectasenac
docker compose up -d --build              # postgres 5432 + api 8081 + server 3333
```

### Imagem unica (API + frontend)

O `Dockerfile` tem 3 estagios: `node:20-alpine` compila o Vite,
`gradle:jdk21` gera o `bootJar` e **injeta `web/dist` em
`BOOT-INF/classes/static/`** do jar. Como nenhum handler de recursos estaticos
e registrado no Spring, vale o default `classpath:/static/` — o frontend passa
a ser servido na mesma origem da API **sem alterar uma linha do backend**.

---

## 7. Pendencias conhecidas

Algumas correcoes foram aplicadas nesta frente (ver secao 7.1). As pendencias
restantes mudam comportamento ou exigem decisao de produto.

| # | Achado | Impacto |
|---|---|---|
| 1 | `SincService.salvar()` nao repõe, em `salas`: `turnos`, `turnosDisponiveis`, `statusManual`, `motivoManual`, `manualPor`, `manualCriadaEm`, `ativa`; e em `reservas`: `horaInicio`, `horaFim`, `avulsa` | **`POST /api/sinc` perde dados silenciosamente** |
| 2 | Senhas em texto puro em `usuarios.senha` | **RESOLVIDO parcialmente** — BCrypt implementado (SeedService + UsuarioService), `@JsonIgnore` remove senha do JSON. Pendente: frontend offline cache ainda pode ter senhas em texto puro |
| 3 | CORS liberado para `*` sem autenticacao | **RESOLVIDO** — `allowedOriginPatterns` restrito a Vercel + localhost. Spring Security adicionado com JWT |
| 4 | Ids gerados com `max(id)+1` (sem sequence) | Colisao sob concorrencia |
| 5 | `horaInicio`/`horaFim` existem mas nao entram na deteccao de conflito | Reserva sobreposta no mesmo horario |
| 6 | `delUnidade` nao verifica salas/turmas/usuarios apontando para a unidade | Registro orfao |
| 7 | `Salas` mantem `turnos` e `turnosDisponiveis` em tabelas separadas | Informacao duplicada |
| 8 | Nada registra **quem** decidiu uma solicitacao | Sem rastreabilidade |
| 9 | Backend Spring nao e consumido por nenhum frontend | Duas camadas de dados divergentes |

### 7.1 RLS no banco do Supabase — CORRIGIDO

O item 2 era agravado por um furo **no banco**: com RLS desligado, o role
`anon` (o da chave publica) tinha `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` sobre
as 15 tabelas de `public`. Bastava a chave publica para ler as senhas, alterar
e apagar o banco pela API REST do Supabase — sem nem passar pela API Spring.

**Correcao:** `backend/demo/sql/rls-public.sql` habilita RLS nas 15 tabelas e
revoga os grants de `anon`/`authenticated`. Com RLS ligado e sem politicas o
Postgres nega tudo para quem nao e owner; o app nao e afetado, porque o
backend conecta como `postgres` (owner, `rolbypassrls = t`).

Verificado medindo o comportamento antes e depois:

| Operacao como `anon` | Antes | Depois |
|---|---|---|
| `SELECT count(*) FROM usuarios` | 42 linhas | `permission denied` |
| `SELECT email, senha FROM usuarios` | senhas expostas | `permission denied` |
| `DELETE FROM usuarios` | permitido | `permission denied` |
| `INSERT INTO unidades` | permitido | `permission denied` |

O item 2 **continua aberto** no escopo da aplicacao: o RLS protege o banco
contra a chave publica, mas `GET /api/dados` e `GET /api/usuarios` ainda
devolvem as senhas em texto puro para quem chamar a API Spring (que hoje
nao exige autenticacao — item 3).

---

## 8. Referencias

| Documento | Assunto |
|---|---|
| `docs/CASO_DE_USO.md` | 15 casos de uso e regras de negocio |
| `docs/RELATORIO_REFATORACAO.md` | O que mudou na migracao e por que |
| `docs/DOCUMENTACAO_CODIGO.md` | Estrutura do codigo legado original |
| `docs/DOCUMENTACAO_CONEXAO_WEB_MOBILE.txt` | Protocolo de sincronizacao |
| `README.md` (raiz) | Quick start |