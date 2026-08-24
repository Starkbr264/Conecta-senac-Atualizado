# SENAC Reservas — Sistema de Reserva de Salas

Projeto integrador do SENAC GDF: um sistema completo de **organização e gestão de salas** que ajuda os **coordenadores** a visualizar o **mapa de salas** e as **reservas feitas pelos instrutores**, evitando conflitos de horário e centralizando todo o fluxo de solicitações, aprovações e controle de chaves.

O sistema é dividido em três partes que compartilham o **mesmo banco de dados**:

1. **Servidor central** ([Node.js](server/index.js)) — fonte da verdade compartilhada
2. **Web** ([frontend_reserva_salas/](frontend_reserva_salas/)) — painéis em HTML/CSS/JS
3. **Mobile** ([src/](src/)) — app em React Native + Expo

> **Para que serve:** facilitar a organização e a orientação dos coordenadores diante do mapa de salas e das reservas feitas pelos instrutores, garantindo que cada sala seja usada de forma planejada, sem choques de agenda e com todo o histórico de solicitações registrado.

---

## Como funciona

### Arquitetura

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│      WEB        │     │   SERVIDOR CENTRAL   │     │     MOBILE      │
│ (frontend_res-  │◄───►│   server/index.js    │◄───►│  (React Native  │
│  erva_salas/)   │     │   porta 3333         │     │   + Expo)       │
└─────────────────┘     │   server/data/db.json│     └─────────────────┘
                        └──────────────────────┘
```

- O **servidor central** roda em `http://localhost:3333`, serve o web como arquivos estáticos e expõe a API REST consumida pelo mobile:
  - `GET  /api/dados` → baixa o banco completo (sincronização inicial)
  - `POST /api/sinc`  → envia alterações locais (merge por id)
  - `POST /api/login` → valida e-mail/senha
  - `POST /api/reset` → recarrega os dados de exemplo
- **Web e mobile sincronizam contra o mesmo banco** (`server/data/db.json`): o que é alterado no web aparece no mobile e vice-versa. Cada cliente mantém um cache local (localStorage no web, AsyncStorage no mobile) e funciona offline, sincronizando quando o servidor volta.

### Fluxo principal

1. **Instrutor** solicita uma sala (data única, período ou datas avulsas + turnos + horário + motivo);
2. **Coordenador** recebe a solicitação e **aprova ou recusa** — pode escrever um **comentário** que fica visível para o instrutor;
3. Ao **aprovar**, o sistema **cria a reserva automaticamente** e atualiza o mapa de salas e o calendário;
4. **Recepção** controla a **retirada e devolução de chaves** das salas reservadas.

---

## Como rodar

Requisitos: Node.js instalado.

```bash
# 1) Instale as dependências do projeto (mobile)
npm install
```

### Servidor central (web + API)

```bash
node server/index.js
```

| Recurso        | Endereço                       |
|----------------|--------------------------------|
| Web            | http://localhost:3333          |
| API (mobile)   | http://localhost:3333/api/dados|

### Mobile (Expo)

```bash
npx expo start
```

- Aperte `a` para abrir no Android ou `i` para abrir no iOS
- Ou escaneie o QR code com o app **Expo Go** no celular (na mesma rede Wi-Fi)

> O app mobile descobre sozinho o IP da máquina para conectar na API (porta 3333).

---

## Credenciais de teste

| Perfil       | Email                          | Senha         |
|--------------|--------------------------------|---------------|
| Admin        | Senac_GDF@Hotmail.com          | Senac.DF2007  |
| Coordenador  | coord.asanorte@senacdf.com     | Coord@123     |
| Instrutor    | katia.barros@senacdf.com       | Inst@123      |
| Recepção     | recep.asanorte@senacdf.com     | Recep@123     |

---

## Funcionalidades por perfil

| Perfil       | Funcionalidades |
|--------------|-----------------|
| **Admin**    | Dashboard geral, CRUD de usuários e unidades, visão global de salas, turmas, reservas e chaves, resetar dados de exemplo. |
| **Coordenador** | Dashboard da unidade, mapa de salas com status em tempo real, CRUD de salas/turmas/reservas, aprovar/recusar solicitações (com comentário e criação automática da reserva), notificações. |
| **Instrutor** | Minhas turmas, solicitar sala, **acompanhar pedidos** (status e comentário/resposta do coordenador), chaves sob sua responsabilidade, notificações. |
| **Recepção**  | Mapa de salas (somente leitura), controle de chaves (atribuir, reatribuir, liberar, devolver), notificações. |

---

## Estrutura de pastas

```
reservasenac/
├── server/                     # Servidor central (fonte da verdade)
│   ├── index.js                #   API REST + arquivos estáticos do web
│   ├── seed.js                 #   dados de exemplo (IDs fixos)
│   └── data/db.json            #   banco compartilhado (gera no 1º acesso)
├── frontend_reserva_salas/     # Web (HTML/CSS/JS puro)
│   ├── login.html, admin.html, coordenador.html,
│   │   instrutor.html, recepcao.html, calendario...
│   └── js/
│       ├── storage.js          #   cache + sincronização com o servidor
│       ├── coordenador_page.js #   painel do coordenador (solicitações/comentários)
│       └── ...
└── src/                        # Mobile (React Native + Expo)
    ├── app/                    #   telas (Expo Router)
    │   ├── login/              #   login
    │   ├── admin/              #   painel do administrador
    │   ├── coordenador/        #   painel do coordenador
    │   ├── instrutor/          #   painel do instrutor (aba "Pedidos")
    │   └── recepcao/           #   painel da recepção
    ├── components/             #   componentes reutilizáveis
    ├── hooks/                  #   useAuth, useRequirePerfil
    ├── services/               #   api.ts (HTTP) + storage.ts (CRUD/sinc)
    ├── types/                  #   tipos TypeScript
    ├── constants/              #   cores
    ├── theme/                  #   tema claro/escuro
    └── utils/                  #   cálculo de status das salas
```

---

## Stack

- **Servidor:** Node.js puro (http, fs, path) — sem dependências externas
- **Web:** HTML + CSS + JavaScript puro (localStorage + fetch)
- **Mobile:** React Native + Expo (SDK 51), Expo Router, TypeScript, AsyncStorage, @expo/vector-icons

---

## Documentação técnica

Detalhes da conexão web ↔ mobile e dos comentários de solicitações estão em:
[**DOCUMENTACAO_CONEXAO_WEB_MOBILE.txt**](DOCUMENTACAO_CONEXAO_WEB_MOBILE.txt)

---

**Storage (modificações recentes)**
- **Arquivo:** [frontend_reserva_salas/frontend_reserva_salas/js/storage.js](frontend_reserva_salas/frontend_reserva_salas/js/storage.js#L1)
- **Descrição:** o `storage` passou a funcionar como uma camada local/"API": mantém um `CACHE` em memória, persiste em `localStorage` e sincroniza com o servidor central quando possível (`/api/sinc`, `/api/dados`, `/api/login`).
- **Comportamento offline:** CRUDs funcionam contra o cache/localStorage; remoções são enfileiradas (`_remocoes`) e propagadas ao servidor quando a sincronização ocorrer.
- **Exposição:** várias funções utilitárias e operações CRUD são expostas no escopo global (`window`) para uso pela interface web (ex.: `initDados()`, `getUnidades()`, `addUnidade()`, `delUnidade(id)`).

**Observação importante**
- Foi detectado que as "unidades" exibidas na tela de login podem não ser exclusivas — a remoção de uma unidade via `delUnidade(id)` não realiza validação de referências (por exemplo, salas, turmas ou usuários apontando para essa unidade). Recomenda-se:
  - Revisar o fluxo de exclusão de `unidades` e aplicar checagens/cascade apropriados no servidor e/ou na UI;
  - Impedir exclusões na UI quando existirem referências relacionadas ou avisar claramente o usuário sobre consequências;
  - Garantir validação no servidor para não aceitar referências órfãs.

Se desejar, posso abrir uma branch `front correção`, commitar essa documentação e preparar o push/PR para o seu repositório.
