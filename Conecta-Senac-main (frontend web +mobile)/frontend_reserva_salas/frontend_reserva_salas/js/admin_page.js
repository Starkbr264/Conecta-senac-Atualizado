/*
 * admin_page.js
 * Painel do Administrador.
 *
 * Secoes:
 *   Dashboard  — totais de usuarios, unidades, salas e reservas
 *   Usuarios   — CRUD com filtro por perfil e busca textual
 *   Unidades   — CRUD de unidades/CPS com CEP
 *   Salas      — visao global de todas as salas do sistema
 *   Turmas     — visao global de todas as turmas
 *   Reservas   — visao global de todas as reservas
 *   Chaves     — visao global de todas as chaves
 *   Calendario — calendario de reservas de todas as unidades
 *
 * Funcao principal: ir(aba) — navega entre as secoes
 */
﻿
var _editUserId = null;
var _editUnidId = null;

window.addEventListener('DOMContentLoaded', async function() {
  await initDados(); requirePerfil('admin'); initSidebar(); initLogo(); ir('dashboard');
});

var _META = {
  dashboard: { t:'Dashboard',       s:'Visão geral do sistema' },
  usuarios:  { t:'Usuários',        s:'Gerenciar coordenadores, instrutores e recepção' },
  unidades:  { t:'Unidades / CPS',  s:'Unidades e centros do SENAC no GDF' },
  salas:     { t:'Salas',           s:'Todas as salas do sistema' },
  turmas:    { t:'Turmas',          s:'Todas as turmas do sistema' },
  reservas:  { t:'Reservas',        s:'Todas as reservas do sistema' },
  chaves:    { t:'Chaves',          s:'Todas as chaves do sistema' },
  calendario:{ t:'Calendário de Reservas', s:'Visualize todas as reservas por data e turno' },
};

// Navegacao entre secoes
function ir(aba) {
  document.querySelectorAll('.pg').forEach(function(p){ p.classList.remove('ativa'); p.style.display='none'; });
  var pg = document.getElementById('pg-'+aba);
  if (pg) { pg.classList.add('ativa'); pg.style.display='block'; }
  document.querySelectorAll('.sb-btn').forEach(function(b){ b.classList.remove('ativo'); });
  var btn = document.getElementById('nav-'+aba); if (btn) btn.classList.add('ativo');
  var m = _META[aba]||{};
  document.getElementById('tbTitle').textContent = m.t||aba;
  document.getElementById('tbSub').textContent   = m.s||'';
  if (aba==='dashboard') rdDash();
  if (aba==='usuarios')  rdUsuarios();
  if (aba==='unidades')  rdUnidades();
  if (aba==='salas')     rdTodasSalas();
  if (aba==='turmas')    rdTodasTurmas();
  if (aba==='reservas')  rdTodasReservas();
  if (aba==='chaves')    rdTodasChaves();
  if (aba==='calendario')  rdCalendario();
}


// Dashboard — totais do sistema
function rdDash() {
  var us = getUsuarios();
  document.getElementById('stTotal').textContent  = us.length;
  document.getElementById('stCoord').textContent  = getUsersByPerfil('coordenador').length;
  document.getElementById('stInst').textContent   = getUsersByPerfil('instrutor').length;
  document.getElementById('stUnid').textContent   = getUnidades().length;
  document.getElementById('stSalas').textContent  = getSalas().length;
  document.getElementById('stTurmas').textContent = getTurmas().length;
  document.getElementById('stResv').textContent   = getReservas().length;
  document.getElementById('stChav').textContent   = getChaves().length;
  var tb = document.getElementById('tbDash');
  if (!us.length) { tb.innerHTML='<tr class="empty-row"><td colspan="4">Nenhum usuário.</td></tr>'; return; }
  var pBdg={coordenador:'bdg-blue',instrutor:'bdg-green',recepcao:'bdg-amber'};
  tb.innerHTML = us.slice(0,10).map(function(u){
    var unid=u.unidadeId?getUnidadeById(u.unidadeId):null;
    return '<tr><td><strong>'+esc(u.nome)+'</strong></td><td class="mono">'+esc(u.email)+'</td>'
      +'<td><span class="bdg '+(pBdg[u.perfil]||'bdg-muted')+'">'+esc(u.perfil)+'</span></td>'
      +'<td>'+esc(unid?unid.nome:'—')+'</td></tr>';
  }).join('');
}


var _cfgUsuarios = {
  busca: { id:'buscarUsuario', placeholder:'Pesquisar por nome, e-mail…' },
  filtros: [
    { id:'filtPerfilUser',  label:'Perfil',   campo:'perfil',    opcoes:[{value:'coordenador',label:'Coordenador'},{value:'instrutor',label:'Instrutor'},{value:'recepcao',label:'Recepção'}] },
    { id:'filtUnidUser',    label:'Unidade',  campo:'unidadeId', opcoes:[] },
  ]
};

// Usuarios — listagem e CRUD com filtros
function rdUsuarios() {
  _cfgUsuarios.filtros[1].opcoes = getUnidades().map(function(u){return {value:u.id,label:u.nome};});
  var cont = document.getElementById('searchUsuarios');
  if (cont && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchUsuarios', _cfgUsuarios, _renderTbUsuarios);
  } else {
    _atualizarFiltroUnidades('filtUnidUser');
  }
  _renderTbUsuarios();
}

function _atualizarFiltroUnidades(selId) {
  var sel = document.getElementById(selId); if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">Todos</option>'
    + getUnidades().map(function(u){return '<option value="'+u.id+'"'+(String(u.id)===String(cur)?' selected':'')+'>'+esc(u.nome)+'</option>';}).join('');
}

function _renderTbUsuarios() {
  var vals = lerFiltros(_cfgUsuarios);
  var list = getUsuarios();

  list = filtrarLista(list, vals._busca, ['nome','email']);

  if (vals.perfil)    list = list.filter(function(u){ return u.perfil === vals.perfil; });
  if (vals.unidadeId) list = list.filter(function(u){ return String(u.unidadeId) === String(vals.unidadeId); });

  document.getElementById('countUsuarios').textContent = list.length + ' usuário(s)';
  var tb = document.getElementById('tbUsuarios');
  if (!list.length) { tb.innerHTML='<tr class="empty-row"><td colspan="5">Nenhum usuário encontrado.</td></tr>'; return; }
  var pBdg={coordenador:'bdg-blue',instrutor:'bdg-green',recepcao:'bdg-amber'};
  tb.innerHTML = list.map(function(u){
    var unid=u.unidadeId?getUnidadeById(u.unidadeId):null;
    return '<tr><td><strong>'+esc(u.nome)+'</strong></td><td class="mono">'+esc(u.email)+'</td>'
      +'<td><span class="bdg '+(pBdg[u.perfil]||'bdg-muted')+'">'+esc(u.perfil)+'</span></td>'
      +'<td>'+esc(unid?unid.nome:'—')+'</td>'
      +'<td><div class="td-actions">'
      +'<button class="btn btn-ghost btn-sm" onclick="abrirUser('+u.id+')">Editar</button>'
      +'<button class="btn btn-warning btn-sm" onclick="resetSenha('+u.id+')">Reset Senha</button>'
      +'<button class="btn btn-danger btn-sm" onclick="excluirUser('+u.id+')">Excluir</button>'
      +'</div></td></tr>';
  }).join('');
}

// Modal de criar/editar usuario
function abrirUser(id) {
  _editUserId = id||null; var u=id?getUserById(id):null;
  document.getElementById('mUTitulo').textContent = id?'Editar Usuário':'Novo Usuário';
  document.getElementById('mUNome').value  = u?u.nome:'';
  document.getElementById('mUEmail').value = u?u.email:'';
  document.getElementById('mUSenha').value = '';
  if (u) document.getElementById('mUPerfil').value = u.perfil;
  var sel=document.getElementById('mUUnidade');
  sel.innerHTML='<option value="">— Selecione a unidade —</option>';
  getUnidades().forEach(function(un){
    var o=document.createElement('option');o.value=un.id;o.textContent=un.nome;
    if(u&&u.unidadeId===un.id)o.selected=true; sel.appendChild(o);
  });
  fmsgHide('mUMsg'); modalAbrir('modalUser');
}
function fecharUser(){ modalFechar('modalUser'); _editUserId=null; }
// Salva o usuario
function salvarUser(){
  var nome=document.getElementById('mUNome').value.trim();
  var email=document.getElementById('mUEmail').value.trim();
  var senha=document.getElementById('mUSenha').value.trim();
  var perfil=document.getElementById('mUPerfil').value;
  var unidadeId=parseInt(document.getElementById('mUUnidade').value)||null;
  if(!nome){fmsg('mUMsg','erro','Informe o nome.');return;}
  if(!email){fmsg('mUMsg','erro','Informe o e-mail.');return;}
  if(!perfil){fmsg('mUMsg','erro','Selecione o perfil.');return;}
  if(!unidadeId){fmsg('mUMsg','erro','Selecione a unidade.');return;}
  if(!_editUserId&&!senha){fmsg('mUMsg','erro','Defina uma senha.');return;}
  var existe=getUsuarios().find(function(u){return u.email.toLowerCase()===email.toLowerCase()&&u.id!==_editUserId;});
  if(existe){fmsg('mUMsg','erro','Este e-mail já está em uso.');return;}
  var dados={nome:nome,email:email,perfil:perfil,unidadeId:unidadeId};
  if(senha)dados.senha=senha;
  if(_editUserId){updUser(_editUserId,dados);toast('Usuário atualizado!','ok');}
  else{addUser(dados);toast('Usuário criado!','ok');}
  fecharUser(); rdUsuarios(); rdDash();
}
function resetSenha(id){
  var u=getUserById(id);if(!u)return;
  var nova=prompt('Nova senha para "'+u.nome+'":');
  if(!nova||!nova.trim())return;
  updUser(id,{senha:nova.trim()}); toast('Senha de "'+u.nome+'" redefinida!','ok');
}
// Remove o usuario apos confirmacao
function excluirUser(id){
  var u=getUserById(id);if(!u)return;
  if(!confirm('Excluir "'+u.nome+'"?\nEsta ação não pode ser desfeita.'))return;
  delUser(id); toast('Usuário excluído.','aviso'); rdUsuarios(); rdDash();
}


var _cfgUnidades = {
  busca: { id:'buscarUnidade', placeholder:'Pesquisar por nome, cidade, CEP…' },
  filtros: []
};

// Unidades — listagem e CRUD
function rdUnidades() {
  var cont=document.getElementById('searchUnidades');
  if(cont&&!cont.innerHTML) montarBarraPesquisaFiltros('searchUnidades',_cfgUnidades,_renderTbUnidades);
  _renderTbUnidades();
}
function _renderTbUnidades(){
  var vals=lerFiltros(_cfgUnidades);
  var list=getUnidades();
  list=filtrarLista(list,vals._busca,['nome','cidade','cep','endereco']);
  document.getElementById('countUnidades').textContent=list.length+' unidade(s)';
  var tb=document.getElementById('tbUnidades');
  if(!list.length){tb.innerHTML='<tr class="empty-row"><td colspan="4">Nenhuma unidade encontrada.</td></tr>';return;}
  tb.innerHTML=list.map(function(u){
    return '<tr><td><strong>'+esc(u.nome)+'</strong><div style="font-size:.78rem;color:var(--text3)">'+esc(u.cidade||'')+'</div></td>'
      +'<td class="txt2">'+esc(u.endereco||'—')+'</td><td class="mono">'+esc(u.cep||'—')+'</td>'
      +'<td><div class="td-actions">'
      +'<button class="btn btn-ghost btn-sm" onclick="abrirUnid('+u.id+')">Editar</button>'
      +'<button class="btn btn-danger btn-sm" onclick="excluirUnid('+u.id+')">Excluir</button>'
      +'</div></td></tr>';
  }).join('');
}
// Modal de criar/editar unidade
function abrirUnid(id){
  _editUnidId=id||null; var u=id?getUnidadeById(id):null;
  document.getElementById('mNTitulo').textContent=id?'Editar Unidade':'Nova Unidade';
  document.getElementById('mNNome').value    =u?u.nome:'';
  document.getElementById('mNEndereco').value=u?(u.endereco||''):'';
  document.getElementById('mNCep').value     =u?(u.cep||''):'';
  fmsgHide('mNMsg'); modalAbrir('modalUnid');
}
function fecharUnid(){ modalFechar('modalUnid'); _editUnidId=null; }
// Salva os dados da unidade
function salvarUnid(){
  var nome=document.getElementById('mNNome').value.trim();
  var endereco=document.getElementById('mNEndereco').value.trim();
  var cep=document.getElementById('mNCep').value.trim();
  if(!nome){fmsg('mNMsg','erro','Informe o nome da unidade.');return;}
  if(_editUnidId){updUnidade(_editUnidId,{nome:nome,endereco:endereco,cep:cep});toast('Unidade atualizada!','ok');}
  else{addUnidade({nome:nome,endereco:endereco,cep:cep});toast('Unidade criada!','ok');}
  fecharUnid(); rdUnidades(); rdDash();
}
function excluirUnid(id){
  var u=getUnidadeById(id);if(!u)return;
  var vincul=getUsuarios().filter(function(x){return x.unidadeId===id;}).length;
  if(vincul>0){toast('Não é possível excluir: '+vincul+' usuário(s) vinculado(s).','erro');return;}
  if(!confirm('Excluir "'+u.nome+'"?'))return;
  delUnidade(id); toast('Unidade excluída.','aviso'); rdUnidades(); rdDash();
}


var _cfgSalasAdmin = {
  busca:{id:'buscarSalaAdmin',placeholder:'Pesquisar sala por nome, tipo…'},
  filtros:[
    {id:'filtUnidSala',label:'Unidade',campo:'unidadeId',opcoes:[]},
    {id:'filtTipoSala',label:'Tipo',   campo:'tipo',     opcoes:[
      {value:'Laboratório de Informática',label:'Lab. Informática'},
      {value:'Laboratório de Gastronomia',label:'Lab. Gastronomia'},
      {value:'Laboratório de Enfermagem', label:'Lab. Enfermagem'},
      {value:'Laboratório de Estética',   label:'Lab. Estética'},
      {value:'Laboratório de Ciências',   label:'Lab. Ciências'},
      {value:'Sala de Aula comum',        label:'Sala Comum'},
      {value:'Auditório',                 label:'Auditório'},
      {value:'Sala de Reunião',           label:'Sala Reunião'},
      {value:'Sala de Videoconferência',  label:'Videoconf.'},
    ]},
  ]
};
// Visao global — todas as salas do sistema
function rdTodasSalas(){
  _cfgSalasAdmin.filtros[0].opcoes=getUnidades().map(function(u){return{value:u.id,label:u.nome};});
  var cont=document.getElementById('searchSalasAdmin');
  if(cont&&!cont.innerHTML) montarBarraPesquisaFiltros('searchSalasAdmin',_cfgSalasAdmin,_renderTbSalasAdmin);
  else _atualizarFiltroUnidades('filtUnidSala');
  _renderTbSalasAdmin();
}
function _renderTbSalasAdmin(){
  var vals=lerFiltros(_cfgSalasAdmin);
  var list=getSalas();
  list=filtrarLista(list,vals._busca,['nome','tipo']);
  if(vals.unidadeId) list=list.filter(function(s){return String(s.unidadeId)===String(vals.unidadeId);});
  if(vals.tipo)      list=list.filter(function(s){return s.tipo===vals.tipo;});
  document.getElementById('countSalasAdmin').textContent=list.length+' sala(s)';
  var tb=document.getElementById('tbSalasAdmin');
  if(!list.length){tb.innerHTML='<tr class="empty-row"><td colspan="5">Nenhuma sala encontrada.</td></tr>';return;}
  tb.innerHTML=list.map(function(s){
    var unid=getUnidadeById(s.unidadeId);
    var turnos=(s.turnos||s.turnosDisponiveis||[]).map(function(t){return'<span class="bdg bdg-primary">'+t+'</span>';}).join(' ');
    return '<tr><td><strong>'+esc(s.nome)+'</strong></td>'
      +'<td>'+esc(unid?unid.nome:'—')+'</td>'
      +'<td>'+esc(s.tipo)+'</td>'
      +'<td>'+s.capacidade+' pess.</td>'
      +'<td>'+turnos+'</td></tr>';
  }).join('');
}


var _cfgTurmasAdmin = {
  busca:{id:'buscarTurmaAdmin',placeholder:'Pesquisar turma, curso, instrutor…'},
  filtros:[
    {id:'filtUnidTurma', label:'Unidade', campo:'unidadeId', opcoes:[]},
    {id:'filtTurnoTurma',label:'Turno',   campo:'turno',     opcoes:[{value:'Matutino',label:'Matutino'},{value:'Vespertino',label:'Vespertino'},{value:'Noturno',label:'Noturno'}]},
    {id:'filtStatusTurma',label:'Status', campo:'_status',   opcoes:[{value:'ativa',label:'Ativa'},{value:'iminente',label:'Iminente'},{value:'posterior',label:'Posterior'},{value:'encerrada',label:'Encerrada'}]},
  ]
};
// Visao global — todas as turmas
function rdTodasTurmas(){
  _cfgTurmasAdmin.filtros[0].opcoes=getUnidades().map(function(u){return{value:u.id,label:u.nome};});
  var cont=document.getElementById('searchTurmasAdmin');
  if(cont&&!cont.innerHTML) montarBarraPesquisaFiltros('searchTurmasAdmin',_cfgTurmasAdmin,_renderTbTurmasAdmin);
  else _atualizarFiltroUnidades('filtUnidTurma');
  _renderTbTurmasAdmin();
}
function _renderTbTurmasAdmin(){
  var vals=lerFiltros(_cfgTurmasAdmin);
  var list=getTurmas().map(function(t){return Object.assign({},t,{_status:calcStatus(t)});});
  list=filtrarLista(list,vals._busca,['nome','curso',function(t){var i=getUserById(t.instrutorId);return i?i.nome:'';}]);
  if(vals.unidadeId) list=list.filter(function(t){return String(t.unidadeId)===String(vals.unidadeId);});
  if(vals.turno)     list=list.filter(function(t){return t.turno===vals.turno;});
  if(vals['_status'])list=list.filter(function(t){return t._status===vals['_status'];});
  document.getElementById('countTurmasAdmin').textContent=list.length+' turma(s)';
  var tb=document.getElementById('tbTurmasAdmin');
  if(!list.length){tb.innerHTML='<tr class="empty-row"><td colspan="6">Nenhuma turma encontrada.</td></tr>';return;}
  tb.innerHTML=list.map(function(t){
    var unid=getUnidadeById(t.unidadeId); var inst=t.instrutorId?getUserById(t.instrutorId):null;
    return '<tr><td class="mono"><strong>'+esc(t.nome)+'</strong></td>'
      +'<td>'+esc(t.curso)+'</td>'
      +'<td>'+esc(unid?unid.nome:'—')+'</td>'
      +'<td>'+esc(inst?inst.nome:'—')+'</td>'
      +'<td><span class="bdg bdg-primary">'+esc(t.turno)+'</span></td>'
      +'<td>'+htmlStatus(t)+'</td></tr>';
  }).join('');
}


var _cfgResAdmin = {
  busca:{id:'buscarResAdmin',placeholder:'Pesquisar sala, turma, turno…'},
  filtros:[
    {id:'filtUnidRes', label:'Unidade', campo:'unidadeId', opcoes:[]},
    {id:'filtTurnoRes',label:'Turno',   campo:'turno',     opcoes:[{value:'Matutino',label:'Matutino'},{value:'Vespertino',label:'Vespertino'},{value:'Noturno',label:'Noturno'}]},
    {id:'filtStatusRes',label:'Status', campo:'status',    opcoes:[{value:'ATIVA',label:'ATIVA'},{value:'CANCELADA',label:'CANCELADA'}]},
  ]
};
// Visao global — todas as reservas
function rdTodasReservas(){
  _cfgResAdmin.filtros[0].opcoes=getUnidades().map(function(u){return{value:u.id,label:u.nome};});
  var cont=document.getElementById('searchResAdmin');
  if(cont&&!cont.innerHTML) montarBarraPesquisaFiltros('searchResAdmin',_cfgResAdmin,_renderTbResAdmin);
  else _atualizarFiltroUnidades('filtUnidRes');
  _renderTbResAdmin();
}
function _renderTbResAdmin(){
  var vals=lerFiltros(_cfgResAdmin);
  var list=getReservas();
  list=filtrarLista(list,vals._busca,[
    function(r){var s=getSalaById(r.salaId);return s?s.nome:'';},
    function(r){var t=getTurmaById(r.turmaId);return t?t.nome:'';},
    'turno'
  ]);
  if(vals.unidadeId) list=list.filter(function(r){return String(r.unidadeId)===String(vals.unidadeId);});
  if(vals.turno)     list=list.filter(function(r){return r.turno===vals.turno;});
  if(vals.status)    list=list.filter(function(r){return r.status===vals.status;});
  document.getElementById('countResAdmin').textContent=list.length+' reserva(s)';
  var tb=document.getElementById('tbResAdmin');
  if(!list.length){tb.innerHTML='<tr class="empty-row"><td colspan="6">Nenhuma reserva encontrada.</td></tr>';return;}
  tb.innerHTML=list.map(function(r){
    var sala=getSalaById(r.salaId); var turma=r.turmaId?getTurmaById(r.turmaId):null; var unid=getUnidadeById(r.unidadeId);
    var turmaLabel = r.avulsa ? '<span class="bdg bdg-amber">Sem turma</span>' : esc(turma?turma.nome:'—');
    return '<tr><td><strong>'+esc(sala?sala.nome:'—')+'</strong></td>'
      +'<td class="mono">'+turmaLabel+'</td>'
      +'<td>'+esc(unid?unid.nome:'—')+'</td>'
      +'<td><span class="bdg bdg-primary">'+esc(r.turno)+'</span></td>'
      +'<td style="font-size:.82rem">'+fmtData(r.dataInicio)+' → '+fmtData(r.dataFim)+'</td>'
      +'<td><span class="bdg '+(r.status==='ATIVA'?'bdg-green':'bdg-red')+'">'+esc(r.status)+'</span></td></tr>';
  }).join('');
}


var _cfgChavAdmin = {
  busca:{id:'buscarChavAdmin',placeholder:'Pesquisar por código, sala, andar…'},
  filtros:[
    {id:'filtUnidChav',  label:'Unidade', campo:'unidadeId', opcoes:[]},
    {id:'filtStatusChav',label:'Status',  campo:'status',    opcoes:[{value:'disponivel',label:'Disponível'},{value:'pega',label:'Retirada'}]},
  ]
};
// Visao global — todas as chaves
function rdTodasChaves(){
  _cfgChavAdmin.filtros[0].opcoes=getUnidades().map(function(u){return{value:u.id,label:u.nome};});
  var cont=document.getElementById('searchChavAdmin');
  if(cont&&!cont.innerHTML) montarBarraPesquisaFiltros('searchChavAdmin',_cfgChavAdmin,_renderTbChavAdmin);
  else _atualizarFiltroUnidades('filtUnidChav');
  _renderTbChavAdmin();
}
function _renderTbChavAdmin(){
  var vals=lerFiltros(_cfgChavAdmin);
  var list=getChaves();
  list=filtrarLista(list,vals._busca,[
    'codigo','andar',
    function(c){var s=getSalaById(c.salaId);return s?s.nome:'';},
    function(c){var u=getUserById(c.instrutorId);return u?u.nome:'';}
  ]);
  if(vals.unidadeId) list=list.filter(function(c){return String(c.unidadeId)===String(vals.unidadeId);});
  if(vals.status)    list=list.filter(function(c){return c.status===vals.status;});
  document.getElementById('countChavAdmin').textContent=list.length+' chave(s)';
  var tb=document.getElementById('tbChavAdmin');
  if(!list.length){tb.innerHTML='<tr class="empty-row"><td colspan="5">Nenhuma chave encontrada.</td></tr>';return;}
  tb.innerHTML=list.map(function(c){
    var sala=getSalaById(c.salaId); var unid=getUnidadeById(c.unidadeId); var quem=c.instrutorId?getUserById(c.instrutorId):null;
    return '<tr><td><strong>'+esc(c.codigo||'—')+'</strong></td>'
      +'<td>'+esc(sala?sala.nome:'—')+'</td>'
      +'<td>'+esc(unid?unid.nome:'—')+'</td>'
      +'<td>'+esc(c.andar||'—')+'</td>'
      +'<td><span class="bdg '+(c.status==='disponivel'?'bdg-green':'bdg-amber')+'">'+(c.status==='disponivel'?'Disponível':'Retirada por '+(quem?quem.nome:'?'))+'</span></td></tr>';
  }).join('');
}
