

const DIAS_SEMANA = [
  { val: 'seg', label: 'SEG' },
  { val: 'ter', label: 'TER' },
  { val: 'qua', label: 'QUA' },
  { val: 'qui', label: 'QUI' },
  { val: 'sex', label: 'SEX' },
  { val: 'sab', label: 'SÁB' },
];


function initReservas() {
  _buildDiasCheckboxes();
  _popularSelectSalas();
  _popularSelectTurmas();
  _sincronizarTurnoComTurma();

  document.getElementById('reservaTurma').addEventListener('change', _aoMudarTurma);
  document.getElementById('formReserva').addEventListener('submit', function(e) {
    e.preventDefault();
    salvarReserva();
  });

  renderTabelaReservas();
}


function _buildDiasCheckboxes() {
  const cont = document.getElementById('diasCheckboxes');
  cont.innerHTML = '';
  DIAS_SEMANA.forEach(d => {
    const label = document.createElement('label');
    label.className = 'check-chip dia';
    label.dataset.val = d.val;
    label.innerHTML = `<input type="checkbox" value="${d.val}"> ${d.label}`;
    label.addEventListener('click', function(e) {
      e.preventDefault();
      this.classList.toggle('checked');
    });
    cont.appendChild(label);
  });
}


function _popularSelectSalas() {
  const sel = document.getElementById('reservaSala');
  sel.innerHTML = '<option value="">— Selecione uma sala —</option>';
  getSalas().forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.nome} (${s.tipo})`;
    sel.appendChild(o);
  });
}

function _popularSelectTurmas() {
  const sel = document.getElementById('reservaTurma');
  const hoje = new Date().toISOString().split('T')[0];
  sel.innerHTML = '<option value="">— Selecione uma turma —</option>';
  getTurmas().filter(t => t.dataFim >= hoje).forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = `${t.nome} — ${t.curso} (${t.turno})`;
    o.dataset.turno   = t.turno;
    o.dataset.inicio  = t.dataInicio;
    o.dataset.fim     = t.dataFim;
    sel.appendChild(o);
  });
}


function _aoMudarTurma() {
  const opt = this.options[this.selectedIndex];
  if (!opt.value) return;
  document.getElementById('reservaTurno').value  = opt.dataset.turno;
  document.getElementById('reservaInicio').value = opt.dataset.inicio;
  document.getElementById('reservaInicio').min   = opt.dataset.inicio;
  document.getElementById('reservaFim').value    = opt.dataset.fim;
  document.getElementById('reservaFim').max      = opt.dataset.fim;
}

function _sincronizarTurnoComTurma() {
  document.getElementById('reservaTurma').dispatchEvent(new Event('change'));
}


function _getDiasSelecionados() {
  return Array.from(document.querySelectorAll('#diasCheckboxes .check-chip.checked'))
              .map(c => c.dataset.val);
}


function verificarConflito(nova, ignorarId = null) {
  const reservas = getReservas().filter(r => r.status === 'ATIVA' && r.id !== ignorarId);

  for (const r of reservas) {
    if (r.salaId !== nova.salaId)   continue;
    if (r.turno  !== nova.turno)    continue;


    const semSobreposicao = nova.dataFim < r.dataInicio || r.dataFim < nova.dataInicio;
    if (semSobreposicao) continue;


    const diasComuns = nova.diasSemana.filter(d => r.diasSemana.includes(d));
    if (diasComuns.length > 0) {
      const sala  = getSalas().find(s => s.id === r.salaId);
      const turma = getTurmas().find(t => t.id === r.turmaId);
      const diasStr = diasComuns.map(d => d.toUpperCase()).join(', ');
      return `Conflito! "${sala?.nome}" já está ocupada no ${r.turno} (${diasStr}) por "${turma?.nome}".`;
    }
  }
  return null;
}


function salvarReserva() {
  const msg    = document.getElementById('msgReserva');
  const salaId = parseInt(document.getElementById('reservaSala').value);
  const turmaId= parseInt(document.getElementById('reservaTurma').value);
  const turno  = document.getElementById('reservaTurno').value;
  const inicio = document.getElementById('reservaInicio').value;
  const fim    = document.getElementById('reservaFim').value;
  const dias   = _getDiasSelecionados();


  const erros = [];
  if (!salaId)       erros.push('Selecione uma sala.');
  if (!turmaId)      erros.push('Selecione uma turma.');
  if (dias.length === 0) erros.push('Selecione ao menos um dia da semana.');
  if (!inicio)       erros.push('Informe a data de início.');
  if (!fim)          erros.push('Informe a data de fim.');

  if (erros.length > 0) {
    showMsg(msg, 'error', erros.join(' '));
    return;
  }


  const turma = getTurmas().find(t => t.id === turmaId);
  if (fim > turma.dataFim) {
    showMsg(msg, 'error', `Data fim (${formatDate(fim)}) ultrapassa o fim da turma (${formatDate(turma.dataFim)}).`);
    return;
  }
  if (inicio < turma.dataInicio) {
    showMsg(msg, 'error', `Data de início (${formatDate(inicio)}) é anterior ao início da turma (${formatDate(turma.dataInicio)}).`);
    return;
  }


  const sala = getSalas().find(s => s.id === salaId);
  if (sala && !sala.turnosDisponiveis.includes(turno)) {
    showMsg(msg, 'warning', `A sala "${sala.nome}" não tem o turno ${turno} disponível.`);
    return;
  }

  const nova = { salaId, turmaId, diasSemana: dias, turno, dataInicio: inicio, dataFim: fim, status: 'ATIVA' };

  const conflito = verificarConflito(nova);
  if (conflito) {
    showMsg(msg, 'error', conflito);
    return;
  }

  addReserva(nova);
  showToast('Reserva criada com sucesso!', 'success');
  document.getElementById('formReserva').reset();
  document.querySelectorAll('#diasCheckboxes .check-chip').forEach(c => c.classList.remove('checked'));
  msg.style.display = 'none';
  renderTabelaReservas();
}


function excluirReserva(id) {
  if (!confirm('Excluir esta reserva?')) return;
  deleteReserva(id);
  showToast('Reserva excluída.', 'warning');
  renderTabelaReservas();
}


function renderTabelaReservas() {
  const tbody  = document.querySelector('#tabelaReservas tbody');
  const salas  = getSalas();
  const turmas = getTurmas();
  const reservas = getReservas();

  if (reservas.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Nenhuma reserva cadastrada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = reservas.map(r => {
    const sala  = salas.find(s => s.id === r.salaId);
    const turma = r.turmaId ? turmas.find(t => t.id === r.turmaId) : null;
    const diasStr = r.diasSemana.map(d => d.toUpperCase()).join(', ');
    const isAtiva = r.status === 'ATIVA';
    const turmaLabel = r.avulsa ? '<span class="badge badge-warning">Sem turma</span>' : (turma ? escapeHtml(turma.nome) : '<em>Turma removida</em>');

    return `
      <tr>
        <td><strong>${sala ? escapeHtml(sala.nome) : '<em>Sala removida</em>'}</strong></td>
        <td class="code-text">${turmaLabel}</td>
        <td><span class="badge badge-primary">${r.turno}</span></td>
        <td><span style="font-size:.82rem; color:var(--text-muted)">${diasStr}</span></td>
        <td style="font-size:.87rem">${formatDate(r.dataInicio)} → ${formatDate(r.dataFim)}</td>
        <td><span class="badge ${isAtiva ? 'badge-success' : 'badge-danger'}">${r.status}</span></td>
        <td>
          ${isAtiva ? `<button class="btn btn-danger-sm" onclick="excluirReserva(${r.id})">Excluir</button>` : '—'}
        </td>
      </tr>
    `;
  }).join('');
}


var _cfgResrDash = {
  busca:{id:'buscarResrD', placeholder:'Pesquisar sala, turma, turno…'},
  filtros:[
    {id:'filtTurnoRD', label:'Turno',  campo:'turno',  opcoes:[{value:'Matutino',label:'Matutino'},{value:'Vespertino',label:'Vespertino'},{value:'Noturno',label:'Noturno'}]},
    {id:'filtStatusRD',label:'Status', campo:'status', opcoes:[{value:'ATIVA',label:'ATIVA'},{value:'CANCELADA',label:'CANCELADA'}]},
  ]
};

var _renderTabelaReservasOrig = renderTabelaReservas;
renderTabelaReservas = function() {
  var cont = document.getElementById('searchResrDash');
  if (cont && !cont.innerHTML) {
    montarBarraPesquisaFiltros('searchResrDash', _cfgResrDash, _renderTabelaReservasFiltrada);
  }
  _renderTabelaReservasFiltrada();
};

function _renderTabelaReservasFiltrada() {
  var vals = lerFiltros(_cfgResrDash);
  const salas  = getSalas();
  const turmas = getTurmas();
  var reservas = getReservas();
  reservas = filtrarLista(reservas, vals._busca, [
    function(r){var s=salas.find(function(x){return x.id===r.salaId;});return s?s.nome:'';},
    function(r){var t=turmas.find(function(x){return x.id===r.turmaId;});return t?t.nome:'';},
    'turno'
  ]);
  if (vals.turno)  reservas = reservas.filter(function(r){return r.turno===vals.turno;});
  if (vals.status) reservas = reservas.filter(function(r){return r.status===vals.status;});
  var cnt = document.getElementById('countResrDash'); if(cnt) cnt.textContent = reservas.length+' reserva(s)';
  const tbody = document.querySelector('#tabelaReservas tbody');
  if (reservas.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Nenhuma reserva encontrada.</td></tr>';
    return;
  }
  tbody.innerHTML = reservas.map(r => {
    const sala  = salas.find(s => s.id === r.salaId);
    const turma = r.turmaId ? turmas.find(t => t.id === r.turmaId) : null;
    const diasStr = r.diasSemana.map(d => d.toUpperCase()).join(', ');
    const isAtiva = r.status === 'ATIVA';
    const turmaLabel = r.avulsa ? '<span class="badge badge-warning">Sem turma</span>' : (turma ? escapeHtml(turma.nome) : '<em>Turma removida</em>');
    return `
      <tr>
        <td><strong>${sala ? escapeHtml(sala.nome) : '<em>Sala removida</em>'}</strong></td>
        <td class="code-text">${turmaLabel}</td>
        <td><span class="badge badge-primary">${r.turno}</span></td>
        <td style="font-size:.82rem;color:var(--text-muted)">${diasStr}</td>
        <td style="font-size:.87rem">${formatDate(r.dataInicio)} → ${formatDate(r.dataFim)}</td>
        <td><span class="badge ${isAtiva ? 'badge-success' : 'badge-danger'}">${r.status}</span></td>
        <td>
          ${isAtiva ? `<button class="btn btn-danger-sm" onclick="excluirReserva(${r.id})">Excluir</button>` : '—'}
        </td>
      </tr>
    `;
  }).join('');
}
