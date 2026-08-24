/*
 * search.js
 * Utilitario de busca e filtro em tabelas.
 * Aplicado nos paineis de Salas, Turmas, Reservas e Chaves.
 */
function filtrarLista(lista, termo, campos) {
  if (!termo || !termo.trim()) return lista;
  var t = termo.trim().toLowerCase();
  return lista.filter(function(item) {
    return campos.some(function(c) {
      var val = typeof c === 'function' ? c(item) : (item[c] || '');
      return String(val).toLowerCase().includes(t);
    });
  });
}


function aplicarFiltros(lista, filtros) {
  return lista.filter(function(item) {
    return Object.keys(filtros).every(function(k) {
      var v = filtros[k];
      if (!v && v !== 0) return true;
      return String(item[k]) === String(v);
    });
  });
}


function htmlBarraBusca(placeholder, inputId) {
  return '<div class="search-bar"><span class="search-icon"><i class="ph ph-magnifying-glass"></i></span>'
    + '<input type="text" id="' + inputId + '" class="search-input" placeholder="' + esc(placeholder) + '" autocomplete="off">'
    + '<button class="search-clear" onclick="document.getElementById(\'' + inputId + '\').value=\'\';document.getElementById(\'' + inputId + '\').dispatchEvent(new Event(\'input\'));" title="Limpar"><i class="ph ph-x"></i></button>'
    + '</div>';
}


function htmlFiltroSelect(id, label, opcoes) {
  var opts = '<option value="">Todos</option>'
    + opcoes.map(function(o){return '<option value="'+esc(String(o.value))+'">'+esc(o.label)+'</option>';}).join('');
  return '<div class="filter-item">'
    + '<label class="filter-label">'+esc(label)+'</label>'
    + '<select id="'+id+'" class="filter-select">'+opts+'</select>'
    + '</div>';
}


function montarBarraPesquisaFiltros(containerId, config, onUpdate) {
  var cont = document.getElementById(containerId);
  if (!cont) return;

  var html = '<div class="search-filter-bar">';

  if (config.busca) {
    html += htmlBarraBusca(config.busca.placeholder || 'Pesquisar…', config.busca.id);
  }

  if (config.filtros && config.filtros.length) {
    html += '<div class="filters-row">';
    config.filtros.forEach(function(f) {
      html += htmlFiltroSelect(f.id, f.label, f.opcoes);
    });
    if (config.mostrarBotaoLimpar !== false) {
      html += '<button class="btn btn-ghost btn-sm" style="align-self:flex-end" onclick="limparFiltros(\'' + containerId + '\',\'' + (config.busca ? config.busca.id : '') + '\')">Limpar filtros</button>';
    }
    html += '</div>';
  }

  html += '</div>';
  cont.innerHTML = html;


  function dispararUpdate() { if (typeof onUpdate === 'function') onUpdate(); }

  if (config.busca) {
    var inp = document.getElementById(config.busca.id);
    if (inp) inp.addEventListener('input', dispararUpdate);
  }
  if (config.filtros) {
    config.filtros.forEach(function(f) {
      var sel = document.getElementById(f.id);
      if (sel) sel.addEventListener('change', dispararUpdate);
    });
  }
}


function limparFiltros(containerId, buscaId) {
  var cont = document.getElementById(containerId);
  if (!cont) return;
  cont.querySelectorAll('select').forEach(function(s){ s.value = ''; });
  if (buscaId) {
    var inp = document.getElementById(buscaId);
    if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input')); return; }
  }

  var inp2 = cont.querySelector('input');
  if (inp2) inp2.dispatchEvent(new Event('input'));
}


function lerFiltros(config) {
  var resultado = {};
  if (config.busca) {
    var inp = document.getElementById(config.busca.id);
    resultado._busca = inp ? inp.value : '';
  }
  if (config.filtros) {
    config.filtros.forEach(function(f) {
      var sel = document.getElementById(f.id);
      resultado[f.campo || f.id] = sel ? sel.value : '';
    });
  }
  return resultado;
}
