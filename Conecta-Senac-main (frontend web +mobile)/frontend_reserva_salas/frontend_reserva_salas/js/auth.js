/*
 * auth.js
 * Autenticacao e controle de sessao.
 *
 * requirePerfil(perfil) — redireciona se o usuario nao tiver o perfil correto
 * initSidebar          — preenche nome e iniciais na sidebar
 * initLogo             — exibe logo da unidade ou texto fallback
 * seJaLogado           — redireciona para o painel se ja houver sessao ativa
 * sair                 — encerra a sessao e volta ao login
 */
var _ROTAS = {
  admin:'admin.html', coordenador:'coordenador.html',
  instrutor:'instrutor.html', recepcao:'recepcao.html'
};

// Verifica se o usuario tem o perfil correto para a pagina
function requirePerfil(perfil) {
  var s = getSessao();
  if (!s || s.perfil !== perfil) { window.location.replace('login.html'); }
}

// Redireciona para o painel se ja houver sessao ativa
function seJaLogado() {
  var s = getSessao(); if (!s) return;
  if (_ROTAS[s.perfil]) window.location.replace(_ROTAS[s.perfil]);
}

// Encerra a sessao e volta para o login
function sair() { clearSessao(); window.location.replace('login.html'); }


// Preenche a sidebar com nome, iniciais e perfil do usuario
function initSidebar() {
  var s = getSessao(); if (!s) return;
  var el = function(id){ return document.getElementById(id); };
  if (el('sbNome'))     el('sbNome').textContent     = s.nome;
  if (el('sbIniciais')) el('sbIniciais').textContent = iniciais(s.nome);
  if (el('sbUnidade') && s.unidadeId) {
    var u = getUnidadeById(s.unidadeId);
    if (u && el('sbUnidade')) el('sbUnidade').textContent = u.nome;
  }
  initTema();
}


// Exibe o logo da unidade ou texto fallback
function initLogo() {
  var img  = document.getElementById('logoImg');
  var wrap = document.getElementById('logoWrap');
  var txt  = document.getElementById('logoTxt');
  if (!img) return;
  if (img.getAttribute('src')) {
    if (txt) txt.style.display = 'none';
  } else {
    if (wrap) wrap.style.display = 'none';
  }
}
