let _salaEditId = null;


function initSalas() {
  renderTabelaSalas();

  document.getElementById('formSala').addEventListener('submit', function(e) {
    e.preventDefault();
    salvarSala();
  });


  document.querySelectorAll('.turno-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      chip.classList.toggle('checked');
    });
  });
}


function _getDadosSala() {
  const turnos = [];
  document.querySelectorAll('.turno-chip.checked').forEach(c => turnos.push(c.dataset.val));

  const nome       = document.getElementById('salaNome').value.trim();
  const capacidade = parseInt(document.getElementById('salaCapacidade').value);
  const tipo       = document.getElementById('salaTipo').value;

  let erros = [];
  if (!nome)        erros.push('Informe o nome/número da sala.');
  if (!capacidade)  erros.push('Informe a capacidade.');
  if (turnos.length === 0) erros.push('Selecione ao menos um turno disponível.');

  return { dados: { nome, capacidade, tipo, turnosDisponiveis: turnos }, erros };
}


function salvarSala() {
  const msg = document.getElementById('msgSala');
  const { dados, erros } = _getDadosSala();

  if (erros.length > 0) {
    showMsg(msg, 'error', erros.join(' '));
    return;
  }

  if (_salaEditId) {
    updateSala(_salaEditId, dados);
    showToast('Sala atualizada com sucesso!', 'success');
    cancelarEdicaoSala();
  } else {
    addSala(dados);
    showToast('Sala cadastrada com sucesso!', 'success');
  }

  document.getElementById('formSala').reset();
  document.querySelectorAll('.turno-chip').forEach(c => c.classList.remove('checked'));
  msg.style.display = 'none';
  renderTabelaSalas();
}


function editarSala(id) {
  const sala = getSalas().find(s => s.id === id);
  if (!sala) return;

  _salaEditId = id;

  document.getElementById('salaNome').value       = sala.nome;
  document.getElementById('salaCapacidade').value = sala.capacidade;
  document.getElementById('salaTipo').value       = sala.tipo;

  document.querySelectorAll('.turno-chip').forEach(c => {
    c.classList.toggle('checked', sala.turnosDisponiveis.includes(c.dataset.val));
  });

  document.getElementById('btnSalvarSala').textContent = 'Atualizar Sala';
  document.getElementById('btnCancelarSala').style.display = 'inline-flex';
  document.getElementById('salaNome').focus();
  document.getElementById('section-salas').scrollIntoView({ behavior: 'smooth' });
}


function cancelarEdicaoSala() {
  _salaEditId = null;
  document.getElementById('formSala').reset();
  document.querySelectorAll('.turno-chip').forEach(c => c.classList.remove('checked'));
  document.getElementById('btnSalvarSala').textContent = '+ Cadastrar Sala';
  document.getElementById('btnCancelarSala').style.display = 'none';
  document.getElementById('msgSala').style.display = 'none';
}


function excluirSala(id) {
  const reservasVinculadas = getReservas().filter(r => r.salaId === id && r.status === 'ATIVA');
  if (reservasVinculadas.length > 0) {
    showToast(`Não é possível excluir: sala tem ${reservasVinculadas.length} reserva(s) ativa(s).`, 'error');
    return;
  }
  if (!confirm('Excluir esta sala? Esta ação não pode ser desfeita.')) return;
  deleteSala(id);
  showToast('Sala excluída.', 'warning');
  renderTabelaSalas();
}


function renderTabelaSalas() {
  const tbody = document.querySelector('#tabelaSalas tbody');
  const salas = getSalas();

  if (salas.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Nenhuma sala cadastrada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = salas.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.nome)}</strong></td>
      <td>${s.capacidade} pessoas</td>
      <td><span class="badge badge-primary">${s.tipo}</span></td>
      <td>${s.turnosDisponiveis.map(t => `<span class="badge badge-warning" style="margin-right:4px">${t}</span>`).join('')}</td>
      <td>
        <button class="btn btn-warning-sm" onclick="editarSala(${s.id})">Editar</button>
        <button class="btn btn-danger-sm"  onclick="excluirSala(${s.id})">Excluir</button>
      </td>
    </tr>
  `).join('');
}


var _cfgSalasDash = {
  busca:{id:'buscarSalaD', placeholder:'Pesquisar por nome ou tipo…'},
  filtros:[
    {id:'filtTipoSalaD',label:'Tipo',campo:'tipo',opcoes:[
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
    {id:'filtTurnoSalaD',label:'Turno disponível',campo:'_turno',opcoes:[
      {value:'Matutino',label:'Matutino'},{value:'Vespertino',label:'Vespertino'},{value:'Noturno',label:'Noturno'}
    ]},
  ]
};

var _renderTabelaSalasOrig = renderTabelaSalas;
renderTabelaSalas = function() {
  var cont = document.getElementById('searchSalasDash');
  if (cont && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchSalasDash', _cfgSalasDash, _renderTabelaSalasFiltrada);
  }
  _renderTabelaSalasFiltrada();
};

function _renderTabelaSalasFiltrada() {
  var vals = lerFiltros(_cfgSalasDash);
  var salas = getSalas().map(function(s){
    return Object.assign({}, s, {_turno: (s.turnosDisponiveis||s.turnos||[]).join(',')});
  });
  salas = filtrarLista(salas, vals._busca, ['nome','tipo']);
  if (vals.tipo) salas = salas.filter(function(s){return s.tipo===vals.tipo;});
  if (vals['_turno']) salas = salas.filter(function(s){return (s.turnosDisponiveis||s.turnos||[]).includes(vals['_turno']);});
  var cnt = document.getElementById('countSalasDash'); if(cnt) cnt.textContent = salas.length+' sala(s)';
  const tbody = document.querySelector('#tabelaSalas tbody');
  if (salas.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Nenhuma sala encontrada.</td></tr>';
    return;
  }
  tbody.innerHTML = salas.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.nome)}</strong></td>
      <td>${s.capacidade} pessoas</td>
      <td><span class="badge badge-primary">${s.tipo}</span></td>
      <td>${(s.turnosDisponiveis||s.turnos||[]).map(t => `<span class="badge badge-warning" style="margin-right:4px">${t}</span>`).join('')}</td>
      <td>
        <button class="btn btn-warning-sm" onclick="editarSala(${s.id})">Editar</button>
        <button class="btn btn-danger-sm"  onclick="excluirSala(${s.id})">Excluir</button>
      </td>
    </tr>
  `).join('');
}
