/*
 * server/index.js
 * Servidor central — fonte da verdade compartilhada entre WEB e MOBILE.
 *
 * O que ele faz:
 *   1. Serve o web (frontend_reserva_salas/) como arquivos estaticos.
 *   2. Expoe a API REST /api/* usada pelo mobile:
 *        GET    /api/dados           -> retorna todos os dados (banco completo)
 *        POST   /api/sinc           -> sincroniza alteracoes locais com o servidor
 *        POST   /api/login           -> valida email/senha e retorna o usuario
 *        GET/SET/DEL /api/sessao     -> sessao ativa para o browser web
 *        POST   /api/logout          -> encerra a sessao
 *        POST   /api/reset           -> recarrega os dados de exemplo
 *   3. Persiste tudo em server/data/db.json.
 *
 * Banco de dados: Node nativo (http, fs, path) — sem dependencias externas.
 * Porta padrao: 3333 (configuravel via env PORT).
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3333;
const WEB_ROOT = path.join(__dirname, '..', 'frontend_reserva_salas');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const seed = require('./seed');

// ---------------------------------------------------------------------------
// Camada de persistencia
// ---------------------------------------------------------------------------

// Carrega o banco do disco; se nao existir, cria a partir do seed.
function carregarBanco() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
    return structuredClone(seed);
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('[server] db.json corrompido, recriando a partir do seed:', err.message);
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
    return structuredClone(seed);
  }
}

let banco = carregarBanco();

// Persiste o banco em disco (gravacao atomica via arquivo temporario)
function salvarBanco() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(banco, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Proximo id livre de uma lista (evita colisao com ids existentes)
function proximoId(lista) {
  return lista.reduce((mx, item) => Math.max(mx, Number(item.id) || 0), 0) + 1;
}

// Le o corpo JSON de uma requisicao
function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (chunk) => { dados += chunk; });
    req.on('end', () => {
      if (!dados) return resolve({});
      try { resolve(JSON.parse(dados)); } catch (err) { reject(new Error('JSON invalido')); }
    });
    req.on('error', reject);
  });
}

// Resposta JSON padrao
function json(res, status, corpo) {
  const payload = JSON.stringify(corpo ?? {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// Rotas da API REST
// ---------------------------------------------------------------------------

async function rotearApi(req, res, url, metodo) {
  // CORS preflight
  if (metodo === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // GET /api/dados -> banco completo (usado pelo mobile ao iniciar)
  if (url.pathname === '/api/dados' && metodo === 'GET') {
    return json(res, 200, banco);
  }

  // POST /api/sinc -> aplica alteracoes locais do cliente (web/mobile).
  // O corpo envia:
  //   { alteracoes: { colecao: [registros alterados/atualizados] } }
  //   { criados:   { colecao: [registros NOVOS — ids provisorios] } }
  //   { remocoes:   { colecao: [ids removidos no cliente] } }
  // O servidor:
  //   1) cria registros novos com id oficial (proximoId) e devolve o
  //      mapeamento antigo -> novo em `idsNovos`;
  //   2) faz merge por id (upsert) dos registros alterados;
  //   3) remove os ids informados.
  // Assim um cliente com cache desatualizado NUNCA sobrescreve um registro
  // do servidor usando um id que ele inventou.
  if (url.pathname === '/api/sinc' && metodo === 'POST') {
    const corpo = await lerCorpo(req);
    const alterado = corpo?.alteracoes || {};
    const criados = corpo?.criados || {};
    const remocoes = corpo?.remocoes || {};
    const colecoes = ['usuarios', 'unidades', 'salas', 'turmas', 'reservas', 'chaves', 'notificacoes', 'solicitacoes'];
    let mudou = false;
    const mapaIdsNovos = {}; // { colecao: { idProvisorio: idOficial } }

    // 1) Cria registros NOVOS (que o servidor ainda nao conhece).
    for (const chave of colecoes) {
      const itens = criados[chave];
      if (!Array.isArray(itens)) continue;
      for (const item of itens) {
        if (!item || item.id == null) continue;
        // Ja existe? Nao duplica (o servidor mantem o registro oficial).
        const jaExiste = banco[chave].some(x => Number(x.id) === Number(item.id));
        if (jaExiste) continue;
        const novoId = proximoId(banco[chave]);
        const { id: _, ...semId } = item;
        banco[chave].push({ ...semId, id: novoId });
        if (!mapaIdsNovos[chave]) mapaIdsNovos[chave] = {};
        mapaIdsNovos[chave][Number(item.id)] = novoId;
        mudou = true;
      }
    }

    // 2) Upsert de registros que o cliente ALTEROU (mesmo id oficial) +
    //    remocoes de ids apagados no cliente.
    for (const chave of colecoes) {
      const itens = alterado[chave];
      if (Array.isArray(itens)) {
        for (const item of itens) {
          if (!item || item.id == null) continue;
          const idx = banco[chave].findIndex(x => Number(x.id) === Number(item.id));
          if (idx >= 0) {
            banco[chave][idx] = { ...banco[chave][idx], ...item };
          } else {
            banco[chave].push(item);
          }
        }
        mudou = mudou || itens.length > 0;
      }

      const ids = remocoes[chave];
      if (Array.isArray(ids) && ids.length) {
        const antes = banco[chave].length;
        banco[chave] = banco[chave].filter(
          x => !ids.some(id => Number(id) === Number(x.id))
        );
        mudou = mudou || banco[chave].length !== antes;
      }
    }

    if (mudou) salvarBanco();
    // Devolve o banco completo + mapeamento de ids provisorios -> oficiais,
    // para o cliente corrigir suas referencias locais.
    return json(res, 200, { ok: true, banco, idsNovos: mapaIdsNovos });
  }

  // POST /api/login -> valida credenciais (mesma logica do web)
  if (url.pathname === '/api/login' && metodo === 'POST') {
    const { email, senha } = await lerCorpo(req);
    const usuario = banco.usuarios.find(u =>
      String(u.email || '').toLowerCase() === String(email || '').toLowerCase() &&
      u.senha === senha
    );
    if (!usuario) return json(res, 401, { erro: 'E-mail ou senha incorretos.' });
    // Nunca devolve a senha para o cliente
    const { senha: _, ...publico } = usuario;
    return json(res, 200, { usuario: publico });
  }

  // GET /api/sessao -> sessao ativa do browser web
  if (url.pathname === '/api/sessao' && metodo === 'GET') {
    return json(res, 200, banco.sessao || null);
  }

  // POST /api/sessao -> grava a sessao do web
  if (url.pathname === '/api/sessao' && metodo === 'POST') {
    const corpo = await lerCorpo(req);
    banco.sessao = corpo.sessao || null;
    salvarBanco();
    return json(res, 200, { ok: true });
  }

  // POST /api/logout -> limpa a sessao do web
  if (url.pathname === '/api/logout' && metodo === 'POST') {
    banco.sessao = null;
    salvarBanco();
    return json(res, 200, { ok: true });
  }

  // POST /api/reset -> recarrega os dados de exemplo
  if (url.pathname === '/api/reset' && metodo === 'POST') {
    banco = {
      ...structuredClone(seed),
      sessao: null,
      ultimaSinc: banco.ultimaSinc || null,
    };
    salvarBanco();
    return json(res, 200, { ok: true, banco });
  }

  // Rotas genericas de CRUD: /api/<colecao> e /api/<colecao>/<id>
  const partes = url.pathname.split('/').filter(Boolean); // ex: ['api', 'salas', '5']
  if (partes.length >= 2 && partes[0] === 'api' && Array.isArray(banco[partes[1]])) {
    const colecao = partes[1];
    const lista = banco[colecao];

    // GET /api/<colecao> -> lista todos
    if (partes.length === 2 && metodo === 'GET') {
      return json(res, 200, lista);
    }

    // GET /api/<colecao>/<id> -> um registro
    if (partes.length === 3 && metodo === 'GET') {
      const item = lista.find(x => String(x.id) === partes[2]);
      if (!item) return json(res, 404, { erro: 'Nao encontrado.' });
      return json(res, 200, item);
    }

    // POST /api/<colecao> -> cria registro
    if (partes.length === 2 && metodo === 'POST') {
      const corpo = await lerCorpo(req);
      const item = { ...corpo, id: proximoId(lista) };
      banco[colecao].push(item);
      salvarBanco();
      return json(res, 201, item);
    }

    // PUT /api/<colecao>/<id> -> atualiza registro
    if (partes.length === 3 && metodo === 'PUT') {
      const idx = lista.findIndex(x => String(x.id) === partes[2]);
      if (idx < 0) return json(res, 404, { erro: 'Nao encontrado.' });
      const corpo = await lerCorpo(req);
      banco[colecao][idx] = { ...banco[colecao][idx], ...corpo, id: Number(partes[2]) };
      salvarBanco();
      return json(res, 200, banco[colecao][idx]);
    }

    // DELETE /api/<colecao>/<id> -> remove registro
    if (partes.length === 3 && metodo === 'DELETE') {
      const antes = banco[colecao].length;
      banco[colecao] = banco[colecao].filter(x => String(x.id) !== partes[2]);
      if (banco[colecao].length === antes) return json(res, 404, { erro: 'Nao encontrado.' });
      salvarBanco();
      return json(res, 200, { ok: true });
    }
  }

  return json(res, 404, { erro: 'Rota nao encontrada.' });
}

// ---------------------------------------------------------------------------
// Servidor estatico do web (frontend_reserva_salas)
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// Evita path traversal: resolve o caminho e garante que fique dentro do web root
function caminhoSeguro(urlPath) {
  const decodificado = decodeURIComponent(urlPath);
  const resolvido = path.normalize(path.join(WEB_ROOT, decodificado));
  if (resolvido !== WEB_ROOT && !resolvido.startsWith(WEB_ROOT + path.sep)) {
    return null;
  }
  return resolvido;
}

function servirArquivo(res, caminho) {
  fs.stat(caminho, (err, stat) => {
    if (err || !stat.isFile()) {
      // Se nao existe, tenta o index.html (roteamento SPA simples)
      const idx = path.join(WEB_ROOT, 'index.html');
      fs.readFile(idx, (err2, conteudo) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('404 - Nao encontrado');
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(conteudo);
      });
      return;
    }
    const ext = path.extname(caminho).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(caminho).pipe(res);
  });
}

// ---------------------------------------------------------------------------
// Bootstrap do servidor
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const metodo = req.method || 'GET';

  try {
    // Requisicoes da API REST
    if (url.pathname.startsWith('/api/')) {
      return await rotearApi(req, res, url, metodo);
    }

    // Requisicoes de arquivos estaticos do web
    const caminho = caminhoSeguro(url.pathname === '/' ? '/index.html' : url.pathname);
    if (!caminho) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 - Acesso negado');
    }
    return servirArquivo(res, caminho);
  } catch (err) {
    console.error('[server] Erro:', err.message);
    if (!res.headersSent) {
      json(res, 500, { erro: 'Erro interno no servidor.' });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==========================================================');
  console.log('  SENAC Reservas — Servidor central ativo');
  console.log(`  Web (browser):      http://localhost:${PORT}`);
  console.log(`  API (mobile):       http://localhost:${PORT}/api/dados`);
  console.log('  Banco:              server/data/db.json');
  console.log('==========================================================');
});

module.exports = server;
