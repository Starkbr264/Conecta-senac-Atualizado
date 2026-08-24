let _sessI;

function initInstrutor() {
  requirePerfil('instrutor');
  _sessI = getSessao();
  initSidebar('instrutor');
  initNotifBadge('instrutor');
  irI('minhas-turmas');
}

const META_I = {
  'minhas-turmas': {t:'Minhas Turmas',     s:'Turmas atribuídas a você'},
  'salas':         {t:'Solicitar Sala',    s:'Solicite uma sala disponível'},
  'chaves':        {t:'Chaves de Sala',    s:'Sinalizar chave retirada ou devolvida'},
  'notificacoes':  {t:'Notificações',      s:'Avisos e respostas'},
};

function irI(aba) {
  document.querySelectorAll('.pg').forEach(p=>{p.classList.remove('on');p.style.display='none'});
  const pg=document.getElementById('pg-'+aba);if(pg){pg.classList.add('on');pg.style.display='block';}
  document.querySelectorAll('.sb-btn').forEach(b=>b.classList.remove('on'));
  const btn=document.getElementById('nav-'+aba);if(btn)btn.classList.add('on');
  const m=META_I[aba]||{};_t('tbTitle',m.t);_t('tbSub',m.s);
  const fn={'minhas-turmas':rdMT,'salas':rdSalas,'chaves':rdChaves,'notificacoes':rdNotifsI};
  if(fn[aba])fn[aba]();
}

function rdMT() {
  const turmas=getTurmas().filter(t=>t.instrutorId===_sessI.id);
  const tb=document.getElementById('tbMT');
  if(!turmas.length){tb.innerHTML='<tr class="tbl-empty"><td colspan="5">Nenhuma turma atribuída.</td></tr>';return;}
  tb.innerHTML=turmas.map(t=>{
    const st=statusTurma(t);
    const res=getReservas().filter(r=>r.turmaId===t.id);
    const sala=res.length?getSalaById(res[0].salaId):null;
    return `<tr>
      <td><strong class="mono">${esc(t.nome)}</strong></td>
      <td>${esc(t.curso)}</td>
      <td><span class="bdg bdg-primary">${esc(t.turno)}</span></td>
      <td>${esc(sala?sala.nome:'Sem sala reservada')}</td>
      <td><span class="${classStatus(st)}">${fmtStatus(st)}</span></td>
      <td>${fmtData(t.dataInicio)} → ${fmtData(t.dataFim)}</td>
    </tr>`;
  }).join('');
}

function rdSalas() {
  const salas=getSalas().filter(s=>s.unidadeId===_sessI.unidadeId);
  const cont =document.getElementById('listaDisp');
  const hj   =hoje();
  cont.innerHTML=salas.map(s=>{
    const disp=salaDisponivel(s.id,hj,'Matutino');
    let statusCls='livre',info='Disponível hoje',instTxt='';
    if(!disp.livre){
      const t=disp.turma;
      statusCls='ocupada';info=`Ocupada: ${t?t.nome:'outra turma'}`;
      const inst=t?getUserById(t.instrutorId):null;
      instTxt=inst?` · Instrutor: ${inst.nome}`:'';
    }
    return `<div class="sala-card ${statusCls}" style="cursor:default">
      <div class="sala-nome">${esc(s.nome)}</div>
      <div class="sala-tipo">${esc(s.tipo)} · ${s.capacidade} pessoas${instTxt}</div>
      <div class="sala-status-txt">${info}</div>
      ${statusCls==='livre'?`<button class="btn btn-primary btn-sm mt8" onclick="abrirSolic(${s.id})">Solicitar</button>`:''}
    </div>`;
  }).join('');
}

function abrirSolic(salaId) {
  document.getElementById('slSalaId').value=salaId;
  const s=getSalaById(salaId);
  _t('slSalaNome',s?s.nome:'Sala');
  _v('slData','');_v('slTurno','Matutino');_v('slMotivo','');
  _modal('modalSolic',true);
}
function fecharSolic(){_modal('modalSolic',false);}

function enviarSolic() {
  const salaId=parseInt(document.getElementById('slSalaId').value);
  const data  =document.getElementById('slData').value;
  const turno =document.getElementById('slTurno').value;
  const motivo=document.getElementById('slMotivo').value.trim();
  if(!data){toast('Selecione uma data.','aviso');return;}
  addSolic({salaId,instrutorId:_sessI.id,data,turno,motivo,unidadeId:_sessI.unidadeId});
  addNotif({
    para:'coordenador',paraId:_sessI.unidadeId,
    tipo:'solicit',titulo:'Nova solicitação de sala',
    msg:`${_sessI.nome} solicitou ${getSalaById(salaId)?.nome} em ${fmtData(data)} (${turno}).`
  });
  toast('Solicitação enviada ao coordenador!','ok');
  fecharSolic();rdSalas();
}

function rdChaves() {
  const chaves=getChaves().filter(c=>c.unidadeId===_sessI.unidadeId);
  const cont  =document.getElementById('listaChaves');
  if(!chaves.length){cont.innerHTML='<p class="txt2">Nenhuma chave cadastrada.</p>';return;}
  cont.innerHTML=chaves.map(c=>{
    const sala=getSalaById(c.salaId);
    const pega =c.status==='pega';
    const minha=c.instrutorId===_sessI.id;
    return `<div class="chave-card ${c.status}">
      <div class="chave-icon">${pega?'<i class="ph ph-key"></i>':'<i class="ph ph-key"></i>️'}</div>
      <div class="chave-info">
        <div class="chave-titulo">${esc(sala?sala.nome:'Sala')} — ${esc(c.codigo||'Chave')}</div>
        <div class="chave-det">Andar ${esc(c.andar||'—')} · Status: <strong>${pega?'Retirada':'Disponível'}</strong></div>
        ${pega&&c.instrutorId?`<div class="chave-det">Retirada por: ${esc(getUserById(c.instrutorId)?.nome||'—')}</div>`:''}
      </div>
      ${!pega?
        `<button class="btn btn-warning btn-sm" onclick="pegarChave(${c.id})">Retirar Chave</button>`:
        minha?`<button class="btn btn-success btn-sm" onclick="devolverChave(${c.id})">Devolver Chave</button>`:''}
    </div>`;
  }).join('');
}

function pegarChave(id) {
  updChave(id,{status:'pega',instrutorId:_sessI.id,pegaEm:new Date().toISOString()});
  const c=getChaveById(id);const sala=getSalaById(c?.salaId);
  addNotif({
    para:'recepcao',paraId:_sessI.unidadeId,
    tipo:'chave',titulo:'Chave retirada',
    msg:`${_sessI.nome} retirou a chave de "${sala?.nome||'sala'}" (${c?.codigo||''}).`
  });
  toast('Chave registrada como retirada. Recepção notificada.','ok');
  rdChaves();
}

function devolverChave(id) {
  updChave(id,{status:'disponivel',instrutorId:null,pegaEm:null});
  const c=getChaveById(id);const sala=getSalaById(c?.salaId);
  addNotif({
    para:'recepcao',paraId:_sessI.unidadeId,
    tipo:'chave',titulo:'Chave devolvida',
    msg:`${_sessI.nome} devolveu a chave de "${sala?.nome||'sala'}".`
  });
  toast('Chave devolvida!','ok');rdChaves();
}

function rdNotifsI() {
  const list=getNotifsPara('instrutor',_sessI.unidadeId).filter(n=>!n.paraId||n.paraId===_sessI.id||n.paraId===_sessI.unidadeId);
  const cont=document.getElementById('listaNotifI');
  if(!list.length){cont.innerHTML='<p class="txt2">Sem notificações.</p>';return;}
  cont.innerHTML=list.map(n=>`
    <div class="notif-item tipo-${n.tipo||'info'}${!n.lida?' nao-lida':''}">
      <div class="notif-titulo">${esc(n.titulo||'Notificação')}</div>
      <div class="notif-msg">${esc(n.msg)}</div>
      <div class="notif-tempo">${fmtDateTime(n.criadaEm)}</div>
    </div>`).join('');
  marcarTodasLidas('instrutor',_sessI.unidadeId);
  initNotifBadge('instrutor');
}

function _t(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function _v(id,v){const el=document.getElementById(id);if(el)el.value=v;}
function _modal(id,ab){const el=document.getElementById(id);if(el)el.classList.toggle('on',ab);}
