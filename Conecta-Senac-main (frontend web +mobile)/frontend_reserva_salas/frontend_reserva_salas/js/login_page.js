/*
 * login_page.js
 * Logica da tela de login.
 *
 * - Carrega as unidades disponveis no select
 * - Valida email e senha contra os dados do storage
 * - Redireciona para o painel correto conforme o perfil do usuario:
 *     admin       -> admin.html
 *     coordenador -> coordenador.html
 *     instrutor   -> instrutor.html
 *     recepcao    -> recepcao.html
 */
window.addEventListener('DOMContentLoaded', async function() {
  await initDados();
  if (typeof initTema === 'function') initTema();
  seJaLogado();
  initLogo();


  (function() {
// Popula o select com as unidades cadastradas
    var sel = document.getElementById('selUnidade');
    var uns = getUnidades();
    if (!uns.length) {
      var o = document.createElement('option');
      o.value = ''; o.textContent = 'Nenhuma unidade cadastrada';
      sel.innerHTML = ''; sel.appendChild(o);
    } else {
      uns.forEach(function(u) {
        var o = document.createElement('option');
        o.value = u.id;
        o.textContent = u.nome + (u.cep ? ' — ' + u.cep : '');
        sel.appendChild(o);
      });
    }
  })();

// Listener de submit do formulario de login
  document.getElementById('fLogin').addEventListener('submit', async function(ev) {
    ev.preventDefault();
    var email = document.getElementById('inpEmail').value.trim();
    var senha = document.getElementById('inpSenha').value;
// Popula o select com as unidades cadastradas
    var uid   = parseInt(document.getElementById('selUnidade').value) || null;
    var msg   = document.getElementById('loginMsg');

    function erro(txt) {
      msg.className = 'login-msg erro'; msg.textContent = txt; msg.style.display = 'block';
    }

    if (!email || !senha) { erro('Preencha e-mail e senha.'); return; }

    var u;
    try {
      u = await loginUser(email, senha);
    } catch (e) {
      erro('E-mail ou senha incorretos.');
      document.getElementById('inpSenha').value = '';
      document.getElementById('inpSenha').focus();
      return;
    }
    if (!u) {
      erro('E-mail ou senha incorretos.');
      document.getElementById('inpSenha').value = '';
      document.getElementById('inpSenha').focus();
      return;
    }


    if (u.perfil !== 'admin') {
      if (!uid && getUnidades().length > 0) { erro('Selecione sua unidade.'); return; }
      if (u.unidadeId && uid && u.unidadeId !== uid) { erro('Unidade incorreta para este usuário.'); return; }
    }

    setSessao(Object.assign({}, u, { unidadeId: u.unidadeId || uid }));
    msg.className = 'login-msg ok';
    msg.textContent = 'Acesso autorizado! Redirecionando…';
    msg.style.display = 'block';

    var rotas = { admin:'admin.html', coordenador:'coordenador.html', instrutor:'instrutor.html', recepcao:'recepcao.html' };
    setTimeout(function(){ window.location.href = rotas[u.perfil] || 'login.html'; }, 500);
  });
});
