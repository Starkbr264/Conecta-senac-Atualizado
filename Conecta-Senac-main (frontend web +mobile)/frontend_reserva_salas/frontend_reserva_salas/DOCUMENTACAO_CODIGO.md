# Documentacao do codigo

Este projeto e um front-end de reserva de salas. No momento ele nao usa banco de dados real: os dados ficam salvos no navegador, principalmente em `localStorage`, e a sessao do usuario fica em `sessionStorage`.

## Como o projeto esta dividido

### Paginas HTML

Cada arquivo `.html` representa uma tela ou perfil do sistema.

- `login.html`: tela de entrada do sistema.
- `index.html`: pagina inicial/landing.
- `dashboard.html`: painel geral antigo/compartilhado.
- `admin.html`: area do administrador.
- `coordenador.html`: area do coordenador, com salas, turmas, reservas, mapa e solicitacoes.
- `instrutor.html`: area do instrutor, com turmas, calendario, notificacoes e solicitacao de salas.
- `recepcao.html`: area da recepcao, com mapa, reservas e controle de chaves.

As paginas carregam os arquivos CSS e JS necessarios no final ou no cabecalho. Os botoes e eventos normalmente chamam funcoes JavaScript globais pelo atributo `onclick`, por exemplo `rdSalas()`, `abrirModalSala()` ou `enviarSolic()`.

## CSS

Os arquivos CSS ficam na pasta `css/`. Cada arquivo cuida de um pedaco visual do sistema.

### `css/main.css`

Arquivo central de estilos. Ele importa os outros CSS na ordem correta. Quando voce quiser saber quais estilos entram no projeto, comece por ele.

### `css/variables.css`

Guarda as variaveis visuais do sistema, como cores, raios de borda, sombras, tempo de animacao e tema claro/escuro. Exemplos de variaveis usadas no projeto:

- `--primary`: cor principal.
- `--surface`: fundo principal.
- `--surface2`: fundo secundario.
- `--text`, `--text2`, `--text3`: cores de texto.
- `--border`, `--border2`: cores de borda.
- `--r`: raio padrao de borda.
- `--t`: transicao padrao.

### `css/reset.css`

Remove estilos padrao do navegador e deixa a base visual mais previsivel entre telas.

### `css/layout.css`

Cuida da estrutura geral das paginas internas: sidebar, topo, conteudo principal, cards de secao e responsividade do layout.

### `css/buttons.css`

Define os estilos de botoes reutilizaveis:

- `.btn`: base de botao.
- `.btn-primary`: acao principal.
- `.btn-ghost`: acao secundaria/discreta.
- `.btn-danger`: acao destrutiva.
- `.btn-warning`: acao de aviso.
- `.btn-success`: acao positiva.
- `.btn-refresh`: botao menor usado para atualizar listas ou adicionar itens.
- `.btn-sm`: versao compacta.

### `css/forms.css`

Padroniza formularios:

- `.fg`: grade de formulario.
- `.fg.g2` e `.fg.g3`: grades com 2 ou 3 colunas.
- `.ff`: grupo de campo com label e input/select/textarea.
- `.fmsg`: mensagens inline de erro, sucesso ou aviso.

Quando um input nao parece igual aos outros, geralmente falta colocar o campo dentro de uma `.ff`.

### `css/components.css`

Guarda componentes pequenos e reutilizaveis, como badges, chips e partes especificas do modal de solicitacao de sala.

No modal de solicitacao, por exemplo:

- `.sl-tipo-btn`: botoes de escolha do tipo de data.
- `.sl-date-mode-grid`: grade dos botoes "Data unica", "Periodo" e "Datas avulsas".
- `.sl-date-panel`: caixa visual do grupo de datas.
- `.sl-date-add-row`: linha com input de data e botao adicionar.
- `.sl-date-list`: lista das datas avulsas adicionadas.

### `css/modal.css`

Define o visual dos modais:

- fundo escuro/transparente atras do modal;
- caixa do modal;
- cabecalho;
- botao de fechar;
- rodape com botoes.

As funcoes `modalAbrir(id)` e `modalFechar(id)`, em `storage.js`, controlam a exibicao desses modais.

### `css/table.css`

Estiliza tabelas, linhas vazias, celulas, acoes em tabela e visual de listagens administrativas.

### `css/search.css`

Cuida da barra de busca e filtros reutilizaveis. Trabalha junto com `js/search.js`.

### `css/calendario.css`

Estilos do calendario mensal/semanal:

- filtros de sala e turno;
- grade do mes;
- grade da semana;
- eventos dentro dos dias;
- painel de detalhes do dia selecionado.

### `css/map.css`

Estilos do mapa de salas. Define cards/blocos que mostram salas livres, ocupadas ou em manutencao.

### `css/notifications.css`

Visual das notificacoes:

- item normal;
- item nao lido;
- tipos de notificacao;
- titulo, mensagem e data.

### Outros CSS

- `css/login.css`: tela de login.
- `css/landing.css`: pagina inicial.
- `css/dashboard.css`: dashboard.
- `css/keys.css`: controle de chaves.
- `css/icons.css` e `css/phosphor.css`: icones.
- `css/toast.css`: mensagens temporarias no canto da tela.

## JavaScript principal

Os arquivos JS ficam na pasta `js/`.

### `js/storage.js`

E o "cerebro de dados" do projeto. Como ainda nao existe backend/banco real, esse arquivo simula as operacoes principais.

Ele faz:

- carrega dados do `localStorage`;
- cria dados iniciais quando o navegador ainda nao tem nada salvo;
- salva alteracoes;
- busca usuarios, unidades, salas, turmas, reservas, chaves, notificacoes e solicitacoes;
- adiciona, atualiza e remove registros;
- controla login e sessao;
- controla tema claro/escuro;
- mostra toast;
- abre e fecha modais.

Funcoes importantes:

- `getUsuarios()`, `getSalas()`, `getTurmas()`, `getReservas()`: retornam listas.
- `getSalaById(id)`, `getTurmaById(id)`, `getUserById(id)`: buscam um item especifico.
- `addSala(dados)`, `updSala(id, dados)`, `delSala(id)`: CRUD de salas.
- `addTurma(dados)`, `updTurma(id, dados)`, `delTurma(id)`: CRUD de turmas.
- `addReserva(dados)`, `updReserva(id, dados)`, `delReserva(id)`: CRUD de reservas.
- `addSolic(dados)`, `updSolic(id, dados)`: solicitacoes de sala.
- `addNotif(dados)`: cria notificacao.
- `getSessao()`, `setSessao(usuario)`, `clearSessao()`: sessao do usuario.
- `toast(msg, tipo)`: mensagem rapida na tela.
- `modalAbrir(id)`, `modalFechar(id)`: controle de modal.

Observacao importante: a sessao usa `sessionStorage`, entao trocar de conta em uma aba nao troca automaticamente a conta de outra aba.

### `js/auth.js`

Cuida da protecao das paginas e da navegacao por perfil.

Funcoes importantes:

- `requirePerfil(perfil)`: garante que a pagina so abra para o perfil correto.
- `seJaLogado()`: se o usuario ja esta logado, manda para a tela correta.
- `sair()`: limpa a sessao e volta para o login.
- `initSidebar()`: mostra nome, email e perfil na sidebar.
- `initLogo()`: aplica o logo quando a pagina tem o elemento correto.

### `js/login_page.js`

Controla a tela de login:

- le email e senha;
- chama `loginUser()`;
- salva a sessao;
- redireciona para a pagina do perfil.

### `js/search.js`

Funcoes reutilizaveis de pesquisa e filtro:

- `filtrarLista(lista, termo, campos)`: busca texto em campos de uma lista.
- `aplicarFiltros(lista, filtros)`: aplica filtros em uma lista.
- `htmlBarraBusca(...)`: gera HTML de barra de busca.
- `htmlFiltroSelect(...)`: gera HTML de filtro por select.
- `montarBarraPesquisaFiltros(...)`: monta busca + filtros em uma tela.
- `limparFiltros(...)`: limpa filtros.
- `lerFiltros(config)`: le os valores atuais dos filtros.

## JS por perfil/tela

### `js/admin_page.js`

Controla a tela `admin.html`.

Principais responsabilidades:

- dashboard do administrador;
- gerenciamento de usuarios;
- gerenciamento de unidades;
- listagem geral de salas;
- listagem geral de turmas;
- listagem geral de reservas;
- listagem geral de chaves;
- reset dos dados do sistema.

### `js/coordenador_page.js`

Controla a tela `coordenador.html`.

Principais responsabilidades:

- dashboard da unidade;
- salas;
- turmas;
- reservas;
- instrutores;
- atribuicao de turma;
- mapa de salas;
- solicitacoes recebidas;
- notificacoes.

Esse arquivo conversa bastante com `storage.js`, porque quase toda acao altera dados locais.

### `js/instrutor_page.js`

Controla a tela `instrutor.html`.

Principais responsabilidades:

- mostra turmas do instrutor;
- mostra salas disponiveis;
- abre o modal de solicitacao de sala;
- valida turnos;
- verifica conflitos de reserva;
- envia solicitacoes ao coordenador;
- mostra calendario e notificacoes.

Parte importante do modal de solicitacao:

- `abrirSolic(salaId)`: abre o modal para uma sala.
- `slModoData(modo)`: alterna entre data unica, periodo e datas avulsas.
- `slAdicionarData()`: adiciona uma data avulsa.
- `slRemoverData(iso)`: remove uma data avulsa.
- `verificarDisponibilidadeSolic()`: verifica disponibilidade antes de enviar.
- `enviarSolic()`: cria a solicitacao e notifica o coordenador.

### `js/recepcao_page.js`

Controla a tela `recepcao.html`.

Principais responsabilidades:

- mapa de salas para recepcao;
- reservas futuras;
- controle de chaves;
- atribuir chave para usuario;
- devolver/liberar chave;
- notificacoes da recepcao.

### `js/calendario_page.js`

Renderiza o calendario usado nas telas.

Ele possui funcoes internas para:

- formatar datas;
- descobrir inicio da semana;
- filtrar reservas;
- renderizar mes;
- renderizar semana;
- mostrar detalhes do dia.

Funcoes globais usadas pela interface:

- `calHoje()`: volta para hoje.
- `calPrev()`: periodo anterior.
- `calNext()`: proximo periodo.
- `calModo(modo)`: muda entre mes e semana.
- `calFiltrar()`: aplica filtros.
- `calDia(iso)`: seleciona um dia.

## JS antigos ou compartilhados

Alguns arquivos parecem ser versoes antigas ou modulos usados por telas anteriores:

- `js/admin.js`
- `js/coordenador.js`
- `js/instrutor.js`
- `js/recepcao.js`
- `js/script.js`
- `js/salas.js`
- `js/turmas.js`
- `js/reservas.js`
- `js/disponibilidade.js`
- `js/dashboard_page.js`
- `js/index_page.js`

Antes de apagar qualquer um, verifique se alguma pagina ainda carrega esse script. Alguns podem estar duplicando logica dos arquivos `*_page.js`.

## Fluxo de login

1. Usuario abre `login.html`.
2. `login_page.js` chama `loginUser(email, senha)`.
3. `storage.js` procura o usuario nos dados locais.
4. Se encontrar, `setSessao(usuario)` salva a sessao.
5. O usuario e redirecionado conforme o perfil:
   - admin: `admin.html`
   - coordenador: `coordenador.html`
   - instrutor: `instrutor.html`
   - recepcao: `recepcao.html`

## Fluxo de solicitacao de sala

1. Instrutor abre `instrutor.html`.
2. Escolhe uma sala e clica para solicitar.
3. `abrirSolic(salaId)` abre o modal.
4. O instrutor escolhe data unica, periodo ou datas avulsas.
5. `verificarDisponibilidadeSolic()` verifica conflitos.
6. `enviarSolic()` valida os dados e cria a solicitacao com `addSolic()`.
7. `addNotif()` cria uma notificacao para o coordenador.
8. Coordenador ve a solicitacao em `coordenador.html`.
9. Coordenador aprova ou recusa.
10. O sistema atualiza a solicitacao e notifica o instrutor.

## Fluxo de reservas

Uma reserva normalmente possui:

- `salaId`: sala reservada.
- `turmaId`: turma vinculada, quando existir.
- `dataInicio`: inicio da reserva.
- `dataFim`: fim da reserva.
- `diasSemana`: dias em que a reserva ocorre.
- `turno`: Matutino, Vespertino ou Noturno.
- `status`: status da reserva.
- `unidadeId`: unidade da reserva.

Para verificar conflito, o codigo compara:

- mesma sala;
- mesmo turno;
- periodo de datas sobreposto;
- dia da semana em comum;
- reserva ainda ativa ou avulsa.

## Fluxo de notificacoes

As notificacoes ficam salvas em `storage.js`.

Campos comuns:

- `paraPerfil`: perfil que recebe.
- `unidadeId`: unidade relacionada.
- `tipo`: tipo visual da notificacao.
- `titulo`: titulo exibido.
- `msg`: mensagem exibida.
- `lida`: se ja foi lida.
- `criadaEm`: data/hora de criacao.

Cada tela renderiza suas notificacoes com uma funcao propria, por exemplo `rdNotifs()`.

## Fluxo do mapa de salas

O mapa de salas pega as salas da unidade e cruza com reservas, turmas e status manual.

Estados comuns:

- livre;
- ocupada;
- manutencao/bloqueada;
- sem dados.

Normalmente a funcao `rdMapa()` e responsavel por montar o HTML do mapa.

## Como ler o projeto sem se perder

Uma boa ordem de leitura e:

1. `index.html` ou `login.html`, para entender entrada.
2. `js/storage.js`, para entender os dados.
3. `js/auth.js`, para entender sessao/perfis.
4. A pagina HTML do perfil que voce quer estudar.
5. O JS correspondente, por exemplo `instrutor.html` + `js/instrutor_page.js`.
6. Os CSS ligados ao visual daquela tela.

## Pontos de atencao

- O projeto usa funcoes globais, entao nomes repetidos podem causar conflito.
- IDs duplicados no HTML causam bugs porque `document.getElementById()` pega apenas um deles.
- Como os dados estao no navegador, limpar o cache/localStorage apaga o "banco".
- Como nao ha backend real, duas pessoas em computadores diferentes nao compartilham os mesmos dados.
- O codigo mistura alguns arquivos novos com arquivos antigos. Antes de remover algo, confira se o HTML ainda importa aquele script.

