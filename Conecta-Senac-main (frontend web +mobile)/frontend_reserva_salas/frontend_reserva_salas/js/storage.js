/*
 * storage.js
 * Camada de dados local — substitui chamadas ao backend.
 * Usa localStorage para persistir todos os dados do sistema.
 *
 * Estrutura principal:
 *   _K          — chaves do localStorage
 *   CACHE       — espelho em memória (carregado pelo initDados)
 *   _seedDados  — popula dados iniciais se ainda nao existirem
 *   initDados   — inicializa o sistema e carrega o cache
 *
 * CRUD disponivel para:
 *   Usuarios, Unidades, Salas, Turmas, Reservas,
 *   Chaves, Solicitacoes, Notificacoes
 *
 * Funcoes utilitarias exportadas:
 *   fmtData, calcStatus, labelStatus, esc, iniciais,
 *   toast, fmsg, modalAbrir, modalFechar, initTema, toggleTema
 */


// Endereco do backend em producao
const API_BASE = 'https://conecta-senac.onrender.com';


// Chaves do localStorage
const _K = {
  usuarios:      'sn_v6_usuarios',
  unidades:      'sn_v6_unidades',
  salas:         'sn_v6_salas',
  turmas:        'sn_v6_turmas',
  reservas:      'sn_v6_reservas',
  chaves:        'sn_v6_chaves',
  notificacoes:  'sn_v6_notificacoes',
  solicitacoes:  'sn_v6_solicitacoes',
  sessao:        'sn_v6_sessao',
  tema:          'sn_v6_tema',
  init:          'sn_v6_init_v1'
};


function _lv(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : []; }
  catch (_) { return []; }
}

function _sv(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
}

function _sessionStore() {
  try { return window.sessionStorage; } catch (_) { return null; }
}

function _getSessaoLocal() {
  try {
    const store = _sessionStore();
    let v = store ? store.getItem(_K.sessao) : localStorage.getItem(_K.sessao);

    if (!v) {
      const legacy = localStorage.getItem(_K.sessao);

      if (legacy && store) {
        store.setItem(_K.sessao, legacy);
        localStorage.removeItem(_K.sessao);
        v = legacy;
      }
    }

    return v ? JSON.parse(v) : null;
  } catch (_) {
    return null;
  }
}

function _setSessaoLocal(sessao) {
  const txt = JSON.stringify(sessao);
  const store = _sessionStore();

  if (store) {
    store.setItem(_K.sessao, txt);
    localStorage.removeItem(_K.sessao);
  } else {
    localStorage.setItem(_K.sessao, txt);
  }
}

function _clearSessaoLocal() {
  const store = _sessionStore();

  if (store) store.removeItem(_K.sessao);

  localStorage.removeItem(_K.sessao);
}

function _nextId(list) {
  return list.reduce((mx, x) => Math.max(mx, Number(x.id) || 0), 0) + 1;
}

function sortById(list) {
  return [...list].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
}

function lowerPerfil(v) {
  return String(v || '').toLowerCase();
}


// Cache em memoria (espelho do localStorage)
const CACHE = {
  usuarios: [],
  unidades: [],
  salas: [],
  turmas: [],
  reservas: [],
  chaves: [],
  notificacoes: [],
  solicitacoes: [],
  loaded: false,
  loadingPromise: null
};


// Carrega dados do localStorage para o cache
function _load() {
  CACHE.usuarios     = _lv(_K.usuarios);
  CACHE.unidades     = _lv(_K.unidades);
  CACHE.salas        = _lv(_K.salas);
  CACHE.turmas       = _lv(_K.turmas);
  CACHE.reservas     = _lv(_K.reservas);
  CACHE.chaves       = _lv(_K.chaves);
  CACHE.notificacoes = _lv(_K.notificacoes);
  CACHE.solicitacoes = _lv(_K.solicitacoes);
}

function _persist(key) {
  _sv(_K[key], CACHE[key]);
  _pushColecao(key);
}


// Fila de ids removidos localmente aguardando propagacao ao servidor.
// (O merge do /api/sinc e por id; sem isso, exclusoes seriam ressuscitadas
// na proxima sincronizacao.)
function _marcarRemovido(key, id) {
  if (!CACHE._remocoes) CACHE._remocoes = {};

  if (!CACHE._remocoes[key]) CACHE._remocoes[key] = [];

  if (CACHE._remocoes[key].indexOf(id) === -1) {
    CACHE._remocoes[key].push(id);
  }
}


// Envia a colecao alterada + remocoes pendentes ao servidor central em
// background (merge por id em /api/sinc). Se o servidor estiver fora,
// mantem as remocoes na fila para a proxima tentativa.
function _pushColecao(key) {
  if (!CACHE[key]) return;

  try {
    var remocoes = {};

    if (
      CACHE._remocoes &&
      CACHE._remocoes[key] &&
      CACHE._remocoes[key].length
    ) {
      remocoes[key] = CACHE._remocoes[key];
    }

    fetch(`${API_BASE}/api/sinc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alteracoes: { [key]: CACHE[key] },
        remocoes: remocoes
      })
    })
      .then(function(resp) {
        if (resp.ok && CACHE._remocoes) {
          delete CACHE._remocoes[key];
        }
      })
      .catch(function() {});

  } catch (_) {}
}


// Sincronizacao com o servidor central (fonte da verdade web + mobile):
//  1) propaga remocoes pendentes feitas offline;
//  2) baixa o banco completo do servidor e substitui o cache + localStorage.
//
// IMPORTANTE: NAO envia o seed/cache local em massa — isso sobrescrevia o
// banco central com dados divergentes de seed. O servidor e a fonte da
// verdade; cada alteracao local ja foi (ou sera) propagada via _pushColecao.
async function _sincronizarServidor() {
  try {

    // 1) Propaga remocoes pendentes (feitas offline)
    if (CACHE._remocoes) {

      var remocoes = {};

      Object.keys(CACHE._remocoes).forEach(function(chave) {
        if (
          CACHE._remocoes[chave] &&
          CACHE._remocoes[chave].length
        ) {
          remocoes[chave] = CACHE._remocoes[chave];
        }
      });

      if (Object.keys(remocoes).length) {

        const sr = await fetch(`${API_BASE}/api/sinc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alteracoes: {},
            remocoes: remocoes
          })
        });

        if (sr.ok) CACHE._remocoes = {};
      }
    }


    // 2) Baixa o banco do servidor (fonte da verdade compartilhada)
    const resp = await fetch(`${API_BASE}/api/dados`);

    if (!resp.ok) return;

    const remoto = await resp.json();

    const chaves = [
      'usuarios',
      'unidades',
      'salas',
      'turmas',
      'reservas',
      'chaves',
      'notificacoes',
      'solicitacoes'
    ];

    chaves.forEach(function(chave) {
      if (Array.isArray(remoto[chave])) {
        CACHE[chave] = remoto[chave];
        _sv(_K[chave], remoto[chave]);
      }
    });

    console.log('[web] Banco sincronizado com o servidor central.');

  } catch (err) {
    console.warn(
      '[web] Sincronizacao falhou (modo offline):',
      err
    );
  }
}


// Leitura de dados
function getUsuarios() {
  return [...CACHE.usuarios];
}

function getUsuarioById(id) {
  return CACHE.usuarios.find(
    u => String(u.id) === String(id)
  ) || null;
}

function getUserById(id) {
  return getUsuarioById(id);
}

function getUsersByPerfil(p) {
  return CACHE.usuarios.filter(
    u => u.perfil === lowerPerfil(p)
  );
}


// Leitura de dados
function getUsuariosByPerfil(p) {
  return getUsersByPerfil(p);
}


function getUnidades() {
  return [...CACHE.unidades];
}

function getUnidadeById(id) {
  return CACHE.unidades.find(
    u => String(u.id) === String(id)
  ) || null;
}


function getSalas() {
  return [...CACHE.salas];
}

function getSalaById(id) {
  return CACHE.salas.find(
    s => String(s.id) === String(id)
  ) || null;
}

function getSalasByUnidade(uid) {
  return CACHE.salas.filter(
    s => String(s.unidadeId) === String(uid)
  );
}


function getTurmas() {
  return [...CACHE.turmas];
}

function getTurmaById(id) {
  return CACHE.turmas.find(
    t => String(t.id) === String(id)
  ) || null;
}


function getReservas() {
  return [...CACHE.reservas];
}

function getReservaById(id) {
  return CACHE.reservas.find(
    r => String(r.id) === String(id)
  ) || null;
}


function getChaves() {
  return [...CACHE.chaves];
}

function getChaveById(id) {
  return CACHE.chaves.find(
    c => String(c.id) === String(id)
  ) || null;
}


function getNotifs() {
  return [...CACHE.notificacoes];
}

function getNotifsPara(perfil, unidadeId) {
  const sess = getSessao();
  const pn = lowerPerfil(perfil);

  return CACHE.notificacoes.filter(n => {

    if (
      sess &&
      n.paraId &&
      String(n.paraId) === String(sess.id)
    ) {
      return true;
    }

    if (n.paraPerfil && n.paraPerfil === pn) {
      return (
        !n.unidadeId ||
        !unidadeId ||
        String(n.unidadeId) === String(unidadeId)
      );
    }

    return false;
  });
}

function getSolics() {
  return [...CACHE.solicitacoes];
}


// Login
async function loginUser(email, senha) {

  // 1) Tenta validar no servidor central (mesmo banco do mobile)
  try {

    const resp = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        senha: senha
      })
    });

    if (resp.ok) {
      const dados = await resp.json();

      if (dados.usuario) {
        return dados.usuario;
      }
    }

  } catch (_) {}


  // 2) Offline: valida contra o cache local
  const u = CACHE.usuarios.find(u =>
    u.email.toLowerCase() === email.toLowerCase() &&
    u.senha === senha
  );

  return u ? { ...u } : null;
}


// CRUD — Usuarios
async function addUser(dados) {
  const item = {
    ...dados,
    id: _nextId(CACHE.usuarios),
    perfil: lowerPerfil(dados.perfil)
  };

  CACHE.usuarios.push(item);
  _persist('usuarios');

  return item;
}

async function addUsuario(d) {
  return addUser(d);
}


async function updUser(id, dados) {
  const idx = CACHE.usuarios.findIndex(
    u => String(u.id) === String(id)
  );

  if (idx < 0) return null;

  if (dados.perfil) {
    dados.perfil = lowerPerfil(dados.perfil);
  }

  CACHE.usuarios[idx] = {
    ...CACHE.usuarios[idx],
    ...dados
  };

  _persist('usuarios');

  return {
    ...CACHE.usuarios[idx]
  };
}

async function updUsuario(id, d) {
  return updUser(id, d);
}


async function delUser(id) {
  CACHE.usuarios = CACHE.usuarios.filter(
    u => String(u.id) !== String(id)
  );

  _marcarRemovido('usuarios', Number(id));
  _persist('usuarios');
}

async function delUsuario(id) {
  return delUser(id);
}


// CRUD — Unidades
function addUnidade(d) {
  const item = {
    ...d,
    id: _nextId(CACHE.unidades)
  };

  CACHE.unidades.push(item);
  _persist('unidades');

  return item;
}

function updUnidade(id, d) {
  const idx = CACHE.unidades.findIndex(
    u => String(u.id) === String(id)
  );

  if (idx < 0) return null;

  CACHE.unidades[idx] = {
    ...CACHE.unidades[idx],
    ...d
  };

  _persist('unidades');

  return {
    ...CACHE.unidades[idx]
  };
}

function delUnidade(id) {
  CACHE.unidades = CACHE.unidades.filter(
    u => String(u.id) !== String(id)
  );

  _marcarRemovido('unidades', Number(id));
  _persist('unidades');
}


// CRUD — Salas
function addSala(d) {
  const turnos = d.turnosDisponiveis || d.turnos || [];

  const item = {
    ...d,
    id: _nextId(CACHE.salas),
    turnosDisponiveis: turnos,
    turnos
  };

  CACHE.salas.push(item);
  _persist('salas');

  return item;
}

function updSala(id, d) {
  const idx = CACHE.salas.findIndex(
    s => String(s.id) === String(id)
  );

  if (idx < 0) return null;

  const turnos =
    d.turnosDisponiveis ||
    d.turnos ||
    CACHE.salas[idx].turnosDisponiveis ||
    [];

  CACHE.salas[idx] = {
    ...CACHE.salas[idx],
    ...d,
    turnosDisponiveis: turnos,
    turnos
  };

  _persist('salas');

  return {
    ...CACHE.salas[idx]
  };
}

function updateSala(id, d) {
  return updSala(id, d);
}

function delSala(id) {
  CACHE.salas = CACHE.salas.filter(
    s => String(s.id) !== String(id)
  );

  _marcarRemovido('salas', Number(id));
  _persist('salas');
}

function deleteSala(id) {
  return delSala(id);
}


// CRUD — Turmas
function addTurma(d) {
  const nome = d.codigo || d.nome || '';

  const item = {
    ...d,
    id: _nextId(CACHE.turmas),
    nome,
    codigo: nome
  };

  CACHE.turmas.push(item);
  _persist('turmas');

  return item;
}

function updTurma(id, d) {
  const idx = CACHE.turmas.findIndex(
    t => String(t.id) === String(id)
  );

  if (idx < 0) return null;

  CACHE.turmas[idx] = {
    ...CACHE.turmas[idx],
    ...d
  };

  _persist('turmas');

  return {
    ...CACHE.turmas[idx]
  };
}

function updateTurma(id, d) {
  return updTurma(id, d);
}

function delTurma(id) {
  CACHE.turmas = CACHE.turmas.filter(
    t => String(t.id) !== String(id)
  );

  _marcarRemovido('turmas', Number(id));

  CACHE.reservas = CACHE.reservas.filter(
    r => String(r.turmaId) !== String(id)
  );

  _persist('turmas');
  _persist('reservas');
}

function deleteTurma(id) {
  return delTurma(id);
}


// CRUD — Reservas
function addReserva(d) {
  const item = {
    ...d,
    id: _nextId(CACHE.reservas),
    status: d.status || 'ATIVA'
  };

  CACHE.reservas.push(item);
  _persist('reservas');

  return item;
}


// CRUD — Reservas
async function addReservaAsync(d) {
  return addReserva(d);
}

function updReserva(id, d) {
  const idx = CACHE.reservas.findIndex(
    r => String(r.id) === String(id)
  );

  if (idx < 0) return null;

  CACHE.reservas[idx] = {
    ...CACHE.reservas[idx],
    ...d
  };

  _persist('reservas');

  return {
    ...CACHE.reservas[idx]
  };
}

function delReserva(id) {
  CACHE.reservas = CACHE.reservas.filter(
    r => String(r.id) !== String(id)
  );

  _marcarRemovido('reservas', Number(id));
  _persist('reservas');
}

function deleteReserva(id) {
  return delReserva(id);
}


// CRUD — Chaves
function addChave(d) {
  const item = {
    ...d,
    id: _nextId(CACHE.chaves),
    status: d.status || 'disponivel'
  };

  CACHE.chaves.push(item);
  _persist('chaves');

  return item;
}

function updChave(id, d) {
  const idx = CACHE.chaves.findIndex(
    c => String(c.id) === String(id)
  );

  if (idx < 0) return null;

  CACHE.chaves[idx] = {
    ...CACHE.chaves[idx],
    ...d
  };

  _persist('chaves');

  return {
    ...CACHE.chaves[idx]
  };
}

function delChave(id) {
  CACHE.chaves = CACHE.chaves.filter(
    c => String(c.id) !== String(id)
  );

  _marcarRemovido('chaves', Number(id));
  _persist('chaves');
}

function deleteChave(id) {
  return delChave(id);
}

function retirarChave(id, instrutorId) {
  return updChave(id, {
    status: 'pega',
    instrutorId: Number(instrutorId),
    pegaEm: new Date().toISOString()
  });
}

async function retirarChaveAsync(id, instrutorId) {
  return retirarChave(id, instrutorId);
}

function devolverChaveApi(id) {
  return updChave(id, {
    status: 'disponivel',
    instrutorId: null,
    pegaEm: null
  });
}

async function devolverChaveAsync(id) {
  return devolverChaveApi(id);
}


// CRUD — Solicitacoes
function addSolic(d) {
  const item = {
    ...d,
    id: _nextId(CACHE.solicitacoes),
    status: d.status || 'pendente'
  };

  CACHE.solicitacoes.push(item);
  _persist('solicitacoes');

  return item;
}

function updSolic(id, d) {
  const idx = CACHE.solicitacoes.findIndex(
    s => String(s.id) === String(id)
  );

  if (idx < 0) return null;

  CACHE.solicitacoes[idx] = {
    ...CACHE.solicitacoes[idx],
    ...d
  };

  _persist('solicitacoes');

  return {
    ...CACHE.solicitacoes[idx]
  };
}

async function updSolicAsync(id, d) {
  return updSolic(id, d);
}


// CRUD — Notificacoes
function addNotif(d) {
  const item = {
    id: _nextId(CACHE.notificacoes),
    tipo: d.tipo || 'info',
    titulo: d.titulo || d.title || '',
    msg: d.msg || d.texto || '',
    mensagem: d.mensagem || '',
    paraPerfil: lowerPerfil(d.paraPerfil || d.para || ''),
    paraId: d.paraId ?? d.paraUsuarioId ?? null,
    unidadeId: d.unidadeId ?? null,
    lida: false,
    criadaEm: new Date().toISOString()
  };

  CACHE.notificacoes.push(item);
  _persist('notificacoes');

  return item;
}


// CRUD — Notificacoes
async function addNotifAsync(d) {
  return addNotif(d);
}

function countNaoLidas(perfil, unidadeId) {
  return getNotifsPara(perfil, unidadeId)
    .filter(n => !n.lida)
    .length;
}

function marcarTodasLidas(perfil, unidadeId) {
  getNotifsPara(perfil, unidadeId)
    .forEach(n => {
      n.lida = true;
    });

  _persist('notificacoes');
}


function getOverride(salaId, unidadeId) {
  const sala = getSalaById(salaId);

  if (!sala || !sala.statusManual) return null;

  if (
    unidadeId &&
    sala.unidadeId &&
    String(sala.unidadeId) !== String(unidadeId)
  ) {
    return null;
  }

  return {
    status: sala.statusManual,
    motivo: sala.motivoManual || '',
    por: sala.manualPor || '',
    criadaEm: sala.manualCriadaEm || null
  };
}

function setOverride(salaId, unidadeId, status, motivo, por) {
  return updSala(salaId, {
    statusManual: status || null,
    motivoManual: status ? (motivo || '') : '',
    manualPor: status ? (por || '') : '',
    manualCriadaEm: status
      ? new Date().toISOString().slice(0, 19)
      : null,
    unidadeId: unidadeId || undefined
  });
}


// Sessao e tema
function getSessao() {
  return _getSessaoLocal();
}

function setSessao(u) {
  _setSessaoLocal(u);
}

function clearSessao() {
  _clearSessaoLocal();
}

function getTema() {
  return localStorage.getItem(_K.tema) || 'light';
}

function initTema() {
  const t = getTema();
  document.documentElement.setAttribute('data-theme', t);
  return t;
}

function toggleTema() {
  const curr =
    document.documentElement.getAttribute('data-theme') ||
    getTema();

  const next = curr === 'dark' ? 'light' : 'dark';

  localStorage.setItem(_K.tema, next);
  document.documentElement.setAttribute('data-theme', next);

  return next;
}


// Utilitarios gerais
function newId() {
  return Date.now() + Math.floor(Math.random() * 9999);
}

function hojeISO() {
  return new Date().toISOString().split('T')[0];
}

function fmtData(iso) {
  if (!iso) return '—';

  const p = String(iso).split('-');

  return p.length === 3
    ? `${p[2]}/${p[1]}/${p[0]}`
    : String(iso);
}

function formatDate(iso) {
  return fmtData(iso);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtml(s) {
  return esc(s);
}

function iniciais(nome) {
  return String(nome || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p.charAt(0).toUpperCase())
    .join('') || 'SN';
}

function fmtDateTime(v) {
  if (!v) return '—';

  const d = new Date(v);

  if (isNaN(d.getTime())) return String(v);

  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear() +
    ' ' +
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
}

function calcStatus(turma) {
  if (!turma) return 'encerrada';

  const hoje = hojeISO();

  if (turma.dataFim && hoje > turma.dataFim) {
    return 'encerrada';
  }

  if (turma.dataInicio && hoje < turma.dataInicio) {

    const diff = Math.ceil(
      (
        new Date(turma.dataInicio + 'T00:00:00') -
        new Date(hoje + 'T00:00:00')
      ) / 86400000
    );

    if (diff >= 0 && diff <= 7) {
      return 'iminente';
    }

    return 'posterior';
  }

  return 'ativa';
}

function labelStatus(st) {
  return {
    ativa: 'Ativa',
    iminente: 'Iminente',
    posterior: 'Posterior',
    encerrada: 'Encerrada',
    ocupada: 'Ocupada',
    livre: 'Livre'
  }[st] || String(st || '');
}

function htmlStatus(turma) {
  const st = calcStatus(turma);

  return (
    '<span class="st st-' +
    esc(st) +
    '">' +
    esc(labelStatus(st)) +
    '</span>'
  );
}


// UI helpers
function toast(msg, tipo) {
  tipo = tipo || 'info';

  let box = document.getElementById('toasts');

  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }

  const el = document.createElement('div');

  el.className = 'toast ' + tipo;
  el.textContent = String(msg || '');

  box.appendChild(el);

  setTimeout(() => el.remove(), 3200);

  return el;
}

function showToast(msg, tipo) {
  return toast(
    msg,
    tipo === 'success' ? 'ok' : tipo
  );
}

function fmsg(id, tipo, msg) {
  const el = document.getElementById(id);

  if (!el) return;

  const css =
    tipo === 'success'
      ? 'ok'
      : (
        tipo === 'warning'
          ? 'aviso'
          : (tipo || 'erro')
      );

  el.className =
    (el.className || '')
      .replace(
        /\b(erro|ok|aviso|error|warning|success)\b/g,
        ''
      )
      .trim();

  el.classList.add('fmsg', css);
  el.textContent = String(msg || '');
  el.style.display = 'block';
}

function fmsgHide(id) {
  const el = document.getElementById(id);

  if (!el) return;

  el.textContent = '';
  el.style.display = 'none';

  el.className =
    (el.className || '')
      .replace(
        /\b(erro|ok|aviso|error|warning|success)\b/g,
        ''
      )
      .trim();

  if (!el.classList.contains('fmsg')) {
    el.classList.add('fmsg');
  }
}

function showMsg(id, tipo, msg) {
  const el = document.getElementById(id);

  if (!el) return;

  const map = {
    erro: 'error',
    ok: 'success',
    aviso: 'warning',
    warning: 'warning',
    success: 'success',
    error: 'error'
  };

  el.className =
    'form-msg ' +
    (map[tipo] || 'error');

  el.textContent = String(msg || '');
  el.style.display = 'block';
}

function hideMsg(id) {
  const el = document.getElementById(id);

  if (!el) return;

  el.className = 'form-msg';
  el.textContent = '';
  el.style.display = 'none';
}

function modalAbrir(id) {
  const el = document.getElementById(id);

  if (el) {
    el.style.display = 'flex';
    el.classList.add('on');
  }
}

function modalFechar(id) {
  const el = document.getElementById(id);

  if (el) {
    el.style.display = 'none';
    el.classList.remove('on');
  }
}


function atualizarSecao(fnName, btn) {
  const acao = window[fnName];

  if (typeof acao !== 'function') {
    toast(
      'Atualizacao indisponivel nesta tela.',
      'erro'
    );

    console.warn(
      '[Atualizar] Funcao nao encontrada:',
      fnName
    );

    return false;
  }

  const labelOriginal = btn
    ? btn.innerHTML
    : '';

  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-refreshing');

    btn.innerHTML =
      '<i class="ph ph-arrows-clockwise"></i> Atualizando';
  }

  const finalizar = () => {
    if (!btn) return;

    btn.disabled = false;
    btn.classList.remove('is-refreshing');
    btn.innerHTML = labelOriginal;
  };

  const atualizarIndicadores = () => {
    try {

      if (
        typeof window._atualizarBadge === 'function'
      ) {
        window._atualizarBadge();
      }

      if (
        typeof window._atualizarBadges === 'function'
      ) {
        window._atualizarBadges();
      }

    } catch (err) {
      console.warn(
        '[Atualizar] Indicadores nao atualizados:',
        err
      );
    }
  };

  try {

    _load();

    const result = acao();

    if (
      result &&
      typeof result.then === 'function'
    ) {

      result
        .then(() => {
          atualizarIndicadores();
          toast(
            'Dados atualizados.',
            'ok'
          );
        })
        .catch(err => {
          console.error(
            '[Atualizar]',
            err
          );

          toast(
            'Nao foi possivel atualizar.',
            'erro'
          );
        })
        .finally(finalizar);

    } else {

      atualizarIndicadores();

      toast(
        'Dados atualizados.',
        'ok'
      );

      setTimeout(
        finalizar,
        220
      );
    }

  } catch (err) {

    console.error(
      '[Atualizar]',
      err
    );

    toast(
      'Nao foi possivel atualizar.',
      'erro'
    );

    finalizar();
  }

  return false;
}


async function loadAllData(force = false) {

  if (!CACHE.loaded || force) {
    _load();
    CACHE.loaded = true;
  }

  // CONEXAO WEB <-> MOBILE:
  // Apos carregar o cache local, sincroniza com o servidor central.
  //
  // 1) sobe o cache local (propaga alteracoes feitas offline);
  // 2) baixa o banco completo (/api/dados) e passa a usa-lo como fonte da
  //    verdade — assim o que foi alterado no MOBILE aparece aqui no WEB.

  await _sincronizarServidor();

  return CACHE;
}


// Inicializacao do sistema
async function initDados(force = false) {
  await loadAllData(force);

  console.log(
    '%c<i class="ph ph-check-circle"></i> storage.js — dados carregados do localStorage',
    'color:#10b981;font-weight:bold'
  );

  return CACHE;
}


// Exporta tudo para o escopo global (window)
Object.assign(window, {

  // Usuarios
  getUsuarios,
  getUsuarioById,
  getUserById,
  getUsersByPerfil,
  getUsuariosByPerfil,

  addUser,
  addUsuario,
  updUser,
  updUsuario,
  delUser,
  delUsuario,

  // Unidades
  getUnidades,
  getUnidadeById,
  addUnidade,
  updUnidade,
  delUnidade,

  // Salas
  getSalas,
  getSalaById,
  getSalasByUnidade,
  addSala,
  updSala,
  updateSala,
  delSala,
  deleteSala,

  // Turmas
  getTurmas,
  getTurmaById,
  addTurma,
  updTurma,
  updateTurma,
  delTurma,
  deleteTurma,

  // Reservas
  getReservas,
  getReservaById,
  addReserva,
  addReservaAsync,
  updReserva,
  delReserva,
  deleteReserva,

  // Chaves
  getChaves,
  getChaveById,
  addChave,
  updChave,
  delChave,
  deleteChave,
  retirarChave,
  retirarChaveAsync,
  devolverChaveApi,
  devolverChaveAsync,

  // Solicitacoes
  getSolics,
  addSolic,
  updSolic,
  updSolicAsync,

  // Notificacoes
  getNotifs,
  getNotifsPara,
  addNotif,
  addNotifAsync,
  countNaoLidas,
  marcarTodasLidas,

  // Override
  getOverride,
  setOverride,

  // Sessao e tema
  getSessao,
  setSessao,
  clearSessao,
  getTema,
  initTema,
  toggleTema,

  // Init
  initDados,
  loadAllData,

  // Utilitarios
  newId,
  hojeISO,
  fmtData,
  formatDate,
  esc,
  escapeHtml,
  iniciais,
  fmtDateTime,
  calcStatus,
  labelStatus,
  htmlStatus,

  // UI
  toast,
  showToast,
  fmsg,
  fmsgHide,
  showMsg,
  hideMsg,
  modalAbrir,
  modalFechar,
  atualizarSecao,

  // CACHE (para leitura de depuracao)
  CACHE
});


console.log(
  '%c<i class="ph ph-check-circle"></i> storage.js carregado — modo localStorage ativo',
  'color:#10b981;font-weight:bold'
);