# Guia de publicacao — Supabase, Render e Vercel

Este guia descreve como publicar o **Conecta-Senac** usando os tres servicos
que voce pediu. O objetivo e ter o mesmo projeto rodando em tres lugares:

| Servico | Papel | O que roda la |
|---|---|---|
| **Supabase** | Banco de dados (Postgres) + Auth + Storage | apenas o Postgres, com o schema do projeto |
| **Render** | API + frontend | a imagem Docker do repositorio (Spring Boot servindo tambem a SPA) |
| **Vercel** | Frontend (opcional) | build estatico do `web/`, apontando para a API do Render |

> **Antes de comecar:** a chave publica do Supabase que existia no historico
> antigo deste projeto **precisa ser revogada e rotacionada**. Troque a chave
> em *Supabase > Project Settings > API* e atualize as variaveis de ambiente
> de cada plataforma. Ver `docs/RELATORIO_FINAL.md`, secao 15.

---

## 1. Push do repositorio

```powershell
git remote add conecta-teste https://github.com/Starkbr264/Conecta-senac-Test.git
git push -u conecta-teste main
```

O repositorio de destino precisa estar **vazio** (apenas o `README.md` inicial
que o GitHub cria). O push aqui e um *force push*, porque o historico deste
projeto foi reescrito para remover segredos — ver `docs/RELATORIO_FINAL.md`,
secao 15.

---

## 2. Supabase — banco de dados

### 2.1 Criar o projeto

1. <https://supabase.com/dashboard> → **New project**
2. Defina nome, senha do banco e regiao (escolha **South America (Sao Paulo)**
   para minimize a latencia).
3. Guarde a senha do banco — ela nao aparece de novo.

### 2.2 Pegar a URL de conexao

**Project Settings → Database → Connection string → URI**:

```
postgresql://postgres.<REF>:<SENHA>@aws-0-<REGIAO>.pooler.supabase.com:5432/postgres
```

Use a variante **pooler** (transacional, porta 5432).

> ⚠️ **Essa URI NAO vai direto no Render.** O driver JDBC do PostgreSQL
> (`pgjdbc`) **nao aceita** o bloco `usuario:senha@` da frente do host. Ele
> interpreta tudo aquilo como parte do nome do host e o boot falha com:
>
> ```
> java.net.UnknownHostException: postgres.<REF>:<SENHA>@aws-0-<REGIAO>.pooler.supabase.com
> ```
>
> (ou, se faltar o prefixo `jdbc:`, com
> `Driver org.postgresql.Driver claims to not accept jdbcUrl, postgresql://...`)
>
> A URL JDBC correta **nao tem credencial**:
>
> ```
> jdbc:postgresql://aws-0-<REGIAO>.pooler.supabase.com:5432/postgres?sslmode=require
> ```
>
> O usuario e a senha vao em **variaveis separadas**
> (`SUPABASE_DB_USER` / `SUPABASE_DB_PASSWORD`), que o Spring Boot passa ao
> driver como `Properties` — e e assim que o `pgjdbc` espera.
>
> No **pooler**, o usuario e `postgres.<REF-do-projeto>` (com o ponto). Na
> **conexao direta** seria so `postgres`.
>
> A senha **nao precisa** de URL-encode, porque ela nao fica na URL. Em
> `SUPABASE_DB_PASSWORD` use sempre a senha **original**.

### 2.3 Criar o schema

O backend cria as tabelas sozinho (`spring.jpa.hibernate.ddl-auto=update`).
Para semear os dados de demonstracao, depois que a API subir:

```bash
curl -X POST https://<SUA-API>/api/reset
```

O `SeedService` roda **apenas** se a tabela `unidades` estiver vazia, entao
esse comando e seguro para repetir.

### 2.4 Travar o acesso direto as tabelas (RLS) — obrigatorio

> ⚠️ **O Advisor do Supabase vai acusar `RLS Disabled in Public` (CRITICAL)
> em uma tabela por vez** assim que o backend criar o schema. Nao e
> cosmetico: com o RLS desligado, o role `anon` — que a chave publica do
> projeto usa — tem `SELECT/INSERT/UPDATE/DELETE` sobre as tabelas de
> `public`. Qualquer pessoa com a chave publica (que e publica por
> definicao) le, altera e apaga o banco pela API
> `https://<REF>.supabase.co/rest/v1/...`, inclusive a tabela `usuarios`,
> que guarda as senhas.

Rode o script versionado no projeto (SQL Editor do Supabase → cole e execute):

```
backend/demo/sql/rls-public.sql
```

Ele habilita RLS nas 15 tabelas e revoga os grants de `anon`/`authenticated`.
Com RLS ligado e **sem** politicas, o Postgres nega tudo para quem nao e
owner — e o app **continua funcionando**, porque o backend conecta como
`postgres` (owner, com `rolbypassrls = t`).

O script e idempotente: pode rodar quantas vezes quiser. Se voce recriar o
schema do zero, rode de novo.

### 2.5 Opcional: rodando o Postgres localmente com o mesmo schema

```powershell
docker run -d --name conectasenac-db `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=SUA_SENHA `
  -e POSTGRES_DB=conectasenac `
  -p 5432:5432 postgres:16
```

---

## 3. Render — API + frontend (imagem Docker)

O `render.yaml` da raiz ja esta pronto: ele declara o servico, o caminho do
Dockerfile e as 3 variaveis secretas.

### 3.1 Conectar o repositorio

1. <https://dashboard.render.com> → **New → Blueprint**
2. Escolha o repositorio `Starkbr264/Conecta-senac-Test`
3. O Render detecta o `render.yaml` e propoe o servico `conectasenac-api`

### 3.2 Preencher as variaveis

| Variavel | Valor |
|---|---|
| `SUPABASE_DB_USER` | `postgres.<REF>` (no pooler; o `.` faz parte) |
| `SUPABASE_DB_PASSWORD` | a senha do banco no Supabase, **original** (sem URL-encode) |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://aws-0-<REGIAO>.pooler.supabase.com:5432/postgres?sslmode=require` |

> Use o **pooler** e `sslmode=require`. A URL direta (porta 5432, sem
> `pooler`) funciona para migracoes, mas o pooler e o recomendado para a
> aplicacao.

> ⚠️ **A URL JDBC nao leva `usuario:senha@` na frente do host.** O `pgjdbc`
> nao faz parse de *userinfo*: ele trata o bloco inteiro como parte do host
> e o boot morre com
> `java.net.UnknownHostException: postgres.<REF>:<SENHA>@aws-0-<REGIAO>.pooler.supabase.com`.
> Alem disso o prefixo `jdbc:` e obrigatorio. Compare:
>
> | Errado | Certo |
> |---|---|
> | `postgresql://postgres.abc:senha@host:5432/postgres` | `jdbc:postgresql://host:5432/postgres?sslmode=require` |
> | `jdbc:postgresql://postgres.abc:senha@host:5432/postgres` | `jdbc:postgresql://host:5432/postgres?sslmode=require` |
>
> As credenciais vao em `SUPABASE_DB_USER` / `SUPABASE_DB_PASSWORD`, que o
> Spring Boot entrega ao driver como `Properties` — exatamente o formato que
> o `pgjdbc` espera.

`VITE_API_BASE` ja vem como `same-origin`: o frontend esta injetado dentro do
proprio jar, entao ele fala com a API na mesma origem, sem CORS.

### 3.3 Conferir

```bash
curl https://conectasenac-api.onrender.com/api/dados
```

Deve devolver as 8 colecoes. A primeira requisicao pode demorar ~1 min
(free tier hiberna); a subsequente e instantanea.

---

## 4. Vercel — frontend (opcional, mas recomendado)

O frontend na Vercel e a **mesma** aplicacao servida pelo Render, so que em
outra origem. Serve para CDN, preview por branch e cache de assets.

### 4.1 Importar o projeto

1. <https://vercel.com/new> → importe `Starkbr264/Conecta-senac-Test`
2. **Framework Preset:** `Other`
3. **Root Directory:** `web`
4. Deixe **Build Command** e **Output Directory** em branco — o `vercel.json`
   da raiz ja define tudo

### 4.2 Variavel de ambiente

| Variavel | Valor |
|---|---|
| `VITE_API_BASE` | `https://conectasenac-api.onrender.com` |

> O token `same-origin` aqui **nao serve**: a Vercel e outra origem. Use a URL
> completa do Render. E **nunca** use string vazia: o Vite descarta variaveis
> vazias e o bundle cairia no host de produao antigo.

### 4.3 Conferir

Abra a URL gerada pela Vercel, faca login com
`Senac_GDF@Hotmail.com` / `Senac.DF2007` e confirme que a lista de unidades
carrega (ela vem da API do Render).

---

## 5. Mobile (opcional)

O app Expo fala com a API por `EXPO_PUBLIC_API_URL`:

```bash
# no .env do mobile, ou em app.json > extra.apiUrl
EXPO_PUBLIC_API_URL=https://conectasenac-api.onrender.com
EXPO_PUBLIC_API_PORT=8081
```

Precedencia: `extra.apiUrl` no `app.json` → `EXPO_PUBLIC_API_URL` →
descoberta automatica do host do Metro.

---

## 6. Checklist de publicacao

- [ ] Chave publica do Supabase **revogada e rotacionada**
- [ ] Senha do banco do Supabase trocada (nunca a de exemplo)
- [ ] Schema criado no Supabase (`/api/reset` depois que a API subir)
- [ ] **RLS aplicado** (`backend/demo/sql/rls-public.sql`) — sem isso o
      Advisor acusa 15 avisos CRITICAL e o banco fica aberto para a chave
      publica
- [ ] `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` e `SPRING_DATASOURCE_URL`
      preenchidos no Render
- [ ] `VITE_API_BASE` = URL do Render na Vercel
- [ ] `GET /api/dados` respondendo 200 na URL do Render
- [ ] Login funcionando na URL do Render
- [ ] Login funcionando na URL da Vercel

---

## 7. Problemas conhecidos

| Sintoma | Causa | Solucao |
|---|---|---|
| `404` em `/` no Render | o frontend nao foi injetado no jar | o build do Docker sobe se `web/` e `backend/` nao estiverem no `.dockerignore` |
| `404` em `/` **e** no log `Unable to determine Dialect without JDBC metadata` + `Exited with status 1` | o container **nao subiu**: o Render marca o servico como `no-server` porque o processo morreu | o erro do Postgres esta **acima**, no log. Se for `UnknownHostException: postgres.<REF>:<SENHA>@host`, a URL JDBC tem credencial embutida — veja a linha seguinte |
| `java.net.UnknownHostException: postgres.<REF>:<SENHA>@aws-0-<REGIAO>.pooler.supabase.com` | a `SPRING_DATASOURCE_URL` tem `usuario:senha@` antes do host; o `pgjdbc` nao faz parse de *userinfo* | `SPRING_DATASOURCE_URL` = `jdbc:postgresql://aws-0-<REGIAO>.pooler.supabase.com:5432/postgres?sslmode=require` (sem credencial) e a credencial vai em `SUPABASE_DB_USER` / `SUPABASE_DB_PASSWORD` |
| `password authentication failed` | `SPRING_DATASOURCE_URL` com usuario/senha divergentes | use exatamente a string do painel do Supabase |
| `Driver org.postgresql.Driver claims to not accept jdbcUrl, postgresql://...` | faltou o prefixo `jdbc:` na URL | `SPRING_DATASOURCE_URL` = `jdbc:postgresql://...` (a URI do Supabase vem sem o prefixo) |
| `No open ports detected` | o app escutou numa porta diferente da que o Render espera | nao defina `PORT` no blueprint; o Render injeta a dele e o app le `${PORT:8081}` |
| `FATAL: role "postgres" does not exist` | banco recem-criado ainda sem o role pronto | aguarde 30 s e rode `/api/reset` |
| Vercel build falha com `npm ci` | `package-lock.json` do `web/` fora de sincronia | rode `cd web && npm install` e commite o lock |
| `ERR_CONNECTION_REFUSED` | API do Render dormiu (free tier) | a primeira requisicao acorda; use plano `starter` para nao dormir |
| App mostra lista de unidades vazia | `VITE_API_BASE` vazio ou apontando para o host antigo | use o token `same-origin` (Render) ou a URL completa (Vercel) |
