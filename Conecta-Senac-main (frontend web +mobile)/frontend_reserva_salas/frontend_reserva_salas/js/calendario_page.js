/*
 * calendario_page.js
 * Calendario de reservas — compartilhado por todos os paineis.
 *
 * Modos de visualizacao:
 *   Mes   — grade 7 colunas (Seg a Dom) com eventos coloridos por turno
 *   Semana — grade com linhas por turno (Matutino / Vespertino / Noturno)
 *
 * Cores dos eventos:
 *   Ambar  — Matutino
 *   Azul   — Vespertino
 *   Roxo   — Noturno
 *   Laranja — Sem turma (reserva pontual)
 *
 * Filtros por role:
 *   Admin       — todas as reservas do sistema
 *   Coordenador — reservas da propria unidade
 *   Recepcao    — reservas da propria unidade
 *   Instrutor   — apenas reservas das proprias turmas
 *
 * Funcoes publicas (window.*):
 *   rdCalendario, calDia, calAnterior, calProximo, calHoje, calVista, calFiltrar
 */
(function() {
  'use strict';


// Estado interno do calendario
  var _hoje = new Date(); _hoje.setHours(0,0,0,0);
  var _estado = {
    ano:        _hoje.getFullYear(),
    mes:        _hoje.getMonth(),
    vista:      'mes',
    diaSel:     _hoje,
    semBase:    _seg(_hoje),
    filtSala:   '',
    filtTurno:  '',
  };

  var _MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var _DIAS_LONG = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira',
                    'Quinta-feira','Sexta-feira','Sábado'];
  var _DOW_SEG = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  var _TURNOS  = ['Matutino','Vespertino','Noturno'];


// Converte Date para string ISO (YYYY-MM-DD)
  function _iso(d) {
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    return d.getFullYear()+'-'+mm+'-'+dd;
  }
// Calcula a segunda-feira da semana de uma data
  function _seg(d) {
    var dt = new Date(d); dt.setHours(0,0,0,0);
    var dow = dt.getDay();
    var diff = (dow === 0) ? -6 : 1 - dow;
    dt.setDate(dt.getDate() + diff);
    return dt;
  }
  function _add(d, n) {
    var dt = new Date(d); dt.setDate(dt.getDate() + n); return dt;
  }
  function _fmt(d) {
    return String(d.getDate()).padStart(2,'0') + '/' +
           String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
  }
  function _fmtLonga(d) {
    return _DIAS_LONG[d.getDay()] + ', ' + d.getDate() +
           ' de ' + _MESES[d.getMonth()].toLowerCase() + ' de ' + d.getFullYear();
  }
  function _tcl(turno) {
    if (!turno) return 'mat';
    var t = turno.toLowerCase();
    if (t.indexOf('mat') > -1) return 'mat';
    if (t.indexOf('ves') > -1) return 'ves';
    if (t.indexOf('not') > -1) return 'not';
    return 'mat';
  }
  function _dowStr(dt) {
    return ['dom','seg','ter','qua','qui','sex','sab'][dt.getDay()];
  }
// Verifica se uma reserva ocorre em determinado dia
  function _ocorre(r, dt) {
    var iso = _iso(dt);
    if (r.dataInicio > iso || r.dataFim < iso) return false;
    var ds = _dowStr(dt);
    return (r.diasSemana || []).some(function(d){ return d.toLowerCase() === ds; });
  }


// Retorna reservas filtradas pelo perfil do usuario logado
  function _res() {
    try {
      var sess = getSessao();
      if (!sess) return [];
      var all  = getReservas ? getReservas() : [];
      var list;
      if (sess.perfil === 'admin') {
        list = all;
      } else if (sess.perfil === 'instrutor') {
        list = all.filter(function(r) {
          var t = r.turmaId ? getTurmaById(r.turmaId) : null;
          return String(r.instrutorId) === String(sess.id) ||
                 (t && String(t.instrutorId) === String(sess.id));
        });
      } else {
        list = all.filter(function(r) {
          return String(r.unidadeId) === String(sess.unidadeId);
        });
      }
      if (_estado.filtSala)  list = list.filter(function(r){ return String(r.salaId) === _estado.filtSala; });
      if (_estado.filtTurno) list = list.filter(function(r){ return r.turno === _estado.filtTurno; });
      return list;
    } catch(e) { console.error('[Cal] _res:', e); return []; }
  }


  function _el(id) { return document.getElementById(id); }


// Preenche o select de filtro com as salas da unidade
  function _populaSalas() {
    var sel = _el('calFiltSala'); if (!sel) return;
    var prev = sel.value;
    sel.innerHTML = '<option value="">Todas as salas</option>';
    try {
      var sess = getSessao(); if (!sess) return;
      var list = sess.perfil === 'admin' ? getSalas() : getSalasByUnidade(sess.unidadeId);
      (list || []).forEach(function(s) {
        var o = document.createElement('option');
        o.value = String(s.id); o.textContent = s.nome;
        if (o.value === String(prev)) o.selected = true;
        sel.appendChild(o);
      });
    } catch(e) { console.error('[Cal] _populaSalas:', e); }
  }


// Atualiza o texto do periodo exibido na toolbar
  function _periodo() {
    var el = _el('calPeriodo'); if (!el) return;
    if (_estado.vista === 'mes') {
      el.textContent = _MESES[_estado.mes] + ' ' + _estado.ano;
    } else {
      var fim = _add(_estado.semBase, 6);
      el.textContent = _fmt(_estado.semBase) + ' – ' + _fmt(fim);
    }
  }


// Renderiza a grade mensal
  function _mes() {
    var cont = _el('calCorpo'); if (!cont) return;
    try {
      var hojeISO = _iso(_hoje);
      var selISO  = _estado.diaSel ? _iso(_estado.diaSel) : '';
      var lista   = _res();

      var prim  = new Date(_estado.ano, _estado.mes, 1);
      var sdow  = prim.getDay();
      var off   = (sdow === 0) ? 6 : sdow - 1;
      var dim   = new Date(_estado.ano, _estado.mes + 1, 0).getDate();

      var h = '<div class="cal-grid-wrap"><div class="cal-grid">';


      _DOW_SEG.forEach(function(d, i) {
        h += '<div class="cal-dow-header' + (i === 6 ? ' weekend' : '') + '">' + d + '</div>';
      });


      var prevDim = new Date(_estado.ano, _estado.mes, 0).getDate();
      for (var p = off; p > 0; p--) {
        h += '<div class="cal-day outro-mes"><span class="cal-day-num">' + (prevDim - p + 1) + '</span></div>';
      }


      for (var dia = 1; dia <= dim; dia++) {
        var dt  = new Date(_estado.ano, _estado.mes, dia);
        var iso = _iso(dt);
        var cls = 'cal-day';
        if (iso === hojeISO) cls += ' hoje';
        if (iso === selISO)  cls += ' selecionado';
        if (dt.getDay() === 0 || dt.getDay() === 6) cls += ' weekend';

        var evs = lista.filter(function(r){ return _ocorre(r, dt); });

        h += '<div class="' + cls + '" onclick="calDia(\'' + iso + '\')">';
        h += '<span class="cal-day-num">' + dia + '</span>';
        evs.slice(0, 3).forEach(function(r) {
          var sala = getSalaById ? getSalaById(r.salaId) : null;
          var nome = sala ? sala.nome : 'Sala';
          if (nome.length > 13) nome = nome.slice(0,12) + '…';
          h += '<div class="cal-ev ' + (r.avulsa ? 'avul' : _tcl(r.turno)) + '">' +
               esc(nome) + '</div>';
        });
        if (evs.length > 3) h += '<div class="cal-ev-mais">+' + (evs.length - 3) + ' mais</div>';
        h += '</div>';
      }


      var total  = off + dim;
      var resto  = (7 - (total % 7)) % 7;
      for (var j = 1; j <= resto; j++) {
        h += '<div class="cal-day outro-mes"><span class="cal-day-num">' + j + '</span></div>';
      }

      h += '</div></div>';
      cont.innerHTML = h;
    } catch(e) {
      console.error('[Cal] _mes:', e);
      cont.innerHTML = '<div style="padding:24px;color:var(--red)"><i class="ph ph-warning"></i> Erro ao renderizar o calendário: ' + e.message + '</div>';
    }
  }


// Renderiza a grade semanal
  function _sem() {
    var cont = _el('calCorpo'); if (!cont) return;
    try {
      var hojeISO = _iso(_hoje);
      var lista   = _res();
      var dias    = [];
      for (var i = 0; i < 7; i++) dias.push(_add(_estado.semBase, i));

      var h = '<div class="cal-grid-wrap"><div class="cal-semana-grid">';


      h += '<div class="cal-sem-col-header" style="background:var(--surface2)"></div>';
      dias.forEach(function(d) {
        var isHj = _iso(d) === hojeISO;
        var isWE = (d.getDay() === 0 || d.getDay() === 6);
        var dowIdx = (d.getDay() === 0) ? 6 : d.getDay() - 1;
        h += '<div class="cal-sem-col-header' + (isHj ? ' hoje' : '') + (isWE ? ' weekend' : '') + '">';
        h += '<div class="cal-sem-dow">' + _DOW_SEG[dowIdx] + '</div>';
        if (isHj) {
          h += '<div class="cal-sem-date" style="width:26px;height:26px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;margin:2px auto 0;font-size:.8rem">' + d.getDate() + '</div>';
        } else {
          h += '<div class="cal-sem-date">' + d.getDate() + '</div>';
        }
        h += '</div>';
      });


      var icons = { Matutino:'ph-sun', Vespertino:'ph-cloud-sun', Noturno:'ph-moon' };
      _TURNOS.forEach(function(turno) {
        var tc = _tcl(turno);
        h += '<div class="cal-sem-turno-label"><i class="ph ' + (icons[turno]||'ph-clock') + '"></i></div>';
        dias.forEach(function(d) {
          var iso  = _iso(d);
          var isHj = iso === hojeISO;
          var evs  = lista.filter(function(r){ return _ocorre(r,d) && r.turno === turno; });
          h += '<div class="cal-sem-cell' + (isHj ? ' hoje' : '') + '" onclick="calDia(\'' + iso + '\')">';
          evs.forEach(function(r) {
            var sala = getSalaById ? getSalaById(r.salaId) : null;
            var nome = sala ? sala.nome : 'Sala';
            if (nome.length > 11) nome = nome.slice(0,10) + '…';
            h += '<div class="cal-ev ' + (r.avulsa ? 'avul' : tc) + '">' + esc(nome) + '</div>';
          });
          if (!evs.length) h += '<span style="font-size:.6rem;color:var(--border2)">—</span>';
          h += '</div>';
        });
      });

      h += '</div></div>';
      cont.innerHTML = h;
    } catch(e) {
      console.error('[Cal] _sem:', e);
      cont.innerHTML = '<div style="padding:24px;color:var(--red)"><i class="ph ph-warning"></i> Erro: ' + e.message + '</div>';
    }
  }


// Renderiza o painel lateral com detalhes do dia selecionado
  function _detalhe(dt) {
    var el = _el('calDetalhe'); if (!el) return;
    try {
      var iso   = _iso(dt);
      var isHj  = iso === _iso(_hoje);
      var lista = _res().filter(function(r){ return _ocorre(r, dt); });

      var h = '<div class="cal-det-header" style="background:' + (isHj ? 'var(--primary)' : '#1a3a5c') + '">';
      h += '<div class="cal-det-data">' + esc(_fmt(dt)) + (isHj ? ' · Hoje' : '') + '</div>';
      h += '<div class="cal-det-titulo">' + esc(_fmtLonga(dt)) + '</div></div>';
      h += '<div class="cal-det-body">';

      if (!lista.length) {
        h += '<div class="cal-det-vazio"><i class="ph ph-check-circle" style="font-size:1.4rem;opacity:.3;display:block;margin-bottom:6px"></i>Nenhuma reserva neste dia.</div>';
      } else {
        var icons2 = { Matutino:'ph-sun', Vespertino:'ph-cloud-sun', Noturno:'ph-moon' };
        _TURNOS.forEach(function(turno) {
          var grupo = lista.filter(function(r){ return r.turno === turno; });
          if (!grupo.length) return;
          var tc = _tcl(turno);
          h += '<div class="cal-det-turno-grupo"><div class="cal-det-turno-titulo">';
          h += '<span class="cal-leg-dot ' + tc + '"></span>';
          h += '<i class="ph ' + (icons2[turno]||'ph-clock') + '"></i> ' + esc(turno) + '</div>';
          grupo.forEach(function(r) {
            var sala  = getSalaById  ? getSalaById(r.salaId)   : null;
            var turma = getTurmaById ? getTurmaById(r.turmaId) : null;
            var inst  = turma && turma.instrutorId && getUserById ? getUserById(turma.instrutorId) :
                        (r.instrutorId && getUserById ? getUserById(r.instrutorId) : null);
            h += '<div class="cal-det-item ' + (r.avulsa ? 'avul' : tc) + '">';
            h += '<div class="cal-det-sala">' + esc(sala ? sala.nome : '—');
            if (r.avulsa) h += '<span class="cal-det-avulsa-badge">Sem turma</span>';
            h += '</div>';
            if (turma) h += '<div class="cal-det-turma"><i class="ph ph-graduation-cap"></i> ' +
                            esc(turma.codigo || turma.nome || '') +
                            (turma.curso ? ' — ' + esc(turma.curso) : '') + '</div>';
            if (inst)  h += '<div class="cal-det-inst"><i class="ph ph-user"></i> ' + esc(inst.nome) + '</div>';
            h += '</div>';
          });
          h += '</div>';
        });

        lista.filter(function(r){ return r.avulsa && !r.turno; }).forEach(function(r) {
          var sala = getSalaById ? getSalaById(r.salaId) : null;
          h += '<div class="cal-det-item avul"><div class="cal-det-sala">' +
               esc(sala ? sala.nome : '—') + '<span class="cal-det-avulsa-badge">Sem turma</span></div></div>';
        });
      }
      h += '</div>';
      el.innerHTML = h;
    } catch(e) {
      console.error('[Cal] _detalhe:', e);
      var el2 = _el('calDetalhe');
      if (el2) el2.innerHTML = '<div style="padding:16px;color:var(--red)">Erro: ' + e.message + '</div>';
    }
  }


// Funcao principal — atualiza todo o calendario
  window.rdCalendario = function() {
    try {
      _populaSalas();
      _estado.filtSala  = (_el('calFiltSala')  || {}).value || '';
      _estado.filtTurno = (_el('calFiltTurno') || {}).value || '';
      _periodo();
      if (_estado.vista === 'mes') _mes(); else _sem();
      _detalhe(_estado.diaSel || _hoje);
    } catch(e) {
      console.error('[Cal] rdCalendario:', e);
      var c = _el('calCorpo');
      if (c) c.innerHTML = '<div style="padding:24px;color:var(--red)"><b>Erro ao carregar calendário:</b><br>' + e.message + '</div>';
    }
  };

// Handler de clique em um dia do calendario
  window.calDia = function(iso) {
    try {
      var p = iso.split('-').map(Number);
      _estado.diaSel = new Date(p[0], p[1]-1, p[2]);
      _detalhe(_estado.diaSel);

      document.querySelectorAll('.cal-day, .cal-sem-cell').forEach(function(el) {
        el.classList.remove('selecionado');
      });
      document.querySelectorAll('[onclick="calDia(\'' + iso + '\')"]').forEach(function(el) {
        el.classList.add('selecionado');
      });
    } catch(e) { console.error('[Cal] calDia:', e); }
  };

// Navega para o mes ou semana anterior
  window.calAnterior = function() {
    if (_estado.vista === 'mes') {
      if (_estado.mes === 0) { _estado.mes = 11; _estado.ano--; }
      else _estado.mes--;
    } else {
      _estado.semBase = _add(_estado.semBase, -7);
    }
// Funcao principal — atualiza todo o calendario
    window.rdCalendario();
  };

// Navega para o proximo mes ou semana
  window.calProximo = function() {
    if (_estado.vista === 'mes') {
      if (_estado.mes === 11) { _estado.mes = 0; _estado.ano++; }
      else _estado.mes++;
    } else {
      _estado.semBase = _add(_estado.semBase, 7);
    }
// Funcao principal — atualiza todo o calendario
    window.rdCalendario();
  };

// Volta para o mes atual e seleciona hoje
  window.calHoje = function() {
    _hoje = new Date(); _hoje.setHours(0,0,0,0);
    _estado.ano     = _hoje.getFullYear();
    _estado.mes     = _hoje.getMonth();
    _estado.diaSel  = _hoje;
    _estado.semBase = _seg(_hoje);
// Funcao principal — atualiza todo o calendario
    window.rdCalendario();
  };

// Alterna entre vista mensal e semanal
  window.calVista = function(v) {
    _estado.vista = v;
    document.querySelectorAll('.cal-view-btn').forEach(function(b) {
      b.classList.toggle('ativo', b.dataset.vista === v);
    });
// Funcao principal — atualiza todo o calendario
    window.rdCalendario();
  };

// Aplica os filtros de sala e turno
  window.calFiltrar = function() {
    _estado.filtSala  = (_el('calFiltSala')  || {}).value || '';
    _estado.filtTurno = (_el('calFiltTurno') || {}).value || '';
// Funcao principal — atualiza todo o calendario
    window.rdCalendario();
  };


// Navega para o mes ou semana anterior
  window.calMesAnterior = window.calAnterior;
// Navega para o proximo mes ou semana
  window.calProximoMes  = window.calProximo;
// Alterna entre vista mensal e semanal
  window.calSetVista    = window.calVista;

})();
