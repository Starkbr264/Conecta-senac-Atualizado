const DIA_MAP = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];


function initDisponibilidade() {
  _popularSelectDispSalas();


  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('dispData').value = hoje;

  document.getElementById('btnVerificar').addEventListener('click', verificarDisponibilidade);
  document.getElementById('dispData').addEventListener('change', verificarDisponibilidade);
  document.getElementById('dispSala').addEventListener('change', verificarDisponibilidade);
  document.getElementById('dispTurno').addEventListener('change', verificarDisponibilidade);
}


function _popularSelectDispSalas() {
  const sel = document.getElementById('dispSala');
  sel.innerHTML = '<option value="">— Selecione uma sala —</option>';
  getSalas().forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.nome} (${s.tipo})`;
    sel.appendChild(o);
  });
}


function refreshDisponibilidade() {
  _popularSelectDispSalas();
  document.getElementById('resultadoDisponibilidade').className = 'disp-result';
}


function verificarDisponibilidade() {
  const salaId  = parseInt(document.getElementById('dispSala').value);
  const turno   = document.getElementById('dispTurno').value;
  const dataStr = document.getElementById('dispData').value;
  const result  = document.getElementById('resultadoDisponibilidade');

  if (!salaId || !dataStr) {
    result.className = 'disp-result';
    return;
  }


  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const diaIdx = new Date(ano, mes - 1, dia).getDay();
  const diaAbrev = DIA_MAP[diaIdx];


  const ocupadas = getReservas().filter(r =>
    r.salaId   === salaId &&
    r.turno    === turno  &&
    r.status   === 'ATIVA' &&
    r.dataInicio <= dataStr &&
    r.dataFim   >= dataStr &&
    r.diasSemana.includes(diaAbrev)
  );

  const sala = getSalas().find(s => s.id === salaId);

  if (ocupadas.length === 0) {
    result.className = 'disp-result livre';
    result.innerHTML = `
      <span class="disp-icon"><i class="ph ph-check-circle"></i></span>
      <div>
        <strong>LIVRE</strong>
        <div style="font-size:.88rem;font-weight:400;margin-top:4px;opacity:.8">
          ${sala?.nome} — ${turno} — ${formatDate(dataStr)} (${diaNomeCompleto(diaAbrev)})
        </div>
      </div>`;
  } else {
    const turmasOcup = ocupadas.map(r => {
      const t = getTurmas().find(tm => tm.id === r.turmaId);
      return t ? `<strong>${escapeHtml(t.nome)}</strong> — ${escapeHtml(t.curso)}` : 'Turma desconhecida';
    });
    result.className = 'disp-result ocupada';
    result.innerHTML = `
      <span class="disp-icon"><i class="ph ph-x-circle"></i></span>
      <div>
        <strong>OCUPADA</strong>
        <div style="font-size:.88rem;font-weight:400;margin-top:4px;opacity:.9">
          ${sala?.nome} — ${turno} — ${formatDate(dataStr)} (${diaNomeCompleto(diaAbrev)})<br>
          Turma: ${turmasOcup.join('; ')}
        </div>
      </div>`;
  }
}


function diaNomeCompleto(abrev) {
  const nomes = { dom:'Domingo', seg:'Segunda-feira', ter:'Terça-feira',
                  qua:'Quarta-feira', qui:'Quinta-feira', sex:'Sexta-feira', sab:'Sábado' };
  return nomes[abrev] || abrev;
}
