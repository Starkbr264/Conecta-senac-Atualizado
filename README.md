# Conecta-Senac

**Sistema de reserva de salas, turmas e chaves — SENAC/DF**

> Projeto Integrador (PI) — Curso Técnico em Desenvolvimento de Sistemas, SENAC/DF.
> Instrutora: **Rayssa Paiva Carvalho**
> Equipe: **Enzo Aragão Lages, Pedro Vinícius, Vitor Roberto, Lucas Fernandes**

---

## 1. Resumo

O **Conecta-Senac** é um sistema web e mobile de gestão de reservas de salas,
turmas e chaves para as unidades do SENAC no Distrito Federal. O projeto
integra quatro componentes independentes — frontend web, aplicativo mobile,
API Java (Spring Boot) e servidor de dados (mock legado) — compartilhando um
mesmo contrato HTTP e uma única fonte de verdade (PostgreSQL/Supabase).

O sistema atende quatro perfis de usuário (Administrador, Coordenador,
Instrutor e Recepção), com controle de acesso por perfil e por unidade, e
implementa sincronização incremental com geração segura de identificadores,
autenticação por JWT e confirmação de operações pelo backend.

## 2. Problema e justificativa

Nas unidades do SENAC/DF, a reserva de salas para instrutores era realizada de
forma manual, o que gerava **confusão, complexidade e conflitos de horários**.
As informações ficavam dispersas e difíceis de acompanhar, os processos eram
demorados e propensos a erros, e não havia visualização da disponibilidade em
tempo real, resultando em choques de horário e reservas sobrepostas, com
impacto na rotina dos instrutores e da instituição.

O Conecta-Senac foi desenvolvido para centralizar essas operações, reduzir
conflitos de agendamento, garantir a integridade dos dados e oferecer uma
experiência consistente entre web e mobile, com suporte a uso offline e
sincronização posterior.

### 2.1 Público-alvo

Quatro perfis com permissões específicas para uma gestão segura e eficiente
das salas:

| Perfil | Responsabilidade |
| --- | --- |
| **Instrutor** | Visualiza as turmas que leciona e solicita salas para suas aulas |
| **Recepção** | Consulta o mapa das salas e atribui/devolve chaves |
| **Coordenação** | Cria e gerencia turmas e salas; aprova ou recusa solicitações |
| **Administrador** | Cria e gerencia usuários e unidades, com controle total do sistema |

## 3. Objetivos

### 3.1 Objetivo geral

Desenvolver um sistema integrado de reserva de salas, turmas e chaves para as
unidades do SENAC/DF, com interface web e mobile, backend seguro e
persistência em banco de dados relacional.

### 3.2 Objetivos específicos

- Permitir cadastro, edição e exclusão de usuários, unidades, salas, turmas,
  reservas, chaves, solicitações e notificações.
- Garantir que a geração de identificadores seja feita exclusivamente pelo
  backend, evitando sobrescrita de registros.
- Implementar sincronização incremental e idempotente entre cliente e servidor.
- Assegurar que mensagens de sucesso só sejam exibidas após confirmação da API.
- Manter a identidade visual coerente com o token JWT em abas compartilhadas.
- Validar dados no backend com respostas HTTP adequadas (400/409).
- Proteger senhas com BCrypt e evitar sua persistência em cache local.
- Oferecer funcionamento offline com recuperação de operações pendentes.

## 4. Escopo

**Incluído:**
- Gestão de usuários, unidades, salas, turmas, reservas, chaves, solicitações
  e notificações.
- Painéis por perfil (Admin, Coordenador, Instrutor, Recepção).
- Sincronização web/mobile com o backend.
- Autenticação por e-mail/senha/unidade com JWT.
- Relatórios e auditoria de operações.

**Não incluído (fora do escopo do PI):**
- Integração com sistemas legados do SENAC (folha, acadêmico).
- Notificações push nativas (apenas in-app).
- Multi-idioma.

## 5. Tecnologias utilizadas

| Camada | Tecnologia | Versão |
| --- | --- | --- |
| Frontend Web | TypeScript + Vite | 5.4 |
| Aplicativo Mobile | Expo / React Native / expo-router | 51 / 0.74 |
| API | Spring Boot + JPA + Hibernate | 4.x |
| Banco de dados | PostgreSQL (Supabase) | 14+ |
| Autenticação | JWT (HS256) + BCrypt | — |
| Testes backend | JUnit 5 + MockMvc + Embedded Postgres (zonky) | — |
| Containerização | Docker + Docker Compose | — |
| Deploy | Render (API) + Vercel (Web) | — |

## 6. Arquitetura

O repositório reúne **quatro componentes independentes**:

| Componente | Pasta | Tecnologia | Papel |
| --- | --- | --- | --- |
| Frontend Web | `web/` | TypeScript + Vite 5 | telas para Admin, Coordenador, Instrutor e Recepção |
| Aplicativo Mobile | `mobile/` | Expo 51 / React Native 0.74 / expo-router | app Android/iOS do instrutor e da recepção |
| API Java | `backend/demo/` | Spring Boot 4 + JPA + PostgreSQL | **fonte da verdade dos dados** (Postgres/Supabase) |
| Servidor de dados (mock legado) | `server/` | Node.js puro (CommonJS, sem dependências) | persistência em `server/data/db.json` — **apenas desenvolvimento offline** |

A API Spring Boot (`backend/demo/`, porta 8081) é a **fonte única de verdade**.
Ela roda contra o PostgreSQL do Supabase e serve também o frontend web na mesma
origem. O servidor Node (`server/`, porta 3333) é o **mock legado** e não deve
rodar ao mesmo tempo que a API real.

Endpoints compartilhados (idênticos nas duas camadas):

```
GET  /api/dados      POST /api/sinc      POST /api/login
GET  /api/sessao     POST /api/sessao    POST /api/logout
POST /api/reset
```

## 7. Funcionalidades

- **Login/Logout** com e-mail, senha e unidade, emissão de JWT.
- **Administrador:** gestão de usuários, unidades, visão global de salas/turmas/reservas/chaves.
- **Coordenador:** cadastro de salas, turmas e reservas; aprovação/rejeição de solicitações; mapa de ocupação.
- **Instrutor:** consulta de salas e turmas, envio de solicitações de reserva, notificações.
- **Recepção:** atribuição e devolução de chaves, notificações.
- **Sincronização incremental** com IDs provisórios (negativos) remapeados para IDs oficiais, `operacaoId` idempotente e fila persistente.
- **Calendário interativo** para visualizar salas e horários disponíveis de
  forma clara e atualizada.
- **Tema claro e escuro** com preferência salva automaticamente.
- **Múltiplas unidades** SENAC, vinculando cada usuário à sua unidade.
- **Sessão compartilhada entre abas** com sincronização via evento `storage`.

## 8. Estrutura do projeto

```
Conecta-senac-Atualizado/
├─ backend/demo/        # API Spring Boot (fonte da verdade)
│  ├─ src/main/         # código Java
│  └─ src/test/         # 148 testes (JUnit 5 + Embedded Postgres)
├─ web/                 # Frontend Web (TypeScript + Vite)
│  ├─ src/core/         # camadas transversais (dados, API, DOM, UI, tema, auth)
│  ├─ src/features/     # um módulo por painel
│  ├─ src/entry/        # bootstrap de cada página
│  └─ src/types/        # contrato de domínio (compartilhado com o mobile)
├─ mobile/              # Aplicativo Expo/React Native
├─ server/              # Mock legado (Node.js)
├─ docs/                # Documentação e relatórios
├─ Dockerfile           # imagem multi-stage (API + Web)
├─ compose.yaml         # stack completa
└─ vercel.json / render.yaml
```

## 9. Como executar

### 9.1 Frontend Web (desenvolvimento)

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

Scripts disponíveis:

```bash
npm run typecheck    # tsc --noEmit (strict)
npm run build        # typecheck + vite build -> web/dist
npm run preview      # serve o web/dist recém-gerado
```

### 9.2 Backend Java (sem Docker)

Requer **JDK 21**.

```bash
cd backend/demo
./gradlew bootRun     # porta 8081
```

Suíte de testes:

```bash
cd backend/demo
./gradlew test        # 148 testes (JUnit 5, Embedded Postgres)
```

### 9.3 Stack completa com Docker

```bash
cp .env.example .env
# edite o .env: POSTGRES_PASSWORD=<senha forte>
docker compose up -d --build
# postgres -> 5432   api (Spring Boot + web) -> 8081
```

Depois de subir, semeie os dados de exemplo:

```bash
curl -X POST http://localhost:8081/api/reset
```

### 9.4 Aplicativo Mobile

```bash
cd mobile
npm install
npm run start        # abre o Expo
npm run android
npm run ios
npm run typecheck
```

## 10. Testes e qualidade

- **Backend:** 148 testes automatizados (JUnit 5), incluindo testes com PostgreSQL
  embutido (zonky), regras de negócio, autorização por unidade, concorrência de
  IDs (8 threads × 5 alocações = 40 IDs únicos), sincronização e idempotência.
- **Frontend:** `npm run typecheck` (TypeScript strict) + `npm run build`
  (Vite) sem erros.
- **Integridade:** `git diff --check` sem problemas de whitespace.

## 11. Segurança

- Senhas armazenadas com **BCrypt** no backend.
- Autenticação por **JWT (HS256)** com expiração configurável.
- Autorização por perfil e por unidade em todos os endpoints de sincronização.
- Geração de IDs exclusivamente no backend (`IdAllocatorService` + tabela
  `id_sequences`), evitando sobrescrita por IDs provisórios do cliente.
- Senhas não persistem em cache/localStorage do frontend.
- Validação de entrada com Bean Validation (HTTP 400 + campo) e regras de
  negócio (HTTP 409).

## 12. Resultados

- **Repositório:** 11 commits na branch `main-Versão-4.0` (incluindo merge das correções de segurança/sincronização).
- Sincronização incremental e idempotente validada (reenvio da mesma
  operação não duplica registros).
- Proteção contra sobrescrita cross-unidade verificada (403).
- IDs oficiais alocados pelo backend verificados (mapeamento provisório → oficial).
- Sessões entre abas sincronizadas via evento `storage`.
- Mensagens de sucesso exibidas apenas após confirmação da API.
- Homologação aprovada para produção.

## 13. Equipe

| Nome | Papel | GitHub |
| --- | --- | --- |
| Enzo Aragão Lages | Desenvolvimento Full Stack (Frontend) | Starkbr264 |
| Pedro Vinícius | Desenvolvimento Full Stack (Testes) | pedrov9254-glitch |
| Vitor Roberto | Desenvolvimento Full Stack (Backend) | vitorrobertofp-dev |
| Lucas Fernandes | Revisão e Documentação | Lucas312918 |

**Instrutora:** Rayssa Paiva Carvalho

**Gestão do projeto (Trello):** https://trello.com/invite/b/6ad284a1c417afbdeb0dad2b/ATTIece74ec6782806194aae21fd240ec8b508C17155/conecta-senac

**Protótipo (Figma):** https://www.figma.com/design/7cbXoHtvJIuEe83rg06swh/Sem-t%C3%ADtulo?node-id=0-1&t=diE9zD3tskKT5eum-1

## 14. Documentação

- `docs/DEPLOY.md` — guia de publicação no Supabase, Render e Vercel
- `docs/ARQUITETURA_ATUALIZADA.md` — árvore de diretórios e fluxo de inicialização
- `docs/RELATORIO_FINAL.md` — relatório completo de todas as alterações
- `docs/RELATORIO_REFATORACAO.md` — o que mudou na refatoração e por quê
- `docs/CASO_DE_USO.md` — 15 casos de uso e regras de negócio
- `docs/DOCUMENTACAO_CODIGO.md` — descrição do código original do web
- `docs/DOCUMENTACAO_CONEXAO_WEB_MOBILE.md` — protocolo de sincronização
- `docs/AUDITORIA_RELATORIO_FINAL.md` — relatório consolidado da auditoria de integração
- `docs/AUDITORIA_EVIDENCIAS.md` — evidências detalhadas da auditoria
- `docs/superpowers/plans/2026-11-07-integracao-segura-incremental.md` — plano de implementação

## 15. Referências

- Spring Boot Documentation — https://spring.io/projects/spring-boot
- Vite Documentation — https://vitejs.dev
- Expo Documentation — https://docs.expo.dev
- Supabase Documentation — https://supabase.com/docs
- React Native Documentation — https://reactnative.dev

---

_Projeto Integrador — Curso Técnico em Desenvolvimento de Sistemas, SENAC/DF._
_Última atualização: novembro de 2026._