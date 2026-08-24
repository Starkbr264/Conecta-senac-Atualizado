const DIAS_SEM = [{v:'seg',l:'SEG'},{v:'ter',l:'TER'},{v:'qua',l:'QUA'},
                  {v:'qui',l:'QUI'},{v:'sex',l:'SEX'},{v:'sab',l:'SÁB'}];
const TURNOS   = ['Matutino','Vespertino','Noturno'];
const MESES    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

let _sess, _editSalaId=null, _editTurmaId=null, _editResId=null;

function initCoordenador() {
  requirePerfil('coordenador');
  _sess = getSessao();
  initSidebar('coord');
  initNotifBadge('coordenador');
  ir('dashboard');
}


const META_C = {
  dashboard:      {t:'Dashboard',       s:'Visão geral da unidade'},
  salas:          {t:'Salas',           s:'Cadastro e gestão de salas'},
  turmas:         {t:'Turmas',          s:'Cadastro e gestão de turmas'},
  reservas:       {t:'Reservas',        s:'Reservas recorrentes de salas'},
  instrutores:    {t:'Instrutores',     s:'Visualizar instrutores cadastrados'},
  mapa:           {t:'Mapa de Salas',   s:'Visão geral da ocupação das salas'},
  solicitacoes:   {t:'Solicitações',    s:'Solicitações de sala dos instrutores'},
  notificacoes:   {t:'Notificações',    s:'Avisos e alertas'},
};

function ir(aba) {
  document.querySelectorAll('.pg').forEach(p=>{p.classList.remove('on');p.style.display='none'});
  const pg=document.getElementById('pg-'+aba); if(pg){pg.classList.add('on');pg.style.display='block';}
  document.querySelectorAll('.sb-btn').forEach(b=>b.classList.remove('on'));
  const btn=document.getElementById('nav-'+aba); if(btn)btn.classList.add('on');
  const m=META_C[aba]||{};
  _t('tbTitle',m.t); _t('tbSub',m.s);
  const fn={dashboard:rdDash,salas:rdSalas,turmas:rdTurmas,reservas:rdReservas,
            instrutores:rdInstrutores,mapa:rdMapa,solicitacoes:rdSolics,notificacoes:rdNotifs};
  if(fn[aba]) fn[aba]();
}


function rdDash() {
  const salas   = getSalas().filter(s=>s.unidadeId===_sess.unidadeId);
  const turmas  = getTurmas().filter(t=>t.unidadeId===_sess.unidadeId);
  const reservas= getReservas().filter(r=>r.unidadeId===_sess.unidadeId);
  const solics  = getSolics().filter(s=>s.unidadeId===_sess.unidadeId&&s.status==='pendente');
  _t('stSalas',   salas.length);
  _t('stTurmas',  turmas.filter(t=>statusTurma(t)==='ativa').length);
  _t('stReservas',reservas.length);
  _t('stSolics',  solics.length);


  const tb = document.getElementById('tbDashTurmas');
  const rec = [...turmas].sort((a,b)=>b.id-a.id).slice(0,5);
  if(!rec.length){tb.innerHTML='<tr class="tbl-empty"><td colspan="5">Nenhuma turma cadastrada.</td></tr>';return;}
  tb.innerHTML = rec.map(t=>{
    const st  = statusTurma(t);
    const ins = getUserById(t.instrutorId);
    return `<tr>
      <td><strong class="mono">${esc(t.nome)}</strong></td>
      <td>${esc(t.curso)}</td>
      <td>${esc(ins?ins.nome:'—')}</td>
      <td><span class="${classStatus(st)}">${fmtStatus(st)}</span></td>
      <td>${fmtData(t.dataInicio)} → ${fmtData(t.dataFim)}</td>
    </tr>`;
  }).join('');
}


function rdSalas() {
  const list = getSalas().filter(s=>s.unidadeId===_sess.unidadeId);
  const tb   = document.getElementById('tbSalas');
  if(!list.length){tb.innerHTML='<tr class="tbl-empty"><td colspan="5">Nenhuma sala cadastrada.</td></tr>';return;}
  tb.innerHTML = list.map(s=>`<tr>
    <td><strong>${esc(s.nome)}</strong></td>
    <td>${s.capacidade} pessoas</td>
    <td>${esc(s.tipo)}</td>
    <td>${(s.turnos||[]).map(t=>`<span class="bdg bdg-primary">${t}</span>`).join(' ')}</td>
    <td style="display:flex;gap:5px;padding:11px 12px">
      <button class="btn btn-ghost btn-sm" onclick="abrirModalSala(${s.id})">Editar</button>
      <button class="btn btn-danger btn-sm" onclick="excluirSala(${s.id})">Excluir</button>
    </td>
  </tr>`).join('');
}

function abrirModalSala(id) {
  _editSalaId=id||null;
  const s=id?getSalaById(id):null;
  _t('msTitulo',id?'Editar Sala':'Nova Sala');
  _v('msNome',       s?s.nome:'');
  _v('msCapacidade', s?s.capacidade:'');
  _v('msTipo',       s?s.tipo:'');

  const cont=document.getElementById('msTurnos');
  cont.innerHTML='';
  TURNOS.forEach(t=>{
    const on=s&&(s.turnos||[]).includes(t);
    const c=document.createElement('div');
    c.className='chip'+(on?' on':'');c.dataset.val=t;c.textContent=t;
    c.onclick=function(){this.classList.toggle('on');};
    cont.appendChild(c);
  });
  hideMsg('msMsg');
  _modal('modalSala',true);
}
function fecharModalSala(){_modal('modalSala',false);_editSalaId=null;}

function salvarSala() {
  const nome   =document.getElementById('msNome').value.trim();
  const cap    =parseInt(document.getElementById('msCapacidade').value);
  const tipo   =document.getElementById('msTipo').value.trim();
  const turnos =[...document.querySelectorAll('#msTurnos .chip.on')].map(c=>c.dataset.val);
  if(!nome||!cap||!tipo){showMsg('msMsg','erro','Preencha nome, capacidade e tipo.');return;}
  if(!turnos.length){showMsg('msMsg','erro','Selecione ao menos um turno.');return;}
  const dados={nome,capacidade:cap,tipo,turnos,unidadeId:_sess.unidadeId};
  if(_editSalaId){updSala(_editSalaId,dados);toast('Sala atualizada!','ok');}
  else{addSala(dados);toast('Sala cadastrada!','ok');}
  fecharModalSala();rdSalas();
}

function excluirSala(id){
  const s=getSalaById(id);if(!s)return;
  const res=getReservas().filter(r=>r.salaId===id);
  if(res.length){toast('Sala tem reservas. Remova-as primeiro.','erro');return;}
  if(!confirm(`Excluir "${s.nome}"?`))return;
  deleteSala(id);toast('Sala excluída.','aviso');rdSalas();
}


function rdTurmas() {
  const list=getTurmas().filter(t=>t.unidadeId===_sess.unidadeId);
  const tb  =document.getElementById('tbTurmas');
  if(!list.length){tb.innerHTML='<tr class="tbl-empty"><td colspan="7">Nenhuma turma cadastrada.</td></tr>';return;}
  const sorted=[...list].sort((a,b)=>a.dataInicio.localeCompare(b.dataInicio));
  tb.innerHTML=sorted.map(t=>{
    const st =statusTurma(t);
    const ins=getUserById(t.instrutorId);
    return `<tr>
      <td><strong class="mono">${esc(t.nome)}</strong></td>
      <td>${esc(t.curso)}</td>
      <td><span class="bdg bdg-primary">${esc(t.turno)}</span></td>
      <td>${esc(ins?ins.nome:'—')}</td>
      <td>${fmtData(t.dataInicio)}</td>
      <td>${fmtData(t.dataFim)}</td>
      <td><span class="${classStatus(st)}">${fmtStatus(st)}</span></td>
      <td style="display:flex;gap:5px;padding:11px 12px">
        <button class="btn btn-ghost btn-sm" onclick="abrirModalTurma(${t.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirTurma(${t.id})">Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

function abrirModalTurma(id) {
  _editTurmaId=id||null;
  const t=id?getTurmaById(id):null;
  _t('mtTitulo',id?'Editar Turma':'Nova Turma');
  _v('mtNome',    t?t.nome:'');
  _v('mtCurso',   t?t.curso:'');
  _v('mtTurno',   t?t.turno:TURNOS[0]);
  _v('mtInicio',  t?t.dataInicio:'');
  _v('mtFim',     t?t.dataFim:'');
  _popularInstrutoresSel('mtInstrutor');
  if(t) _v('mtInstrutor',t.instrutorId||'');
  hideMsg('mtMsg');
  _modal('modalTurma',true);
}
function fecharModalTurma(){_modal('modalTurma',false);_editTurmaId=null;}

function salvarTurma() {
  const nome   =document.getElementById('mtNome').value.trim();
  const curso  =document.getElementById('mtCurso').value.trim();
  const turno  =document.getElementById('mtTurno').value;
  const inicio =document.getElementById('mtInicio').value;
  const fim    =document.getElementById('mtFim').value;
  const instId =parseInt(document.getElementById('mtInstrutor').value)||null;
  if(!nome||!curso||!inicio||!fim){showMsg('mtMsg','erro','Preencha todos os campos obrigatórios.');return;}
  if(fim<inicio){showMsg('mtMsg','erro','Data fim deve ser após o início.');return;}
  const dados={nome,curso,turno,dataInicio:inicio,dataFim:fim,instrutorId:instId,unidadeId:_sess.unidadeId};
  if(_editTurmaId){updTurma(_editTurmaId,dados);toast('Turma atualizada!','ok');}
  else{addTurma(dados);toast('Turma cadastrada!','ok');}
  fecharModalTurma();rdTurmas();
}

function excluirTurma(id){
  const t=getTurmaById(id);if(!t)return;
  if(!confirm(`Excluir turma "${t.nome}"?`))return;
  deleteTurma(id);
  getReservas().filter(r=>r.turmaId===id).forEach(r=>deleteReserva(r.id));
  toast('Turma excluída.','aviso');rdTurmas();
}


function rdReservas() {
  const list=getReservas().filter(r=>r.unidadeId===_sess.unidadeId);
  const tb  =document.getElementById('tbReservas');
  const sorted=[...list].sort((a,b)=>a.dataInicio.localeCompare(b.dataInicio));
  if(!sorted.length){tb.innerHTML='<tr class="tbl-empty"><td colspan="8">Nenhuma reserva cadastrada.</td></tr>';return;}
  tb.innerHTML=sorted.map(r=>{
    const sala =getSalaById(r.salaId);
    const turma=getTurmaById(r.turmaId);
    const st   =statusReserva(r);
    const reservPor=getUserById(r.reservadoPorId);
    return `<tr>
      <td><strong>${esc(sala?sala.nome:'—')}</strong></td>
      <td class="mono">${esc(turma?turma.nome:'—')}</td>
      <td><span class="bdg bdg-primary">${esc(r.turno)}</span></td>
      <td><span style="font-size:.78rem">${r.diasSemana.map(d=>d.toUpperCase()).join(', ')}</span></td>
      <td style="font-size:.82rem">${fmtData(r.dataInicio)} → ${fmtData(r.dataFim)}</td>
      <td>${esc(reservPor?reservPor.nome:'—')}</td>
      <td><span class="${classStatus(st)}">${fmtStatus(st)}</span></td>
      <td style="display:flex;gap:5px;padding:11px 12px">
        <button class="btn btn-ghost btn-sm" onclick="abrirModalResEditar(${r.id})"><i class="ph ph-pencil-simple"></i>️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirRes(${r.id})">Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

function abrirModalRes() {
  _editResId=null;
  _popularSalasSel('mrSala');
  _popularTurmasSel('mrTurma');
  _buildDiasChips('mrDias');
  _v('mrTurno',TURNOS[0]);_v('mrInicio','');_v('mrFim','');
  hideMsg('mrMsg');
  _t('mrTitulo','Nova Reserva');
  _modal('modalRes',true);
}
function abrirModalResEditar(id) {
  const r=getReservaById(id);
  if(!r)return;
  _editResId=id;
  _popularSalasSel('mrSala');
  _popularTurmasSel('mrTurma');
  _buildDiasChips('mrDias');
  document.getElementById('mrSala').value=r.salaId;
  document.getElementById('mrTurma').value=r.turmaId;
  _v('mrTurno',r.turno);
  _v('mrInicio',r.dataInicio);
  _v('mrFim',r.dataFim);

  document.querySelectorAll('#mrDias .chip').forEach(c=>{
    if(r.diasSemana.includes(c.dataset.val)) c.classList.add('on');
  });
  hideMsg('mrMsg');
  _t('mrTitulo','Editar Reserva');
  _modal('modalRes',true);
}
function fecharModalRes(){_editResId=null;_modal('modalRes',false);}

function salvarRes() {
  const salaId =parseInt(document.getElementById('mrSala').value);
  const turmaId=parseInt(document.getElementById('mrTurma').value);
  const turno  =document.getElementById('mrTurno').value;
  const inicio =document.getElementById('mrInicio').value;
  const fim    =document.getElementById('mrFim').value;
  const dias   =[...document.querySelectorAll('#mrDias .chip.on')].map(c=>c.dataset.val);
  if(!salaId||!turmaId||!inicio||!fim||!dias.length){showMsg('mrMsg','erro','Preencha todos os campos e selecione dias.');return;}
  const turma=getTurmaById(turmaId);
  if(fim>turma.dataFim){showMsg('mrMsg','erro',`Data fim ultrapassa o fim da turma (${fmtData(turma.dataFim)}).`);return;}
  const conflito=checarConflitoReserva(salaId,turno,inicio,fim,dias,_editResId);
  if(conflito){showMsg('mrMsg','erro',`Conflito: ${conflito}`);return;}

  const sala=getSalaById(salaId);
  if(sala&&!(sala.turnos||[]).includes(turno)){
    showMsg('mrMsg','aviso',`A sala "${sala.nome}" não tem o turno ${turno} disponível. Reservado mesmo assim.`);
  }

  if(_editResId){
    updReserva(_editResId,{salaId,turmaId,turno,dataInicio:inicio,dataFim:fim,diasSemana:dias});
    toast('Reserva atualizada!','ok');
  } else {
    addReserva({salaId,turmaId,turno,dataInicio:inicio,dataFim:fim,diasSemana:dias,
      reservadoPorId:_sess.id,unidadeId:_sess.unidadeId});
    toast('Reserva criada!','ok');
  }
  fecharModalRes();rdReservas();
}

function excluirRes(id){
  if(!confirm('Excluir esta reserva?'))return;
  deleteReserva(id);toast('Reserva excluída.','aviso');rdReservas();
}


function rdInstrutores() {
  const list=getUsuarios().filter(u=>u.perfil==='instrutor'&&u.unidadeId===_sess.unidadeId);
  const tb  =document.getElementById('tbInstrutores');
  if(!list.length){tb.innerHTML='<tr class="tbl-empty"><td colspan="4">Nenhum instrutor nesta unidade.</td></tr>';return;}
  tb.innerHTML=list.map(u=>{
    const turmas=getTurmas().filter(t=>t.instrutorId===u.id&&t.unidadeId===_sess.unidadeId);
    return `<tr>
      <td><strong>${esc(u.nome)}</strong></td>
      <td class="mono">${esc(u.email)}</td>
      <td>${turmas.map(t=>`<span class="${classStatus(statusTurma(t))} me-1">${esc(t.nome)}</span>`).join(' ')||'—'}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="abrirModalAtrib(${u.id})">Atribuir Turma</button></td>
    </tr>`;
  }).join('');
}

function abrirModalAtrib(instId) {
  _popularTurmasSel('atTurma');
  const inst=getUserById(instId);
  _t('atTitulo',`Atribuir turma a ${inst?inst.nome:''}`);
  document.getElementById('atInstId').value=instId;
  _modal('modalAtrib',true);
}
function fecharModalAtrib(){_modal('modalAtrib',false);}

function salvarAtrib() {
  const instId =parseInt(document.getElementById('atInstId').value);
  const turmaId=parseInt(document.getElementById('atTurma').value);
  if(!turmaId){toast('Selecione uma turma.','aviso');return;}
  updTurma(turmaId,{instrutorId:instId});
  toast('Turma atribuída ao instrutor!','ok');
  fecharModalAtrib();rdInstrutores();
}


function rdMapa() {
  const salas=getSalas().filter(s=>s.unidadeId===_sess.unidadeId);
  const cont =document.getElementById('mapaSalas');
  if(!salas.length){cont.innerHTML='<p class="txt2">Nenhuma sala cadastrada.</p>';return;}
  const hj=hoje();
  cont.innerHTML=salas.map(s=>{

    let status='livre',info='Disponível',instNome='';
    const reservas=getReservas().filter(r=>r.salaId===s.id&&r.dataInicio<=hj&&r.dataFim>=hj);
    if(reservas.length){
      const r=reservas[0];
      const turma=getTurmaById(r.turmaId);
      const inst=turma?getUserById(turma.instrutorId):null;
      instNome=inst?inst.nome:'';
      const st=statusReserva(r);
      if(st==='ativa'){status='ocupada';info=`Ocupada: ${turma?turma.nome:''}`;}
      else if(st==='iminente'){status='iminente';info=`Em breve: ${turma?turma.nome:''}`;}
    }
    return `<div class="sala-card ${status}">
      <div class="sala-nome">${esc(s.nome)}</div>
      <div class="sala-tipo">${esc(s.tipo)} · ${s.capacidade} pessoas</div>
      ${instNome?`<div class="sala-tipo mt8">Instrutor: ${esc(instNome)}</div>`:''}
      <div class="sala-status-txt">${esc(info)}</div>
    </div>`;
  }).join('');
}


function rdSolics() {
  const list=getSolics().filter(s=>s.unidadeId===_sess.unidadeId);
  const cont=document.getElementById('listaSolics');
  if(!list.length){cont.innerHTML='<p class="txt2">Nenhuma solicitação pendente.</p>';return;}
  cont.innerHTML=list.map(s=>{
    const sala=getSalaById(s.salaId);
    const inst=getUserById(s.instrutorId);
    const cor ={pendente:'aviso',aprovada:'ok',recusada:'erro'}[s.status]||'aviso';
    return `<div class="notif-item tipo-solicit">
      <div class="notif-titulo">Solicitação de sala — ${esc(inst?inst.nome:'Instrutor')}</div>
      <div class="notif-msg">Sala: <strong>${esc(sala?sala.nome:'—')}</strong> · ${fmtData(s.data)} · ${esc(s.turno)}</div>
      ${s.motivo?`<div class="notif-msg">Motivo: ${esc(s.motivo)}</div>`:''}
      <div class="notif-tempo">${fmtDateTime(s.criadaEm)}</div>
      ${s.status==='pendente'?`
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-success btn-sm" onclick="responderSolic(${s.id},'aprovada')">Aprovar</button>
          <button class="btn btn-danger  btn-sm" onclick="responderSolic(${s.id},'recusada')">Recusar</button>
        </div>`
      :`<div class="mt8"><span class="bdg bdg-${s.status==='aprovada'?'green':'red'}">${s.status.toUpperCase()}</span></div>`}
    </div>`;
  }).join('');
}

function responderSolic(id, status) {
  updSolic(id,{status});
  const s=getSolics().find(x=>x.id===id);
  const inst=s?getUserById(s.instrutorId):null;
  addNotif({
    para:'instrutor', paraId:s?.instrutorId,
    tipo:'info',
    titulo:`Solicitação ${status}`,
    msg:`Sua solicitação de sala foi ${status}.`,
  });
  toast(`Solicitação ${status}!`,'ok');
  rdSolics();initNotifBadge('coordenador');
}


function rdNotifs() {
  const list=getNotifsPara('coordenador',_sess.unidadeId);
  const cont=document.getElementById('listaNotifs');
  if(!list.length){cont.innerHTML='<p class="txt2">Sem notificações.</p>';return;}
  cont.innerHTML=list.map(n=>`
    <div class="notif-item tipo-${n.tipo||'info'}${!n.lida?' nao-lida':''}">
      <div class="notif-titulo">${esc(n.titulo||n.tipo)}</div>
      <div class="notif-msg">${esc(n.msg)}</div>
      <div class="notif-tempo">${fmtDateTime(n.criadaEm)}</div>
    </div>`).join('');
  marcarTodasLidas('coordenador',_sess.unidadeId);
  initNotifBadge('coordenador');
}


function _popularInstrutoresSel(id) {
  const sel=document.getElementById(id);if(!sel)return;
  sel.innerHTML='<option value="">— Sem instrutor —</option>';
  getUsuarios().filter(u=>u.perfil==='instrutor'&&u.unidadeId===_sess.unidadeId)
    .forEach(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=u.nome;sel.appendChild(o);});
}
function _popularSalasSel(id) {
  const sel=document.getElementById(id);if(!sel)return;
  sel.innerHTML='<option value="">— Selecione a sala —</option>';
  getSalas().filter(s=>s.unidadeId===_sess.unidadeId)
    .forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.nome} (${s.tipo})`;sel.appendChild(o);});
}
function _popularTurmasSel(id) {
  const sel=document.getElementById(id);if(!sel)return;
  const hj=hoje();
  sel.innerHTML='<option value="">— Selecione a turma —</option>';
  getTurmas().filter(t=>t.unidadeId===_sess.unidadeId&&t.dataFim>=hj)
    .forEach(t=>{
      const o=document.createElement('option');
      o.value=t.id;o.textContent=`${t.nome} — ${t.curso}`;
      o.dataset.inicio=t.dataInicio;o.dataset.fim=t.dataFim;o.dataset.turno=t.turno;
      sel.appendChild(o);
    });
}
function _buildDiasChips(contId) {
  const cont=document.getElementById(contId);if(!cont)return;
  cont.innerHTML='';
  DIAS_SEM.forEach(d=>{
    const c=document.createElement('div');c.className='chip';c.dataset.val=d.v;c.textContent=d.l;
    c.onclick=function(){this.classList.toggle('on');};
    cont.appendChild(c);
  });
}
function _t(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function _v(id,v){const el=document.getElementById(id);if(el)el.value=v;}
function _modal(id,ab){const el=document.getElementById(id);if(el)el.classList.toggle('on',ab);}
