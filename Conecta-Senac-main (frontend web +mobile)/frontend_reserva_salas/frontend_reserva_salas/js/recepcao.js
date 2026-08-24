let _sessR;

function initRecepcao() {
  requirePerfil('recepcao');
  _sessR = getSessao();
  initSidebar('recepcao');
  initNotifBadge('recepcao');
  irR('mapa');
}

const META_R = {
  mapa:          {t:'Mapa de Salas',   s:'Visualizar ocupação das salas'},
  chaves:        {t:'Gestão de Chaves',s:'Criar e controlar chaves das salas'},
  notificacoes:  {t:'Notificações',    s:'Avisos recebidos'},
};

function irR(aba) {
  document.querySelectorAll('.pg').forEach(p=>{p.classList.remove('on');p.style.display='none'});
  const pg=document.getElementById('pg-'+aba);if(pg){pg.classList.add('on');pg.style.display='block';}
  document.querySelectorAll('.sb-btn').forEach(b=>b.classList.remove('on'));
  const btn=document.getElementById('nav-'+aba);if(btn)btn.classList.add('on');
  const m=META_R[aba]||{};_t('tbTitle',m.t);_t('tbSub',m.s);
  const fn={mapa:rdMapaR,chaves:rdChavesR,notificacoes:rdNotifsR};
  if(fn[aba])fn[aba]();
}


function rdMapaR() {
  const salas=getSalas().filter(s=>s.unidadeId===_sessR.unidadeId);
  const cont =document.getElementById('mapaRecep');
  if(!salas.length){cont.innerHTML='<p class="txt2">Nenhuma sala cadastrada na unidade.</p>';return;}
  const hj=hoje();

  cont.innerHTML=salas.map(s=>{
    const reservasAtivas=getReservas().filter(r=>r.salaId===s.id);
    let status='livre',infoHtml='<span style="color:var(--green);font-weight:600">Disponível agora</span>';
    let instHtml='';

    for(const r of reservasAtivas){
      const st=statusReserva(r);
      if(st==='encerrada')continue;
      if(r.dataInicio<=hj&&r.dataFim>=hj){
        const [y,m,d]=hj.split('-').map(Number);
        const diaSem=['dom','seg','ter','qua','qui','sex','sab'][new Date(y,m-1,d).getDay()];
        if(r.diasSemana.includes(diaSem)){
          const turma=getTurmaById(r.turmaId);
          const inst =turma?getUserById(turma.instrutorId):null;
          status='ocupada';
          infoHtml=`<span style="color:var(--red);font-weight:600">Ocupada</span>
            <div class="txt3 mt8">Turma: <strong>${esc(turma?turma.nome:'—')}</strong></div>
            <div class="txt3">Instrutor: <strong>${esc(inst?inst.nome:'—')}</strong></div>
            <div class="txt3">Turno: ${esc(r.turno)}</div>`;
          break;
        }
      }
    }


    if(status==='ocupada'){
      const proxRes=reservasAtivas
        .filter(r=>r.dataInicio>hj&&statusReserva(r)!=='encerrada')
        .sort((a,b)=>a.dataInicio.localeCompare(b.dataInicio))[0];
      if(proxRes){
        const t=getTurmaById(proxRes.turmaId);
        infoHtml+=`<div class="txt3 mt8">Próx. reserva: ${fmtData(proxRes.dataInicio)} (${esc(t?t.nome:'—')})</div>`;
      }
    }

    return `<div class="sala-card ${status}">
      <div class="sala-nome">${esc(s.nome)}</div>
      <div class="sala-tipo">${esc(s.tipo)} · ${s.capacidade} pessoas</div>
      <div class="mt8">${infoHtml}</div>
    </div>`;
  }).join('');


  const hjs=[...Array(14)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return d.toISOString().split('T')[0];});
  const tb=document.getElementById('tbFuturas');
  const fut=getReservas().filter(r=>r.unidadeId===_sessR.unidadeId&&r.dataFim>=hj)
    .sort((a,b)=>a.dataInicio.localeCompare(b.dataInicio)).slice(0,20);
  if(!fut.length){tb.innerHTML='<tr class="tbl-empty"><td colspan="5">Sem reservas futuras.</td></tr>';return;}
  tb.innerHTML=fut.map(r=>{
    const sala =getSalaById(r.salaId);
    const turma=getTurmaById(r.turmaId);
    const inst =turma?getUserById(turma.instrutorId):null;
    return `<tr>
      <td><strong>${esc(sala?sala.nome:'—')}</strong></td>
      <td class="mono">${esc(turma?turma.nome:'—')}</td>
      <td>${esc(inst?inst.nome:'—')}</td>
      <td>${fmtData(r.dataInicio)} → ${fmtData(r.dataFim)}</td>
      <td>${r.diasSemana.map(d=>d.toUpperCase()).join(', ')} · ${esc(r.turno)}</td>
    </tr>`;
  }).join('');
}


function rdChavesR() {
  const chaves=getChaves().filter(c=>c.unidadeId===_sessR.unidadeId);
  const cont  =document.getElementById('listaChavesR');
  if(!chaves.length){cont.innerHTML='<p class="txt2">Nenhuma chave cadastrada.</p>';return;}
  cont.innerHTML=chaves.map(c=>{
    const sala=getSalaById(c.salaId);
    const pega=c.status==='pega';
    const inst=pega&&c.instrutorId?getUserById(c.instrutorId):null;
    return `<div class="chave-card ${c.status}">
      <div class="chave-icon">${pega?'<i class="ph ph-key"></i>':'<i class="ph ph-key"></i>️'}</div>
      <div class="chave-info">
        <div class="chave-titulo">${esc(sala?sala.nome:'Sala')} — ${esc(c.codigo||'Chave')}</div>
        <div class="chave-det">Andar ${esc(c.andar||'—')} · <strong>${pega?'Retirada':'Disponível'}</strong></div>
        ${inst?`<div class="chave-det">Retirada por: ${esc(inst.nome)} em ${fmtDateTime(c.pegaEm)}</div>`:''}
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="editarChave(${c.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirChave(${c.id})">Excluir</button>
      </div>
    </div>`;
  }).join('');
}

function abrirModalChave(id) {
  const c=id?getChaveById(id):null;
  _t('mchTitulo',id?'Editar Chave':'Nova Chave');
  _popularSalasSelR('mchSala');
  if(c)_v('mchSala',c.salaId||'');
  _v('mchCodigo',c?c.codigo||'':'');
  _v('mchAndar', c?c.andar||'':'');
  document.getElementById('mchId').value=id||'';
  _modal('modalChave',true);
}
function editarChave(id){abrirModalChave(id);}
function fecharModalChave(){_modal('modalChave',false);}

function salvarChave() {
  const id    =parseInt(document.getElementById('mchId').value)||null;
  const salaId=parseInt(document.getElementById('mchSala').value);
  const codigo=document.getElementById('mchCodigo').value.trim();
  const andar =document.getElementById('mchAndar').value.trim();
  if(!salaId||!codigo){toast('Preencha sala e código.','aviso');return;}
  const dados={salaId,codigo,andar,unidadeId:_sessR.unidadeId};
  if(id){updChave(id,dados);toast('Chave atualizada!','ok');}
  else{addChave(dados);toast('Chave criada!','ok');}
  fecharModalChave();rdChavesR();
}

function excluirChave(id){
  if(!confirm('Excluir esta chave?'))return;
  deleteChave(id);toast('Chave excluída.','aviso');rdChavesR();
}


function rdNotifsR() {
  const list=getNotifsPara('recepcao',_sessR.unidadeId);
  const cont=document.getElementById('listaNotifR');
  if(!list.length){cont.innerHTML='<p class="txt2">Sem notificações.</p>';return;}
  cont.innerHTML=list.map(n=>`
    <div class="notif-item tipo-${n.tipo||'info'}${!n.lida?' nao-lida':''}">
      <div class="notif-titulo">${esc(n.titulo||'Notificação')}</div>
      <div class="notif-msg">${esc(n.msg)}</div>
      <div class="notif-tempo">${fmtDateTime(n.criadaEm)}</div>
    </div>`).join('');
  marcarTodasLidas('recepcao',_sessR.unidadeId);
  initNotifBadge('recepcao');
}


function _popularSalasSelR(id){
  const sel=document.getElementById(id);if(!sel)return;
  sel.innerHTML='<option value="">— Selecione a sala —</option>';
  getSalas().filter(s=>s.unidadeId===_sessR.unidadeId)
    .forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.nome} (${s.tipo})`;sel.appendChild(o);});
}
function _t(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function _v(id,v){const el=document.getElementById(id);if(el)el.value=v;}
function _modal(id,ab){const el=document.getElementById(id);if(el)el.classList.toggle('on',ab);}
