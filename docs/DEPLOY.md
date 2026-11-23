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

### 2.3 Schema, Flyway e ambientes

O comportamento do schema depende do ambiente:

| Ambiente | Banco | Flyway | Hibernate |
|---|---|---|---|
| Testes automatizados | H2 em memoria | desabilitado | `ddl-auto=update` |
| Desenvolvimento local | PostgreSQL do `compose.yaml` | habilitado por padrao | `ddl-auto=validate` |
| Demonstracao | PostgreSQL de teste externo | habilitado | `ddl-auto=validate` |
| Produção | PostgreSQL de produção externo | habilitado | `ddl-auto=validate` |

O `ddl-auto=update` dos testes existe somente para preparar o banco isolado dos
testes. Ele **não** é o mecanismo de provisionamento do desenvolvimento local,
da demonstração ou da produção.

No **desenvolvimento local**, o Compose fornece um PostgreSQL descartável ou
persistido em volume local. O objetivo é desenvolver e testar a aplicação; não
é uma cópia do banco de demonstração ou de produção.

Na **demonstração**, o Render conecta a API a um PostgreSQL externo de teste.
Mesmo sendo um ambiente de demonstração, o banco deve ser tratado como
persistente: faça backup, confira o histórico Flyway e execute a V1 em janela
controlada antes de liberar o ambiente.

Na **produção**, use um banco separado, credenciais separadas, backup
verificável, janela aprovada e monitoramento. Não reutilize o banco, a chave
JWT ou as credenciais da demonstração. A sequência de migration é a mesma, mas
exige aprovação operacional e smoke test antes da liberação aos usuários.

Nesses ambientes, o Flyway é responsável por aplicar as migrations versionadas
antes da validação JPA. A configuração atual é:

```properties
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=0
spring.jpa.hibernate.ddl-auto=validate
```

`baseline-on-migrate=true` permite adotar um banco legado que ainda não possui
`flyway_schema_history`: se o schema já tiver objetos e a tabela de histórico
não existir, o Flyway registra o estado inicial como baseline `0` e, em seguida,
aplica as versões pendentes, incluindo `V1__sinc_operacoes_identity.sql`.
Isso **não** significa que o Flyway já tenha sido executado no Supabase; a
existência e o conteúdo de `flyway_schema_history` devem ser verificados
explicitamente antes da publicação.

Se `flyway_schema_history` já existir, não se deve criar outro baseline
manualmente. Deve-se conferir as versões e estados registrados: uma V1 já
aplicada será ignorada; uma V1 pendente será aplicada no startup.

### 2.4 Escopo da V1 e compatibilidade do banco legado

A V1 altera somente a estrutura de `sinc_operacoes` necessária para a
idempotência e o isolamento por usuário:

- cria a tabela caso ela não exista;
- adiciona `usuario_id BIGINT NULL` caso esteja ausente;
- garante a chave primária e o índice único global de `id`;
- cria o índice de `usuario_id`;
- adiciona condicionalmente a FK para `usuarios(id)` como `NOT VALID`.

A V1 **não cria todo o schema da aplicação**. Ela pressupõe que um banco legado
já possua as demais tabelas exigidas pelo modelo JPA, especialmente `usuarios`
e as tabelas usadas pelos serviços. Um banco vazio não estará pronto apenas com
essa migration: primeiro é necessário provisionar o schema completo e somente
depois iniciar o backend com `ddl-auto=validate`.

`CREATE TABLE IF NOT EXISTS` não corrige automaticamente uma tabela existente
com colunas, tipos ou constraints incompatíveis. Antes da aplicação, compare a
estrutura real de `sinc_operacoes` com a entidade `SincOperacao` e confirme que
as demais tabelas esperadas pelo JPA já existem.

Registros antigos são preservados. `usuario_id` permanece nullable para que
operações criadas antes da introdução do `uid` não sejam atribuídas
retroativamente a outro usuário. A FK `NOT VALID` permite manter dados
históricos sem proprietário ou com proprietário removido; novas gravações
válidas continuam sujeitas à referência existente.

### 2.5 Sequência controlada para banco legado

Não presuma que o histórico Flyway do Supabase existe. Para demonstração ou
produção, siga esta sequência:

1. **Congelar a janela de mudança** e fazer backup verificável do PostgreSQL.
2. Registrar a contagem e a estrutura de `sinc_operacoes`, das tabelas usadas
   pelo JPA e das constraints existentes.
3. Consultar `flyway_schema_history`, se existir, e confirmar se a V1 está
   aplicada, pendente ou ausente.
4. Confirmar que o banco não é vazio e que o schema legado é compatível com a
   entidade `SincOperacao` e com o restante do modelo.
5. Aplicar a V1 por uma inicialização controlada do backend/Flyway, ou pelo
   procedimento Flyway aprovado pela operação. Não marque a V1 como aplicada
   manualmente sem verificar seus objetos.
6. Conferir a preservação das linhas antigas, `usuario_id` nullable, o índice
   único de `id`, o índice de proprietário e a FK esperada.
7. Somente depois iniciar o backend com `spring.jpa.hibernate.ddl-auto=validate`.
8. Executar smoke tests de `/health`, login, `/api/dados`, autorização e
   sincronização.
9. Semear dados de demonstração somente após o startup validado:

```bash
curl -X POST https://<SUA-API>/api/reset
```

O `SeedService` roda **apenas** se a tabela `unidades` estiver vazia. Isso não
substitui a criação do schema nem deve ser usado como etapa de recuperação de
uma migration falha.

### 2.6 Recuperação de falha no startup

Se o backend falhar durante o Flyway ou durante `ddl-auto=validate`:

1. Não tente contornar o erro trocando produção para `ddl-auto=update`.
2. Preserve os logs do startup e identifique se a falha ocorreu na conexão, no
   baseline, na V1 ou na validação JPA.
3. Não execute novamente às cegas e não altere `flyway_schema_history` para
   mascarar uma migration incompleta.
4. Se a migration não iniciou ou foi revertida, corrija o schema legado e
   repita a etapa em uma nova janela controlada.
5. Se o histórico indicar uma migration parcialmente aplicada, interrompa o
   deploy e faça a recuperação a partir do backup/procedimento Flyway aprovado.
6. Se a V1 estiver aplicada mas a validação JPA falhar, corrija o schema
   ausente ou incompatível antes de reiniciar a aplicação.
7. Após a correção, confirme novamente contagens, constraints e
   `flyway_schema_history`, e só então faça o smoke test.

Para um banco vazio, a recuperação correta é provisionar o schema completo
antes do backend. A V1 isoladamente não deve ser usada como bootstrap completo.

### 2.7 Travar o acesso direto as tabelas (RLS) — obrigatorio

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

Ele habilita RLS nas 18 tabelas diagnosticadas e revoga os grants de
`anon`/`authenticated`. O diagnóstico confirmou a habilitação do RLS, mas não
validou a correção das políticas, grants efetivos ou o comportamento completo
de cada papel. Com RLS ligado e **sem** políticas, o Postgres normalmente nega
o acesso a quem não é owner; o comportamento do app ainda deve ser confirmado
em um smoke test controlado, porque o backend conecta como `postgres`
(owner, com `rolbypassrls = t`).

O script e idempotente: pode rodar quantas vezes quiser. Se voce recriar o
schema do zero, rode de novo.

### 2.8 Desenvolvimento local com PostgreSQL

No desenvolvimento local, `docker compose up -d --build` sobe PostgreSQL,
backend e frontend. O Compose fornece `SPRING_DATASOURCE_URL` apontando para o
serviço local. O Flyway continua sendo executado no startup e o backend também
usa `ddl-auto=validate`; portanto, o volume local deve conter um schema
compatível antes de testar a aplicação.

Para um banco local descartável, destrua somente o volume local e reprovisione
o schema completo por um procedimento de desenvolvimento aprovado. Não use
esse fluxo para o Supabase.

### 2.9 Postgres local opcional

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

> **Divergencia de host (auditoria 2026-11-09 — nao resolvida por suposicao):**
> Este documento usa `conectasenac-api.onrender.com` (nome do servico em
> `render.yaml`), mas o fallback em `web/src/core/api.ts` e
> `conecta-senac.onrender.com`. Sonde os dois antes de publicar:
>
> | Host | Observacao em 2026-11-09 |
> |---|---|
> | `conectasenac-api.onrender.com` | HTTP 404 em `/` e `/api/dados` |
> | `conecta-senac.onrender.com` | HTTP 503 (servico fora do ar/hibernado) |
>
> Nao escolha um dos dois por suposição: confirme no painel do Render qual
> servico esta ativo e alinhe `render.yaml`, `web/src/core/api.ts` e este
> documento ao mesmo host.

---

## 4. Vercel — frontend (opcional, mas recomendado)

O frontend na Vercel e a **mesma** aplicacao servida pelo Render, so que em
outra origem. Serve para CDN, preview por branch e cache de assets.

### 4.1 Importar o projeto

1. <https://vercel.com/new> → importe `Starkbr264/Conecta-senac-Test`
2. **Framework Preset:** `Other`
3. **Root Directory:** deixe em branco (raiz do repositorio). **Nao** coloque
   `web` aqui: o `vercel.json` da raiz ja contem os comandos com `cd web`
   e o `outputDirectory` relativo a raiz. Se Root Directory for `web`, o
   build roda dentro de `web/` e o `cd web` falha com
   `No such file or directory` (o erro que apareceu no log).
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

## 6. Checklist de publicação

- [ ] Chave publica do Supabase **revogada e rotacionada**
- [ ] Senha do banco do Supabase trocada (nunca a de exemplo)
- [ ] Backup verificável do banco legado realizado
- [ ] Existência/estado de `flyway_schema_history` verificados; nenhum baseline
      foi presumido
- [ ] Schema legado completo e compatível com `ddl-auto=validate`
- [ ] V1 aplicada e verificada antes da inicialização normal
- [ ] Registros antigos de `sinc_operacoes` preservados e sem `usuario_id`
- [ ] Backend iniciado sem erro de Flyway ou validação JPA
- [ ] Schema criado/provisionado no Supabase antes de usar `/api/reset`
- [ ] **RLS habilitado** (`backend/demo/sql/rls-public.sql`) nas 18 tabelas
      diagnosticadas — este item não confirma que políticas ou grants estejam
      corretos; ambos precisam de validação separada
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
| `Found non-empty schema(s) but no schema history table` | banco legado sem histórico Flyway | faça backup, confirme o schema e deixe `baseline-on-migrate` registrar baseline `0`; não presuma que a V1 já foi aplicada |
| `Validate failed` ou tabela/coluna ausente | schema legado incompleto ou incompatível | não troque para `ddl-auto=update` em demonstração/produção; corrija o schema e reinicie após a migration |
| banco vazio não inicia com a V1 | a V1 cobre apenas `sinc_operacoes` | provisione o schema completo antes de iniciar o backend |
| migration falhou no startup | conexão, histórico ou estrutura incompatível | interrompa o deploy, preserve logs, não edite o histórico manualmente e siga o procedimento de recuperação da seção 2.6 |
| Vercel build falha com `npm ci` | `package-lock.json` do `web/` fora de sincronia | rode `cd web && npm install` e commite o lock |
| `ERR_CONNECTION_REFUSED` | API do Render dormiu (free tier) | a primeira requisicao acorda; use plano `starter` para nao dormir |
| App mostra lista de unidades vazia | `VITE_API_BASE` vazio ou apontando para o host antigo | use o token `same-origin` (Render) ou a URL completa (Vercel) |
