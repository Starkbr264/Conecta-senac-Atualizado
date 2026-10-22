# Conecta-Senac

Sistema de reserva de salas, turmas e chaves do SENAC GDF.
Projeto integrador — instrutora **Rayssa Paiva Carvalho**, aluno **Enzo Aragão Lages**.

O repositório reúne **quatro componentes independentes**:

| Componente | Pasta | Tecnologia | Papel |
| --- | --- | --- | --- |
| Frontend Web | `web/` | TypeScript + Vite 5 | telas para Admin, Coordenador, Instrutor e Recepção |
| Aplicativo Mobile | `mobile/` | Expo 51 / React Native 0.74 / expo-router | app Android/iOS do instrutor e da recepção |
| API Java | `backend/demo/` | Spring Boot 4 + JPA + PostgreSQL | **fonte da verdade dos dados** (Postgres/Supabase) |
| Servidor de dados (mock legado) | `server/` | Node.js puro (CommonJS, sem dependências) | persistência em `server/data/db.json` — **apenas desenvolvimento offline** |

---

## Fonte da verdade dos dados

**A API Spring Boot (`backend/demo/`, porta 8081) é a fonte única de verdade.**
Ela roda contra o PostgreSQL do Supabase e serve também o frontend web na mesma
origem.

O servidor Node (`server/`, porta 3333) é o **mock legado**: mantém o mesmo
contrato HTTP, mas persiste em `server/data/db.json` e serve para
desenvolvimento offline, sem Docker e sem JDK. As duas camadas **não devem
rodar ao mesmo tempo sobre o mesmo cliente** — bases separadas (JSON ×
Postgres) e qualquer sincronização entre elas corrompe os dados.

Endpoints usados pelos dois frontends (idênticos nas duas camadas):

```
GET  /api/dados      POST /api/sinc      POST /api/login
GET  /api/sessao     POST /api/sessao    POST /api/logout
POST /api/reset
```

---

## Como executar

### 1. Frontend Web (desenvolvimento)

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

Outros scripts:

```bash
npm run typecheck    # tsc --noEmit  (strict)
npm run build        # typecheck + vite build  -> web/dist
npm run preview      # serve o web/dist recém-gerado
```

O bundle gerado por `npm run build` é o que o servidor publica em
`http://localhost:3333` (raiz `web/dist`). **Sem rodar o build, o servidor
responde apenas na API** — para a interface nesse caso, use `npm run dev`.

**Apontar para outro backend.** Por padrão o web usa
`https://conecta-senac.onrender.com`. Para desenvolvimento local:

```bash
VITE_API_BASE=http://127.0.0.1:3333 npm run build     # mock legado
VITE_API_BASE=same-origin       npm run build         # mesma origem da página
```

A resolução é, em ordem: `window.__CONECTA_API_BASE__` (injetado em runtime) →
variável `VITE_API_BASE` do build → host de produção. O token **`same-origin`**
expande para `window.location.origin` (é o padrão do `Dockerfile`). Use esse
token em vez de string vazia: o Vite descarta variáveis de ambiente com valor
`""` e o `import.meta.env` gerado viraria `{}`. Se a API não responder em 12 s
(configurável por `VITE_API_TIMEOUT_MS`), o web cai para **modo offline** usando
o cache local.

### 2. Aplicativo Mobile

```bash
cd mobile
npm install
npm run start        # abre o Expo (leitor de QR / web)
npm run android
npm run ios
npm run typecheck    # tsc --noEmit
```

Para apontar o app para um backend, use `app.json`:

```json
"expo": { "extra": { "apiUrl": "http://192.168.0.10:8081", "modoApi": "producao" } }
```

ou variáveis de ambiente do Expo (precedência: `app.json` → env → descoberta
automática do host pelo Metro):

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.10:8081
EXPO_PUBLIC_API_PORT=8081
EXPO_PUBLIC_MODO_API=producao
```

A porta padrão do mobile é **8081** (Spring Boot). Para o mock legado, use
`EXPO_PUBLIC_API_PORT=3333`. Sem servidor, o app opera em **modo offline** com
o cache do `AsyncStorage`.

### 3. Backend Java + Web (Docker, o caminho recomendado)

O `Dockerfile` da raiz é **multi-stage** e produz **uma única imagem** que
sobe a API Spring Boot *e* serve o frontend na mesma origem. Como o backend não
registra nenhum handler de recursos estáticos, o bundle do Vite é injetado em
`BOOT-INF/classes/static/` dentro do jar — **nenhuma linha do backend é
alterada**.

#### 3.1. Imagem única

```bash
cp .env.example .env        # preencha as credenciais
docker build -t conectasenac .                       # SEMPRE a partir da RAIZ
docker run --rm -p 8081:8081 --env-file .env conectasenac
# API  -> http://localhost:8081/api/...
# Web  -> http://localhost:8081/
```

Para gerar a imagem apontando o frontend para outro host:

```bash
docker build --build-arg VITE_API_BASE=https://api.exemplo.com -t conectasenac .
```

#### 3.2. Stack completa com Docker Compose

```bash
cp .env.example .env
# EDITE o .env: POSTGRES_PASSWORD=<senha forte>   (OBRIGATÓRIO, sem valor de exemplo)
docker compose up -d --build
# postgres -> 5432   api (Spring Boot + web) -> 8081
```

O `compose.yaml` sobrescreve a URL do datasource por variável de ambiente
(`SPRING_DATASOURCE_URL`), então o serviço `api` conversa com o Postgres local
sem precisar editar `application.properties`.

**A API e o Postgres desta stack usam a MESMA senha** (`POSTGRES_PASSWORD`).
O `compose.yaml` passa esse valor para os dois lados — o serviço `postgres`
cria o role, e o serviço `api` conecta com ele. Não existe segunda senha para
trocar, o que elimina a divergência de credenciais que fazia o container da
API entrar em *crash loop*.

> ⚠️ **A senha do Postgres só é aplicada na PRIMEIRA inicialização do volume.**
> Se você já subiu a stack e agora troca `POSTGRES_PASSWORD` no `.env`, a senha
> do banco **não muda** — o `docker-entrypoint.sh` do Postgres só aplica
> `POSTGRES_PASSWORD` quando o volume `pg_data` está vazio. Recrie o volume:
>
> ```bash
> docker compose down -v        # -v apaga o volume (o banco é recriado do zero)
> docker compose up -d --build
> ```
>
> Sem `-v`, a stack continua usando a senha antiga e a API volta a falhar com
> `password authentication failed`.

Depois de subir, semeie os dados de exemplo (o banco começa vazio):

```bash
curl -X POST http://localhost:8081/api/reset
# -> 10 unidades, 42 usuários, 50 salas, 40 turmas, 31 reservas, 20 chaves,
#    4 notificações, 4 solicitações
```

Para subir o **mock legado** (servidor Node) em vez da API real:

```bash
docker compose --profile mock up -d server           # -> http://localhost:3333
```

O serviço `server` fica atrás do perfil `mock` justamente para que as duas
camadas não subam juntas por accident.

**Falha rápida em vez de crash loop.** Duas guardas impedem que um `.env` mal
preenchido chegue a um container reiniciando em loop:

| Onde | Quando dispara | O que você vê |
| --- | --- | --- |
| `compose.yaml` (`${POSTGRES_PASSWORD:?...}`) | a variável está **vazia** | o Compose **aborta na hora de subir**, com a mensagem "POSTGRES_PASSWORD e obrigatorio" |
| `Dockerfile` (`ENTRYPOINT`) | a senha ainda é o **valor de exemplo** (`SEU_*`, `SUA_*`, `changeme*`…) | o container **para com a mensagem** "a senha do Postgres ainda e o valor de exemplo do .env.example" |

#### 3.3. O que o Dockerfile faz (3 estágios)

| Estágio | Imagem | O que faz |
| --- | --- | --- |
| 1/3 `web-build` | `node:20-alpine` | `npm ci` → `npm run build` (roda o `typecheck` antes) → `web/dist` |
| 2/3 `api-build` | `gradle:jdk21` | `./gradlew bootJar` → injeta `web/dist` em `BOOT-INF/classes/static/` |
| 3/3 runtime | `eclipse-temurin:21-jre-alpine` | executa o jar na porta 8081 |

Três decisões importantes desse arquivo:

**a) O build usa o *wrapper* do Gradle, não o `gradle` da imagem.**
A imagem `gradle:jdk21` traz uma versão "rolling" do Gradle, enquanto o
projeto fixa a versão exata em `gradle/wrapper/gradle-wrapper.properties`
(atualmente **9.5.1**). Sem o wrapper, o build do container usaria um Gradle
diferente do build local e do CI — e uma diferença de versão pode ser a
diferença entre um build que passa e um que falha.

```dockerfile
COPY backend/demo/gradle ./gradle
COPY backend/demo/gradlew ./gradlew
RUN chmod +x ./gradlew          # sem isso: "Permission denied"
```

**b) O frontend injetado no jar é verificado — 7 páginas + CSS + imagem.**
O passo de verificação é o **fail-fast** do build: se o `web/dist` não for
copiado inteiro para dentro do jar, o build quebra **ali**, com a lista do que
faltou — e não em produção, com um 404 na tela.

```dockerfile
jar tf /tmp/app.jar > /tmp/jar-list.txt
grep -qFx 'BOOT-INF/classes/static/index.html' /tmp/jar-list.txt \
&& grep -qFx 'BOOT-INF/classes/static/login.html' /tmp/jar-list.txt \
&& ... (7 páginas) ...
&& grep -qFx 'BOOT-INF/classes/static/css/main.css' /tmp/jar-list.txt \
&& grep -qFx 'BOOT-INF/classes/static/img/senac-logo-sem-fundo.webp' /tmp/jar-list.txt \
|| { echo "ERRO: frontend incompleto dentro do jar"; \
     grep -E 'BOOT-INF/classes/static' /tmp/jar-list.txt | head -20; exit 1; }
```

> **Por que não se usa variável de shell aqui?** O builder do Docker só
> substitui `${VAR}` em `ADD`, `COPY`, `ENV`, `EXPOSE`, `FROM`, `LABEL`,
> `USER`, `VOLUME` e `WORKDIR`. Em `RUN`, a substituição é do shell — e no
> `ash` do Alpine, `$$` é o **PID**. Um `for f in ...; do grep "$$f.html" ...`
> acaba testando `1f.html` (PID 1) e falha com um erro que não tem relação
> com o problema real. Daí a verificação ser escrita com **9 caminhos
> literais** e `grep -qFx` (literal + linha inteira).

**c) O `.dockerignore` não pode ignorar `web/` nem `backend/`.**
A pasta `web/` precisa estar no contexto de build para o `COPY web/ ./` funcionar.

#### 3.4. Verificar a imagem depois do build

```bash
docker run --rm conectasenac:latest sh -c "ls BOOT-INF 2>/dev/null; true"
docker run --rm -p 8081:8081 --env-file .env conectasenac
# em outro terminal:
curl -s http://localhost:8081/api/dados | head -c 200
curl -sI http://localhost:8081/ | head -1
curl -sI http://localhost:8081/css/main.css | head -1
```

#### 3.5. Problemas conhecidos ao construir

| Sintoma | Causa | Solução |
| --- | --- | --- |
| `FATAL: password authentication failed for user "SEU_USUARIO_DE_BANCO"` e o container da API em *crash loop* | o `.env` foi copiado do `.env.example` **sem preencher** — sobrou o valor de exemplo | defina `POSTGRES_PASSWORD=<senha forte>` no `.env` e recrie o volume (`docker compose down -v`) |
| `FATAL: password authentication failed` **depois** de corrigir o `.env` | a senha do Postgres só é aplicada na **primeira** inicialização do volume | `docker compose down -v && docker compose up -d --build` |
| `ERROR: POSTGRES_PASSWORD e obrigatorio` ao subir | o `.env` está sem a senha (ou a variável não chegou ao Compose) | preencha o `.env`; o Compose aborta aqui de propósito, em vez de deixar a API reiniciando |
| `ERRO: a senha do Postgres ainda e o valor de exemplo do .env.example` | a senha no `.env` é literalmente `SEU_*` / `SUA_*` / `changeme*` | troque por uma senha real |
| `Unable to delete directory '...\build\resources\test'` | **lock do OneDrive** sobre a pasta de artefatos do Gradle | `Remove-Item -Recurse -Force backend\demo\build` antes de construir |
| `ERRO: 1f.html nao encontrado dentro do jar` | `$$` expandido como PID dentro do `RUN` | usar caminhos literais (ver 3.3.b) |
| `Permission denied` no `./gradlew` | bit de execução ausente | `chmod +x ./gradlew` (o índice do Git já está como `100755`) |
| `docker: cannot copy ... no such file or directory` | build a partir de uma pasta errada | o `docker build` é **sempre** a partir da **raiz** do repositório |
| `import.meta.env` vazio no bundle | `VITE_API_BASE=""` — o Vite descarta variáveis vazias | use o token `same-origin` |
| `LOG: invalid length of startup packet` no log do Postgres | algum cliente conectou na porta 5432 publicada sem falar o protocolo do Postgres | é ruído: não afeta a API. Se persistir, veja se alguma ferramenta do host está sondando a porta |

### 4. Backend Java sem Docker

Requer **JDK 21**. Se o Java 21 não estiver no `PATH`, aponte o `JAVA_HOME`
para a instalação do IntelliJ:

```bash
cp .env.example .env
docker compose up -d                       # Postgres local (porta 5432)
cd backend/demo
./gradlew bootRun                          # porta 8081
```

Suíte de testes (JUnit 5, sem need de Docker — usa H2 em memória):

```bash
cd backend/demo
./gradlew test                             # 50 testes
```

#### 4.1. Onde está o JDK 21 neste host

Se `java -version` responder 11 e o build reclamar de toolchain, existe um
JDK 21 instalado pelo IntelliJ:

```
C:\Users\<seu-usuario>\.jdks\ms-21.0.12.1
```

```powershell
$env:JAVA_HOME='C:\Users\<seu-usuario>\.jdks\ms-21.0.12.1'
& '.\gradlew.bat' test --console=plain --no-daemon
```

O Gradle 9.5.1 sobe com JDK 17/20 e resolve a *toolchain* 21 por
auto-detecção — basta o `JAVA_HOME` apontar para uma JDK21.

### 3.6 Publicar no Supabase, Render e Vercel

O repositório já vem com os manifests prontos:

| Arquivo | Plataforma | O que faz |
|---|---|---|
| `render.yaml` | **Render** | Blueprint do serviço Docker `conectasenac-api` (API + SPA na mesma imagem), com as 3 variáveis secretas do Postgres |
| `vercel.json` | **Vercel** | build do `web/` (`npm ci` + `vite build`), output `web/dist`, cache de `assets/` e `css/` |
| `docs/DEPLOY.md` | — | passo a passo completo: Supabase (banco) → Render (API) → Vercel (frontend), com checklist e tabela de problemas conhecidos |

Resumo do fluxo:

1. **Supabase** — crie o projeto, copie a *connection string* do pooler
   (`aws-0-<regiao>.pooler.supabase.com:5432/postgres`) e anote a senha.
2. **Render** — importe o repositório como *Blueprint*; o `render.yaml` é
   detectado automaticamente. Preencha `SUPABASE_DB_USER`,
   `SUPABASE_DB_PASSWORD` e `SPRING_DATASOURCE_URL`.
   A URL JDBC **não** leva `usuario:senha@` antes do host (o `pgjdbc` não faz
   parse de *userinfo*): use
   `jdbc:postgresql://aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require`.
3. **Vercel** — importe o repositório com *Root Directory* = `web` e defina
   `VITE_API_BASE` = URL do Render (nunca `same-origin` aqui: é outra
   origem, e nunca string vazia — o Vite descarta `""`).

> ⚠️ Antes de publicar: **revogue e rotacione a chave pública do Supabase**
> que ficou exposta no histórico antigo deste projeto. Ver
> `docs/RELATORIO_FINAL.md`, seção 15.

---

## Logins de teste

Dados do seed de `server/seed.js` (unidade **1001 — SENAC Asa Norte**):

| Perfil | E-mail | Senha | Painel |
| --- | --- | --- | --- |
| Admin | `Senac_GDF@Hotmail.com` | `Senac.DF2007` | `/admin.html` |
| Coordenador | `coord.asanorte@senacdf.com` | `Coord@123` | `/coordenador.html` |
| Instrutor | `katia.barros@senacdf.com` | `Inst@123` | `/instrutor.html` |
| Recepção | `recep.asanorte@senacdf.com` | `Recep@123` | `/recepcao.html` |

> O login exige **e-mail + senha + unidade**. O campo de senha só é gravado em
> texto puro porque esse é o comportamento legado do sistema; ver
> `docs/RELATORIO_FINAL.md` → *Pendências conhecidas*.

---

## Estrutura do frontend Web

```
web/
├─ index.html  login.html  dashboard.html        (páginas de entrada)
├─ admin.html  coordenador.html
├─ instrutor.html  recepcao.html
├─ public/
│  ├─ css/      20 folhas de estilo (main.css importa as demais)
│  └─ img/      logo
├─ src/
│  ├─ core/         camadas transversais (dados, API, DOM, UI, tema, auth,
│  │                filtros, ações delegadas)
│  ├─ features/     um módulo por painel
│  ├─ entry/        bootstrap de cada página (registra as ações e a delegação)
│  ├─ types/        contrato de domínio (compartilhado com o mobile)
│  └─ vite-env.d.ts
└─ dist/        bundle de produção — NÃO vem na entrega.
                 Gere com `npm run build` (já está no .gitignore).
```

O HTML **não** usa mais `onclick`/`onchange` inline. Os **145 handlers** foram
convertidos para atributos declarativos `data-action` / `data-change` /
`data-input`, e um único listener por tipo de evento, instalado na raiz do
documento, faz a delegação (`core/actions.ts` + `core/acoes-comuns.ts`).
Nenhuma função de aplicação fica exposta em `window`.

---

## Modo Mock vs Modo Producao

O repositorio tem **duas** camadas de dados com o mesmo contrato HTTP:
`backend/` (Spring Boot, porta 8081, Postgres/Supabase — **fonte da verdade**) e
`server/` (Node, porta 3333, `server/data/db.json` — mock legado). O modo passa
a ser explicito:

```bash
# Web
VITE_API_BASE=http://127.0.0.1:3333 VITE_MODO_API=mock      npm run build
VITE_API_BASE=https://api.exemplo.com VITE_MODO_API=producao npm run build
VITE_API_BASE=same-origin                                    npm run build
```

```jsonc
// mobile/app.json
{ "expo": { "extra": { "apiUrl": "http://192.168.0.20:8081", "modoApi": "producao" } } }
```

Sem configuracao, o web infere `mock` para loopback e `producao` para host
publico; o mobile idem. Loopback, `.local` e IP privado RFC 1918 contam como
mock. Detalhes em `docs/ARQUITETURA_ATUALIZADA.md`.

---

## Documentação

- `docs/DEPLOY.md` — **guia de publicação no Supabase, Render e Vercel**
  (passo a passo, variáveis de ambiente e checklist)
- `docs/ARQUITETURA_ATUALIZADA.md` — árvore de diretórios, fluxo de
  inicialização de cada página, camadas do backend, modo mock vs produção
- `docs/RELATORIO_FINAL.md` — **relatório completo de todas as alterações**
  (reorganização, migração TS, bugs corrigidos, contratos, infra, segredos)
- `docs/RELATORIO_REFATORACAO.md` — o que mudou na refatoração e por que
- `docs/CASO_DE_USO.md` — 15 casos de uso e regras de negócio (v4, legado)
- `docs/DOCUMENTACAO_CODIGO.md` — descrição do código original do web
- `docs/DOCUMENTACAO_CONEXAO_WEB_MOBILE.md` — protocolo de sincronização

---

## Variáveis de ambiente

`.env.example` documenta todas. Resumo:

| Variável | Camada | Efeito |
| --- | --- | --- |
| `VITE_API_BASE` | build do web | base da API; token `same-origin` = mesma origem |
| `VITE_MODO_API` | build do web | `mock` \| `producao` |
| `VITE_API_TIMEOUT_MS` | build do web | tempo limite da API (padrão 12000) |
| `EXPO_PUBLIC_API_URL` | mobile | URL da API |
| `EXPO_PUBLIC_API_PORT` | mobile | porta da API (padrão 8081) |
| `EXPO_PUBLIC_MODO_API` | mobile | `mock` \| `producao` |
| `API_PORT` | Docker | porta da API Spring Boot (padrão 8081) |
| `POSTGRES_*` | Docker | credenciais do Postgres local |
| `SUPABASE_DB_USER` / `SUPABASE_DB_PASSWORD` | API | credenciais do banco |

> O `.gitignore` da raiz bloqueia `.env` e `.env.*` (com exceção de
> `.env.example`) — nenhum segredo real entra no repositório.
