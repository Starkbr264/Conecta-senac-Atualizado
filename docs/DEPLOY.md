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
git remote add teste https://github.com/Starkbr264/Test.git
git push -u teste main
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
postgresql://postgres:<SENHA>@aws-0-<REGIAO>.pooler.supabase.com:5432/postgres
```

Use a variante **pooler** (transacional, porta 5432). Ela e a que o
`application.properties` do projeto ja referencia por padrao.

### 2.3 Criar o schema

O backend cria as tabelas sozinho (`spring.jpa.hibernate.ddl-auto=update`).
Para semear os dados de demonstracao, depois que a API subir:

```bash
curl -X POST https://<SUA-API>/api/reset
```

O `SeedService` roda **apenas** se a tabela `unidades` estiver vazia, entao
esse comando e seguro para repetir.

### 2.4 Opcional: rodando o Postgres localmente com o mesmo schema

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
2. Escolha o repositorio `Starkbr264/Test`
3. O Render detecta o `render.yaml` e propoe o servico `conectasenac-api`

### 3.2 Preencher as variaveis

| Variavel | Valor |
|---|---|
| `SUPABASE_DB_USER` | `postgres` |
| `SUPABASE_DB_PASSWORD` | a senha do banco no Supabase |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://postgres:<SENHA>@aws-0-<REGIAO>.pooler.supabase.com:5432/postgres?sslmode=require` |

> Use o **pooler** e `sslmode=require`. A URL direta (porta 5432, sem
> `pooler`) funciona para migracoes, mas o pooler e o recomendado para a
> aplicacao.

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

1. <https://vercel.com/new> → importe `Starkbr264/Test`
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
| `password authentication failed` | `SPRING_DATASOURCE_URL` com usuario/senha divergentes | use exatamente a string do painel do Supabase |
| `FATAL: role "postgres" does not exist` | banco recem-criado ainda sem o role pronto | aguarde 30 s e rode `/api/reset` |
| Vercel build falha com `npm ci` | `package-lock.json` do `web/` fora de sincronia | rode `cd web && npm install` e commite o lock |
| `ERR_CONNECTION_REFUSED` | API do Render dormiu (free tier) | a primeira requisicao acorda; use plano `starter` para nao dormir |
| App mostra lista de unidades vazia | `VITE_API_BASE` vazio ou apontando para o host antigo | use o token `same-origin` (Render) ou a URL completa (Vercel) |
