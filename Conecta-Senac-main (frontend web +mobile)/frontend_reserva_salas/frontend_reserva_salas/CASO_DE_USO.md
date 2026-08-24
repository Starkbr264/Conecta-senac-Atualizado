# Caso de Uso — Sistema de Reserva de Salas SENAC-GDF
**Versão:** 4 (CSS Modular + Mapa v2 + Andar/Bloco + Pesquisa Global)
**Tecnologias:** HTML5 · CSS3 modular · JavaScript puro · localStorage

---

## 1. Visão Geral do Sistema

O **Sistema de Reserva de Salas SENAC-GDF** é uma aplicação web front-end que gerencia a ocupação de salas nas 10 unidades do SENAC no Distrito Federal. Não há servidor nem banco de dados — toda a persistência é feita via `localStorage` do navegador.

### Principais características da versão atual

- **Dados seed completos** carregados automaticamente no primeiro acesso (30 salas, 30 turmas, 30 reservas, 20 chaves, 40 usuários, 10 unidades)
- **Pesquisa e filtros** em todas as telas de todas as telas (usuários, unidades, salas, turmas, reservas, chaves)
- **Mapa de Salas v2** com cards ricos organizados por Bloco → Andar, com indicação de turno, status colorido e filtros em tempo real
- **Campos Andar e Bloco** na criação e edição de salas
- **CSS 100% modular**: 15 arquivos separados por responsabilidade, importados por um único `main.css`

---

## 2. Atores

| Ator | Login de exemplo | Senha |
|---|---|---|
| **Administrador** | `Senac_GDF@Hotmail.com` | `Senac.DF2007` |
| **Coordenador** (Asa Norte) | `coord.asanorte@senacdf.com` | `Coord@123` |
| **Coordenador** (Taguatinga) | `coord.taguatinga@senacdf.com` | `Coord@123` |
| **Instrutor** (Asa Norte) | `katia.barros@senacdf.com` | `Inst@123` |
| **Instrutor** (Ceilândia) | `natan.ferreira@senacdf.com` | `Inst@123` |
| **Recepção** (Asa Norte) | `recep.asanorte@senacdf.com` | `Recep@123` |

> Todos os demais usuários seguem o mesmo padrão de e-mail e senha por perfil. Para resetar o sistema ao estado inicial, faça login como Administrador e clique em **⚠️ Resetar dados** na barra lateral.

---

## 3. Dados Seed (carregados automaticamente no 1º acesso)

| Entidade | Quantidade | Detalhes |
|---|---|---|
| Unidades | 10 | Asa Norte, Asa Sul, Taguatinga, Ceilândia, Gama, Sobradinho, Planaltina, Samambaia, Santa Maria, Águas Claras — com endereço e CEP reais do DF |
| Usuários | 40 | 10 coordenadores + 10 instrutores + 10 recepcionistas (1 de cada por unidade) |
| Salas | 30 | 3 por unidade, com **andar** e **bloco** definidos — labs de informática, gastronomia, estética, enfermagem, ciências, salas comuns, auditórios, videoconferência |
| Turmas | 30 | 3 por unidade — cursos técnicos e livres com datas relativas ao dia atual (ativas, iminentes, posteriores) |
| Reservas | 30 | 1 por turma, com dias da semana variados e períodos correspondentes às turmas |
| Chaves | 20 | 2 por unidade — 10 disponíveis e 10 já retiradas por instrutores, com horário de retirada registrado |

---

## 4. Casos de Uso

### UC-01 — Login
**Atores:** Todos  
**Fluxo principal:** o usuário acessa `index.html`, informa e-mail e senha e clica em "Entrar". O sistema valida as credenciais no `localStorage` (ou contra o admin fixo em memória), grava a sessão e redireciona para a tela do perfil correspondente.  
**Fluxo alternativo:** credenciais inválidas exibem mensagem de erro sem redirecionar.  
**Tela:** `index.html` / `login.html`

---

### UC-02 — Gerenciar Unidades *(Administrador)*
**Tela:** `admin.html` → aba **Unidades / CPS**  
**Funcionalidades:**
- Criar, editar e excluir unidades (nome, endereço, CEP, cidade)
- **Pesquisa em tempo real** por nome, cidade ou CEP

**Restrição:** não é possível excluir uma unidade com usuários vinculados — o sistema exibe quantos usuários estão vinculados.

---

### UC-03 — Gerenciar Usuários *(Administrador)*
**Tela:** `admin.html` → aba **Usuários**  
**Funcionalidades:**
- Criar, editar, redefinir senha e excluir usuários (coordenadores, instrutores, recepcionistas)
- **Filtros disponíveis:**
  - Busca textual por nome ou e-mail
  - Filtrar por perfil (coordenador / instrutor / recepção)
  - Filtrar por unidade
- Contador de resultados atualizado em tempo real

**Restrição:** e-mails devem ser únicos. Novos usuários exigem senha definida no cadastro.

---

### UC-04 — Visão Global do Sistema *(Administrador)*
**Tela:** `admin.html` → abas **Salas**, **Turmas**, **Reservas**, **Chaves**  
**Descrição:** o administrador visualiza e pesquisa registros de **todas as unidades** em uma única tela. Modo somente leitura (sem edição).

**Filtros por aba:**

| Aba | Busca textual | Filtros de seleção |
|---|---|---|
| Salas | Nome, tipo | Unidade, Tipo de sala |
| Turmas | Código, curso | Unidade, Turno, Status |
| Reservas | Sala, turma, turno | Unidade, Turno, Status |
| Chaves | Código, sala, andar | Unidade, Status (disponível/retirada) |

---

### UC-05 — Gerenciar Salas *(Coordenador)*
**Tela:** `coordenador.html` → aba **Salas**  
**Funcionalidades:** criar, editar e excluir salas da própria unidade.

**Campos da sala:**
- Nome / Número (ex: "Lab 03")
- Capacidade (número de pessoas)
- Tipo (texto livre — ex: Laboratório de Informática, Sala comum, Auditório…)
- **Andar** *(novo)* — ex: Térreo, 1º Andar, 2º Andar
- **Bloco** *(novo)* — ex: Bloco A, Bloco B, Principal
- Turnos disponíveis (Matutino / Vespertino / Noturno — múltipla escolha via chips)

**Pesquisa e filtros:** busca por nome/tipo/andar/bloco; filtro por tipo de sala.  
**Tabela:** exibe colunas Nome, Andar, Bloco, Capacidade, Tipo, Turnos.  
**Restrição:** não é possível excluir sala com reservas ativas vinculadas.

---

### UC-06 — Gerenciar Turmas *(Coordenador)*
**Tela:** `coordenador.html` → aba **Turmas**  
**Funcionalidades:** criar, editar e excluir turmas da própria unidade.

**Campos da turma:** código, curso, turno, data de início, data de fim, instrutor responsável (selecionado entre os instrutores da unidade).

**Status calculado automaticamente:**
- **Ativa** — já iniciou e ainda não encerrou
- **Iminente** — início em até 30 dias
- **Posterior** — início distante
- **Encerrada** — data de fim no passado

**Pesquisa e filtros:** busca por código/curso/instrutor; filtro por turno e status.  
**Restrição:** ao excluir uma turma, todas as reservas vinculadas são removidas automaticamente.

---

### UC-07 — Criar Reserva Recorrente *(Coordenador)*
**Tela:** `coordenador.html` → aba **Reservas**  
**Descrição:** vincula uma sala a uma turma para dias da semana recorrentes dentro de um período.

**Dados da reserva:** sala, turma, turno, dias da semana (seg/ter/qua/qui/sex/sáb — múltipla escolha), data de início e data de fim.

**Validações:**
1. O turno da reserva deve estar disponível na sala selecionada
2. A data fim não pode ultrapassar a data fim da turma
3. O sistema detecta **conflitos automáticos**: mesma sala + mesmo turno + dias sobrepostos + períodos que se cruzam → exibe mensagem indicando qual turma conflita e em quais dias

**Pesquisa e filtros:** busca por sala/turma; filtro por turno.

---

### UC-08 — Atribuir Instrutor a Turma *(Coordenador)*
**Tela:** `coordenador.html` → aba **Instrutores**  
**Descrição:** o coordenador seleciona um instrutor da sua unidade e atribui uma turma a ele. A turma passa a aparecer no painel do instrutor.

**Pesquisa:** busca de instrutor por nome ou e-mail.

---

### UC-09 — Mapa de Salas *(Coordenador e Recepção)*
**Telas:** `coordenador.html` e `recepcao.html` → aba **Mapa de Salas**

**Descrição:** exibe visualmente todas as salas da unidade organizadas hierarquicamente por **Bloco → Andar**, com cards ricos mostrando:

| Elemento do card | O que exibe |
|---|---|
| Nome + dot colorido | Identificação e status visual imediato |
| Tipo de sala | Ex: Laboratório de Informática |
| 🏢 Andar | Ex: 1º Andar |
| 📍 Bloco | Ex: Bloco A |
| 👥 Capacidade | Número de pessoas |
| Badges M / V / N | Turnos disponíveis — o turno em uso fica destacado em azul |
| Turma + Instrutor + Turno | Quando ocupada ou iminente |
| "🟢 Disponível" | Quando livre |

**Status dos cards:**
- 🟢 **Verde** — livre no dia/turno atual
- 🔴 **Vermelho** — turma ativa reservada para hoje
- 🟡 **Amarelo** — turma iminente reservada para hoje

**Filtros do mapa (em tempo real):**
- Busca por nome ou tipo de sala
- Filtrar por Bloco
- Filtrar por Andar
- Filtrar por Turno disponível
- Filtrar por Status (livre / ocupada / em breve)

**Legenda dinâmica:** mostra contadores atualizados de salas livres, ocupadas e em breve + total filtrado.

A recepção também vê a **tabela de próximas reservas** (próximos 14 dias) com sala, andar, bloco, turma, instrutor, período e dias.

---

### UC-10 — Gerenciar Chaves *(Recepção)*
**Tela:** `recepcao.html` → aba **Chaves**  
**Descrição:** a recepção cadastra as chaves físicas de cada sala e controla quem as retirou.

**Campos da chave:** código (ex: "CH-001"), sala vinculada, andar.  
**Ações:** criar, editar, excluir; registrar retirada (vincula instrutor + horário automático); registrar devolução.

**Pesquisa e filtros:** busca por código/sala/andar/nome do instrutor; filtro por status (disponível / retirada).  
**Visualização:** cards com ícone 🗝️ (disponível) ou 🔑 (retirada), nome da sala, código, andar, instrutor e horário de retirada.

---

### UC-11 — Retirar / Devolver Chave *(Instrutor)*
**Tela:** `instrutor.html` → aba **Chaves**  
**Descrição:** o instrutor sinaliza retirada ou devolução de uma chave. O sistema registra o horário e envia notificação à recepção.

---

### UC-12 — Solicitar Sala *(Instrutor)*
**Tela:** `instrutor.html` → aba **Solicitar Sala**  
**Descrição:** o instrutor visualiza as salas disponíveis na unidade (com status colorido) e envia uma solicitação de uso avulso ao coordenador informando data, turno e motivo.

**Fluxo:** solicitação criada com status "pendente" → coordenador aprova ou recusa → instrutor recebe notificação do resultado.

---

### UC-13 — Visualizar Minhas Turmas *(Instrutor)*
**Tela:** `instrutor.html` → aba **Minhas Turmas**  
**Descrição:** o instrutor vê todas as turmas atribuídas a ele com sala reservada, status e período.

**Pesquisa e filtros:** busca por código/curso; filtro por status (ativa / iminente / posterior / encerrada).

---

### UC-14 — Responder Solicitações *(Coordenador)*
**Tela:** `coordenador.html` → aba **Solicitações**  
**Descrição:** o coordenador visualiza as solicitações de sala pendentes de instrutores e as aprova ou recusa com um clique. O instrutor recebe notificação automática com o resultado.

---

### UC-15 — Verificar Disponibilidade *(Coordenador)*
**Tela:** `coordenador.html` → aba **Mapa de Salas** (filtro por status "Livre") ou `dashboard.html` → seção Disponibilidade  
**Descrição:** permite identificar salas livres para um turno e período específicos, seja pelo mapa visual com filtros ou pela ferramenta de verificação de disponibilidade do painel antigo.

---

## 5. Pesquisa e Filtros — Resumo Completo

| Tela / Aba | Busca textual | Filtros de seleção |
|---|---|---|
| Admin → Usuários | Nome, e-mail | Perfil, Unidade |
| Admin → Unidades | Nome, cidade, CEP | — |
| Admin → Salas | Nome, tipo | Unidade, Tipo de sala |
| Admin → Turmas | Código, curso | Unidade, Turno, Status |
| Admin → Reservas | Sala, turma, turno | Unidade, Turno, Status |
| Admin → Chaves | Código, sala, andar | Unidade, Status |
| Coordenador → Salas | Nome, tipo, andar, bloco | Tipo de sala |
| Coordenador → Turmas | Código, curso, instrutor | Turno, Status |
| Coordenador → Reservas | Sala, turma | Turno |
| Coordenador → Instrutores | Nome, e-mail | — |
| Coordenador → Mapa | Nome, tipo | Bloco, Andar, Turno, Status |
| Recepção → Mapa | Nome, tipo | Bloco, Andar, Turno, Status |
| Recepção → Chaves | Código, sala, andar | Status |
| Instrutor → Turmas | Código, curso | Status |
| Dashboard → Salas | Nome, tipo | Tipo, Turno disponível |
| Dashboard → Turmas | Código, curso | Turno, Status |
| Dashboard → Reservas | Sala, turma, turno | Turno, Status |

Todas as barras incluem **botão "Limpar filtros"** e **contador de resultados em tempo real**.

---

## 6. Estrutura de Arquivos

```
Reserva_de_salas_v2/
├── index.html            — Tela de login (roteamento por perfil)
├── login.html            — Alias de login
├── admin.html            — Painel do administrador
├── coordenador.html      — Painel do coordenador
├── recepcao.html         — Painel da recepção
├── instrutor.html        — Painel do instrutor
├── dashboard.html        — Painel antigo (salas/turmas/reservas/disponibilidade)
│
├── css/
│   ├── main.css          ← ÚNICO arquivo referenciado nos HTMLs
│   │                        Importa todos os módulos abaixo em ordem
│   ├── variables.css     — Tokens de design: cores, sombras, tipografia, temas claro/escuro
│   ├── reset.css         — Normalização base, utilitários globais, animações
│   ├── login.css         — Tela de login: caixa, logo, campos, botão
│   ├── layout.css        — Sidebar, topbar, estrutura de página, tema escuro
│   ├── components.css    — Cards, stats, badges, chips, status de turma
│   ├── forms.css         — Inputs, selects, textareas, mensagens de feedback
│   ├── buttons.css       — Todos os estilos de botão
│   ├── table.css         — Tabelas de dados (.tbl, .tw, .empty-row)
│   ├── modal.css         — Overlays e caixas de diálogo
│   ├── toast.css         — Pop-ups de feedback breve (#toasts)
│   ├── notifications.css — Itens de notificação e solicitação
│   ├── keys.css          — Cards de chaves físicas
│   ├── map.css           — Mapa de salas v2 (bloco/andar/cards ricos)
│   ├── search.css        — Barras de pesquisa e filtros globais
│   └── dashboard.css     — Classes exclusivas do dashboard.html
│
├── js/
│   ├── storage.js        — Camada de dados + seed completo (v4)
│   ├── auth.js           — Autenticação e controle de sessão
│   ├── search.js         — Motor de pesquisa e gerador de filtros
│   ├── admin_page.js     — Lógica do painel admin (com busca e 7 abas)
│   ├── coordenador_page.js — Lógica do painel coordenador (com busca + mapa v2)
│   ├── recepcao_page.js  — Lógica do painel recepção (com busca + mapa v2)
│   ├── instrutor_page.js — Lógica do painel instrutor (com busca)
│   ├── dashboard_page.js — Inicialização do dashboard antigo
│   ├── salas.js          — CRUD de salas + busca (dashboard)
│   ├── turmas.js         — CRUD de turmas + busca (dashboard)
│   ├── reservas.js       — CRUD de reservas + busca + detecção de conflito
│   └── disponibilidade.js — Verificação de disponibilidade
│
└── img/
    └── senac-logo-sem-fundo.webp
```

---

## 7. Arquitetura CSS Modular

Todos os HTMLs referenciam **apenas `css/main.css`**, que usa `@import` para carregar os módulos na ordem correta:

```
HTML → main.css → variables.css
                → reset.css
                → login.css
                → layout.css
                → components.css
                → forms.css
                → buttons.css
                → table.css
                → modal.css
                → toast.css
                → notifications.css
                → keys.css
                → map.css
                → search.css
                → dashboard.css
```

**Vantagens:** para modificar o visual de qualquer parte do sistema, basta editar o arquivo correspondente — sem risco de afetar outros componentes. As variáveis de `variables.css` propagam automaticamente para todos os módulos, incluindo o tema escuro.

---

## 8. Fluxo Completo de Uso Típico

**Cenário:** primeiro dia de aula de uma nova turma na unidade Asa Norte.

1. **Admin** (`Senac_GDF@Hotmail.com`) faz login → vê no dashboard 30 salas, 30 turmas, 30 reservas → pesquisa "Asa Norte" na aba Salas para confirmar as salas cadastradas.

2. **Coordenadora** Ana Paula (`coord.asanorte@senacdf.com`) faz login → vai em **Salas** → cadastra nova sala "Lab 04" com Andar "2º Andar", Bloco "Bloco C", tipo "Laboratório de Informática", turnos Matutino e Noturno.

3. Ana Paula vai em **Turmas** → cria turma "2025.04.104", curso "Técnico em Redes", turno Matutino, atribui a instrutora Katia Barros.

4. Ana Paula vai em **Reservas** → seleciona Lab 04 + turma 2025.04.104 → marca seg/ter/qua/qui/sex → o sistema valida o turno e confirma ausência de conflito → reserva criada.

5. Ana Paula vai em **Mapa de Salas** → filtra por "Bloco C" → vê Lab 04 no card verde (🟢 Livre), com badges M e N nos turnos disponíveis.

6. **Recepcionista** Úrsula (`recep.asanorte@senacdf.com`) faz login → vê o mapa → Lab 04 ainda livre (aula começa amanhã) → cadastra a chave "CH-021" para Lab 04, andar "2º Andar".

7. **Instrutora** Katia (`katia.barros@senacdf.com`) faz login → vai em **Minhas Turmas** → vê a turma 2025.04.104 com Lab 04 reservado e status Iminente → vai em **Chaves** → sinaliza retirada da CH-021.

8. Úrsula recebe notificação → vê no mapa da recepção que Lab 04 está agora com status 🟡 (em breve, turma começa amanhã).

9. No dia seguinte, o mapa atualiza automaticamente: Lab 04 aparece 🔴 (ocupada) durante o turno Matutino, com nome da turma e da instrutora no card.

---

## 9. Logins de Teste Rápido

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | Senac_GDF@Hotmail.com | Senac.DF2007 |
| Coord. Asa Norte | coord.asanorte@senacdf.com | Coord@123 |
| Coord. Taguatinga | coord.taguatinga@senacdf.com | Coord@123 |
| Coord. Ceilândia | coord.ceilandia@senacdf.com | Coord@123 |
| Instrutor Asa Norte | katia.barros@senacdf.com | Inst@123 |
| Instrutor Gama | olivia.martins@senacdf.com | Inst@123 |
| Recepção Asa Norte | recep.asanorte@senacdf.com | Recep@123 |
| Recepção Águas Claras | recep.aguasclaras@senacdf.com | Recep@123 |
