# Conecta-Senac

Sistema de reserva de salas, turmas e chaves do SENAC GDF.
Projeto integrador — instrutora **Rayssa Paiva Carvalho**, aluno **Enzo Aragão Lages**.

O repositório reúne **quatro componentes independentes**:

| Componente | Pasta | Tecnologia | Papel |
| --- | --- | --- | --- |
| Frontend Web | `web/` | TypeScript + Vite 5 | telas para Admin, Coordenador, Instrutor e Recepção |
| Aplicativo Mobile | `mobile/` | Expo 51 / React Native 0.74 / expo-router | app Android/iOS do instrutor e da recepção |
| Servidor de dados | `server/` | Node.js puro (CommonJS, sem dependências) | API + persistência em `server/data/db.json` |
| API Java | `backend/demo/` | Spring Boot 4 + JPA + PostgreSQL | backend alternativo (não é consumido por nenhum dos frontends) |

---

## Fonte da verdade dos dados

Os dois frontends conversam **apenas com o servidor Node da porta 3333**
(`GET /api/dados`, `POST /api/sinc`, `POST /api/login`, …). O banco em memória é
`server/data/db.json`; quando ele não existe ou está corrompido, o servidor o
reconstrói a partir de `server/seed.js` (10 unidades, 42 usuários, 50 salas,
40 turmas, 31 reservas, 20 chaves, 4 notificações e 4 solicitações).

O backend Spring Boot é uma implementação **paralela** do mesmo domínio, com os
mesmos nomes de tabela, e roda contra o PostgreSQL do Supabase. Ele existe no
repositório, mas **nenhum código do web ou do mobile chama as rotas dele**.

---

## Como executar

### 1. Servidor de dados (obrigatório para web e mobile)

```bash
node server/index.js
# Porta 3333 (configurável com a variável PORT)
```

### 2. Frontend Web

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

O bundle gerado por `npm run build` é o que o servidor Node publica em
`http://localhost:3333` (raiz `web/dist`). **Sem rodar o build, o servidor
responde apenas na API** — para a interface nesse caso, use `npm run dev`.

**Apontar para outro backend.** Por padrão o web usa
`https://conecta-senac.onrender.com`. Para desenvolvimento local:

```bash
VITE_API_BASE=http://127.0.0.1:3333 npm run build     # servidor Node
VITE_API_BASE=same-origin       npm run build         # mesma origem da página
```

A resolução é, em ordem: `window.__CONECTA_API_BASE__` (injetado em runtime) →
variável `VITE_API_BASE` do build → host de produção. O token **`same-origin`**
expande para `window.location.origin` (é o padrão do `Dockerfile`). Use esse
token em vez de string vazia: o Vite descarta variáveis de ambiente com valor
`""` e o `import.meta.env` gerado viraria `{}`. Se a API não responder em 12 s,
o web cai para **modo offline** usando o cache local.

### 3. Aplicativo Mobile

```bash
cd mobile
npm install
npm run start        # abre o Expo (leitor de QR / web)
npm run android
npm run ios
npm run typecheck    # tsc --noEmit
```

Para apontar o app para o servidor local, edite `app.json` e acrescente:

```json
"expo": { "extra": { "apiUrl": "http://192.168.0.10:3333" } }
```

O app tenta descobrir o host automaticamente (Expo Go usa o host do
debugger). Sem servidor, ele opera em **modo offline** com o cache do
`AsyncStorage`.

### 4. Backend Java + Web (Docker, o caminho recomendado)

O `Dockerfile` da raiz é **multi-stage** e produz **uma única imagem** que
sobe a API Spring Boot *e* serve o frontend na mesma origem. Como o backend não
registra nenhum handler de recursos estáticos, o bundle do Vite é injetado em
`BOOT-INF/classes/static/` dentro do jar — nenhuma linha do backend é alterada.

```bash
cp .env.example .env        # preencha as credenciais
docker build -t conectasenac .                       # SEMPRE a partir da RAIZ
docker run --rm -p 8081:8081 --env-file .env conectasenac
# API  -> http://localhost:8081/api/...
# Web  -> http://localhost:8081/
```

Stack completa com Docker Compose (Postgres + API com o SPA embutido +
servidor Node com o banco compartilhado):

```bash
cp .env.example .env
docker compose up -d --build
# postgres -> 5432   api (Spring + web) -> 8081   server (Node) -> 3333
```

O `compose.yaml` sobrescreve a URL do datasource por variável de ambiente
(`SPRING_DATASOURCE_URL`), então o serviço `api` conversa com o Postgres local
sem precisar editar `application.properties`.

Para gerar a imagem apontando o frontend para outro host:

```bash
docker build --build-arg VITE_API_BASE=https://api.exemplo.com -t conectasenac .
```

### 5. Backend Java sem Docker

Requer **JDK 21**.

```bash
cp .env.example .env
docker compose up -d                       # Postgres local (porta 5432)
cd backend/demo && ./gradlew bootRun       # porta 8081
```

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
> `docs/RELATORIO_REFATORACAO.md` → *Pendências conhecidas*.

---

## Estrutura do frontend Web

```
web/
├─ index.html  login.html  dashboard.html        (páginas de entrada)
├─ admin.html  coordenador.html
├─ instrutor.html  recepcao.html
├─ public/
│  ├─ css/      21 folhas de estilo (main.css importa as demais)
│  └─ img/      logo
├─ src/
│  ├─ core/         camadas transversais (dados, API, DOM, UI, tema, auth)
│  ├─ features/     um módulo por painel
│  ├─ entry/        bootstrap de cada página (instala os globais do `window`)
│  ├─ types/        contrato de domínio
│  └─ vite-env.d.ts
└─ dist/        bundle de produção — NÃO vem na entrega.
                 Gere com `npm run build` (já está no .gitignore).
```

O HTML mantém **145 handlers inline** (`onclick="salvarSala()"`). Para que
continuem funcionando, cada `src/entry/<página>.ts` republica os módulos em
`window` na mesma ordem em que os `<script>` clássicos eram carregados antes.
Não é preciso reescrever os atributos do HTML.

---

## Documentação

- `docs/CASO_DE_USO.md` — 15 casos de uso e regras de negócio (v4, legado)
- `docs/DOCUMENTACAO_CODIGO.md` — descrição do código original do web
- `docs/DOCUMENTACAO_CONEXAO_WEB_MOBILE.txt` — protocolo de sincronização
- `docs/RELATORIO_REFATORACAO.md` — **o que mudou na refatoração, o que foi
  corrigido, o que continua em JavaScript e o que ficou pendente**
---

## Modo Mock vs Modo Producao

O repositorio tem **duas** camadas de dados com o mesmo contrato HTTP:
`server/` (Node, porta 3333, `server/data/db.json`) e `backend/`
(Spring Boot, porta 8081, Postgres/Supabase). O modo passa a ser explicito:

```bash
# Web
VITE_API_BASE=http://127.0.0.1:3333 VITE_MODO_API=mock      npm run build
VITE_API_BASE=https://api.exemplo.com VITE_MODO_API=producao npm run build
VITE_API_BASE=same-origin                                    npm run build
```

```jsonc
// mobile/app.json
{ "expo": { "extra": { "apiUrl": "http://192.168.0.20:3333", "modoApi": "mock" } } }
```

Sem configuracao, o web infere `mock` para loopback e `producao` para host
publico; o mobile idem. Loopback, `.local` e IP privado RFC 1918 contam como
mock. Detalhes em `docs/ARQUITETURA_ATUALIZADA.md` secao 5.

## Documentacao

- `docs/ARQUITETURA_ATUALIZADA.md` - arvore de diretorios, fluxo de
  inicializacao de cada pagina, camadas do backend, modo mock vs producao
- `docs/RELATORIO_REFATORACAO.md` - o que mudou na refatoracao e por que
- `docs/CASO_DE_USO.md` - casos de uso e regras de negocio
- `docs/DOCUMENTACAO_CONEXAO_WEB_MOBILE.txt` - protocolo de sincronizacao
