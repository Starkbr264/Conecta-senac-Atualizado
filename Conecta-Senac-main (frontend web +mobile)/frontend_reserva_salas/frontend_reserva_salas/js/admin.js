var _editUnidId = null;
var _editUserId = null;


function initAdmin() {
  var s = getSessao();
  _tx('sbNome',     s.nome);
  _tx('sbIniciais', iniciais(s.nome));
  initTema();
  ir('dashboard');
}


function ir(aba) {
  document.querySelectorAll('.pg').forEach(function(p) {
    p.classList.remove('on'); p.style.display = 'none';
  });
  var pg = document.getElementById('pg-' + aba);
  if (pg) { pg.classList.add('on'); pg.style.display = 'block'; }

  document.querySelectorAll('.sb-btn').forEach(function(b) { b.classList.remove('on'); });
  var btn = document.getElementById('nav-' + aba);
  if (btn) btn.classList.add('on');

  var meta = {
    dashboard: { t:'Dashboard',      s:'Visão geral do sistema' },
    usuarios:  { t:'Usuários',       s:'Gerenciar coordenadores, instrutores e recepção' },
    unidades:  { t:'Unidades / CPS', s:'Unidades do SENAC no GDF' },
  };
  var m = meta[aba] || {};
  _tx('tbTitle', m.t || ''); _tx('tbSub', m.s || '');

  if (aba === 'dashboard') rdDash();
  if (aba === 'usuarios')  rdUsuarios();
  if (aba === 'unidades')  rdUnidades();
}


function rdDash() {
  var todos = getUsuarios();
  _tx('stUsers', todos.length);
  _tx('stCoord', getUsuariosByPerfil('coordenador').length);
  _tx('stInst',  getUsuariosByPerfil('instrutor').length);
  _tx('stUnid',  getUnidades().length);

  var tb = document.getElementById('tbUsers');
  if (!todos.length) {
    tb.innerHTML = '<tr class="tbl-empty"><td colspan="5">Nenhum usuário cadastrado. Vá em Usuários para criar.</td></tr>';
    return;
  }
  var pBdg = { coordenador:'coord', instrutor:'instrutor', recepcao:'recepcao' };
  tb.innerHTML = todos.map(function(u) {
    var unid = u.unidadeId ? getUnidadeById(u.unidadeId) : null;
    return '<tr>'
      + '<td><strong>' + esc(u.nome) + '</strong></td>'
      + '<td class="mono">' + esc(u.email) + '</td>'
      + '<td><span class="sb-badge ' + (pBdg[u.perfil]||'') + '" style="margin:0">' + esc(u.perfil) + '</span></td>'
      + '<td>' + esc(unid ? unid.nome : '—') + '</td>'
      + '<td><span class="bdg bdg-green">Ativo</span></td>'
      + '</tr>';
  }).join('');
}


function rdUnidades() {
  var list = getUnidades();
  var tb   = document.getElementById('tbUnidades');
  if (!list.length) {
    tb.innerHTML = '<tr class="tbl-empty"><td colspan="4">Nenhuma unidade cadastrada.</td></tr>';
    return;
  }
  tb.innerHTML = list.map(function(u) {
    return '<tr>'
      + '<td><strong>' + esc(u.nome) + '</strong></td>'
      + '<td style="font-size:.82rem">' + esc(u.endereco||'—') + '</td>'
      + '<td class="mono">' + esc(u.cep||'—') + '</td>'
      + '<td style="display:flex;gap:6px;padding:10px 12px">'
      +   '<button class="btn btn-ghost btn-sm" onclick="abrirModalUnid(' + u.id + ')">Editar</button>'
      +   '<button class="btn btn-danger btn-sm" onclick="excluirUnid(' + u.id + ')">Excluir</button>'
      + '</td></tr>';
  }).join('');
}


function abrirModalUnid(id) {
  _editUnidId = id || null;
  var u = id ? getUnidadeById(id) : null;
  _tx('munTitulo', id ? 'Editar Unidade' : 'Nova Unidade');
  _vl('munNome',     u ? u.nome : '');
  _vl('munEndereco', u ? (u.endereco||'') : '');
  _vl('munCep',      u ? (u.cep||'')      : '');
  hideMsg('munMsg');
  _modal('modalUnid', true);
}
function fecharModalUnid() { _modal('modalUnid', false); _editUnidId = null; }

function salvarUnid() {
  var nome     = _gv('munNome').trim();
  var endereco = _gv('munEndereco').trim();
  var cep      = _gv('munCep').trim();
  if (!nome) { showMsg('munMsg','erro','Informe o nome da unidade.'); return; }

  if (_editUnidId) {
    updUnidade(_editUnidId, { nome:nome, endereco:endereco, cep:cep });
    showToast('Unidade atualizada!', 'ok');
  } else {
    addUnidade({ nome:nome, endereco:endereco, cep:cep });
    showToast('Unidade criada!', 'ok');
  }
  fecharModalUnid(); rdUnidades();
}

function excluirUnid(id) {
  var u = getUnidadeById(id); if (!u) return;
  var vincul = getUsuarios().filter(function(x){ return x.unidadeId===id; }).length;
  if (vincul > 0) { showToast('Há ' + vincul + ' usuário(s) nesta unidade. Mova-os primeiro.','erro'); return; }
  if (!confirm('Excluir "' + u.nome + '"?')) return;
  delUnidade(id); showToast('Unidade excluída.','aviso'); rdUnidades();
}


function rdUsuarios() {
  var list = getUsuarios();
  var tb   = document.getElementById('tbUsuarios');
  if (!list.length) {
    tb.innerHTML = '<tr class="tbl-empty"><td colspan="6">Nenhum usuário cadastrado ainda.</td></tr>';
    return;
  }
  var pBdg = { coordenador:'coord', instrutor:'instrutor', recepcao:'recepcao' };
  tb.innerHTML = list.map(function(u) {
    var unid = u.unidadeId ? getUnidadeById(u.unidadeId) : null;
    return '<tr>'
      + '<td><strong>' + esc(u.nome) + '</strong></td>'
      + '<td class="mono">' + esc(u.email) + '</td>'
      + '<td><span class="sb-badge ' + (pBdg[u.perfil]||'') + '" style="margin:0">' + esc(u.perfil) + '</span></td>'
      + '<td>' + esc(unid ? unid.nome : '—') + '</td>'
      + '<td><span class="bdg bdg-green">Ativo</span></td>'
      + '<td style="display:flex;gap:5px;padding:10px 12px">'
      +   '<button class="btn btn-ghost btn-sm" onclick="abrirModalUser(' + u.id + ')">Editar</button>'
      +   '<button class="btn btn-warning btn-sm" onclick="resetarSenha(' + u.id + ')">Reset Senha</button>'
      +   '<button class="btn btn-danger btn-sm" onclick="excluirUser(' + u.id + ')">Excluir</button>'
      + '</td></tr>';
  }).join('');
}


function abrirModalUser(id) {
  _editUserId = id || null;
  var u = id ? getUsuarioById(id) : null;
  _tx('muTitulo', id ? 'Editar Usuário' : 'Novo Usuário');
  _vl('muNome',  u ? u.nome  : '');
  _vl('muEmail', u ? u.email : '');
  _vl('muSenha', '');
  if (u) _vl('muPerfil', u.perfil);


  var sel = document.getElementById('muUnidade');
  sel.innerHTML = '<option value="">— Selecione a unidade —</option>';
  getUnidades().forEach(function(un) {
    var o = document.createElement('option');
    o.value = un.id; o.textContent = un.nome;
    if (u && u.unidadeId === un.id) o.selected = true;
    sel.appendChild(o);
  });

  hideMsg('muMsg');
  _modal('modalUser', true);
}
function fecharModalUser() { _modal('modalUser', false); _editUserId = null; }

function salvarUser() {
  var nome      = _gv('muNome').trim();
  var email     = _gv('muEmail').trim();
  var senha     = _gv('muSenha').trim();
  var perfil    = _gv('muPerfil');
  var unidadeId = parseInt(_gv('muUnidade')) || null;

  if (!nome)      { showMsg('muMsg','erro','Informe o nome completo.'); return; }
  if (!email)     { showMsg('muMsg','erro','Informe o e-mail.'); return; }
  if (!perfil)    { showMsg('muMsg','erro','Selecione o perfil / tela.'); return; }
  if (!unidadeId) { showMsg('muMsg','erro','Selecione a unidade.'); return; }
  if (!_editUserId && !senha) { showMsg('muMsg','erro','Defina uma senha para o novo usuário.'); return; }

  var existe = getUsuarios().find(function(u) {
    return u.email.toLowerCase() === email.toLowerCase() && u.id !== _editUserId;
  });
  if (existe) { showMsg('muMsg','erro','Este e-mail já está em uso.'); return; }

  var dados = { nome:nome, email:email, perfil:perfil, unidadeId:unidadeId };
  if (senha) dados.senha = senha;

  if (_editUserId) {
    updUsuario(_editUserId, dados);
    showToast('Usuário atualizado!', 'ok');
  } else {
    addUsuario(dados);
    showToast('Usuário criado com sucesso!', 'ok');
  }
  fecharModalUser(); rdUsuarios(); rdDash();
}

function resetarSenha(id) {
  var u = getUsuarioById(id); if (!u) return;
  var nova = prompt('Nova senha para "' + u.nome + '":');
  if (!nova || !nova.trim()) { showToast('Operação cancelada.','aviso'); return; }
  updUsuario(id, { senha: nova.trim() });
  showToast('Senha de "' + u.nome + '" redefinida!', 'ok');
}

function excluirUser(id) {
  var u = getUsuarioById(id); if (!u) return;
  if (!confirm('Excluir "' + u.nome + '"? Esta ação não pode ser desfeita.')) return;
  delUsuario(id); showToast('Usuário excluído.','aviso'); rdUsuarios(); rdDash();
}


function _modal(id, abrir) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('on', abrir);
}
function _tx(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
function _vl(id, v) { var e = document.getElementById(id); if (e) e.value = v; }
function _gv(id)    { var e = document.getElementById(id); return e ? e.value : ''; }
