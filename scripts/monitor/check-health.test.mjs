// Testes do monitor de health pos-deploy (node:test, sem dependencias).
// Rode com: node --test scripts/monitor/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyResponse,
  classifyError,
  checkHealth,
  decidirNotificacao,
  gerarMarkdown,
} from './check-health.mjs';

// ---------------------------------------------------------------
// classifyResponse — validacao de corpo/HTTP (requisitos 2 e 3)
// ---------------------------------------------------------------
test('UP: HTTP 200 com JSON {"status":"UP"}', () => {
  const r = classifyResponse(200, '{"status":"UP"}');
  assert.equal(r.resultado, 'UP');
});

test('inesperada: 200 mas status vem DOWN', () => {
  const r = classifyResponse(200, '{"status":"DOWN"}');
  assert.equal(r.resultado, 'UNEXPECTED');
  assert.match(r.detalhe, /DOWN/);
});

test('inesperada: 200 sem o campo status', () => {
  const r = classifyResponse(200, '{"outra_chave":1}');
  assert.equal(r.resultado, 'UNEXPECTED');
  assert.match(r.detalhe, /status/);
});

test('inesperada: 200 com corpo que nao e JSON', () => {
  const r = classifyResponse(200, '<html>ola</html>');
  assert.equal(r.resultado, 'UNEXPECTED');
});

test('inesperada: 200 com corpo vazio', () => {
  const r = classifyResponse(200, '');
  assert.equal(r.resultado, 'UNEXPECTED');
});

test('indisponivel: HTTP 503', () => {
  const r = classifyResponse(503, 'Service Unavailable');
  assert.equal(r.resultado, 'UNAVAILABLE');
  assert.match(r.detalhe, /503/);
});

test('indisponivel: HTTP 404 (endpoint fora do ar/nao publicado)', () => {
  const r = classifyResponse(404, 'nao encontrado');
  assert.equal(r.resultado, 'UNAVAILABLE');
  assert.match(r.detalhe, /404/);
});

// ---------------------------------------------------------------
// classifyError — timeout vs indisponibilidade de conexao
// ---------------------------------------------------------------
test('timeout: erro com name TimeoutError', () => {
  const err = new Error('The operation was aborted due to timeout');
  err.name = 'TimeoutError';
  assert.equal(classifyError(err).resultado, 'TIMEOUT');
});

test('timeout: erro com name AbortError', () => {
  const err = new Error('This operation was aborted');
  err.name = 'AbortError';
  assert.equal(classifyError(err).resultado, 'TIMEOUT');
});

test('indisponivel: erro de conexao (ECONNREFUSED)', () => {
  const err = new Error('connect ECONNREFUSED 1.2.3.4:443');
  assert.equal(classifyError(err).resultado, 'UNAVAILABLE');
  assert.match(classifyError(err).detalhe, /ECONNREFUSED/);
});

// ---------------------------------------------------------------
// checkHealth — tentativas, retry, duracao e registro (reqs 1, 3, 4)
// ---------------------------------------------------------------
function fakeFetch(sequencia) {
  let i = 0;
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const passo = sequencia[Math.min(i, sequencia.length - 1)];
    i += 1;
    if (passo.erro) throw passo.erro;
    return { status: passo.status, text: async () => passo.body };
  };
  fn.calls = calls;
  return fn;
}

const semEspera = async () => {};

test('checkHealth: UP na 1a tentativa nao repete a chamada', async () => {
  const f = fakeFetch([{ status: 200, body: '{"status":"UP"}' }]);
  const r = await checkHealth({
    url: 'https://exemplo/health',
    fetchImpl: f,
    sleep: semEspera,
    gapMs: 0,
  });
  assert.equal(r.resultado, 'UP');
  assert.equal(r.tentativas.length, 1);
  assert.equal(f.calls.length, 1);
  assert.equal(r.url, 'https://exemplo/health');
  assert.match(r.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof r.timestampLocal, 'string');
  assert.ok(Number.isFinite(r.duracaoTotalMs));
  assert.equal(r.detalhe, r.tentativas[0].detalhe);
});

test('checkHealth: falha transitoria repete e termina UP', async () => {
  const f = fakeFetch([
    { status: 503, body: '' },
    { status: 200, body: '{"status":"UP"}' },
  ]);
  const r = await checkHealth({
    url: 'u',
    fetchImpl: f,
    sleep: semEspera,
    gapMs: 0,
  });
  assert.equal(r.resultado, 'UP');
  assert.equal(r.tentativas.length, 2);
  assert.equal(r.tentativas[0].resultado, 'UNAVAILABLE');
  assert.equal(f.calls.length, 2);
});

test('checkHealth: timeout na 1a tentativa, UP na 2a', async () => {
  const timeoutErr = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
  const f = fakeFetch([{ erro: timeoutErr }, { status: 200, body: '{"status":"UP"}' }]);
  const r = await checkHealth({
    url: 'u',
    fetchImpl: f,
    sleep: semEspera,
    gapMs: 0,
  });
  assert.equal(r.resultado, 'UP');
  assert.equal(r.tentativas[0].resultado, 'TIMEOUT');
  assert.equal(r.tentativas[1].resultado, 'UP');
});

test('checkHealth: falha persistente usa todas as tentativas', async () => {
  const f = fakeFetch([{ status: 500, body: 'boom' }]);
  const r = await checkHealth({
    url: 'u',
    fetchImpl: f,
    sleep: semEspera,
    gapMs: 0,
    attempts: 3,
  });
  assert.equal(r.resultado, 'UNAVAILABLE');
  assert.equal(r.tentativas.length, 3);
  assert.equal(f.calls.length, 3);
  assert.equal(r.duracaoTotalMs >= 0, true);
});

test('checkHealth: cada tentativa registra n, duracao, httpStatus e resultado', async () => {
  const f = fakeFetch([
    { status: 500, body: 'erro' },
    { status: 200, body: '{"status":"UP"}' },
  ]);
  const r = await checkHealth({ url: 'u', fetchImpl: f, sleep: semEspera, gapMs: 0 });
  for (const [idx, t] of r.tentativas.entries()) {
    assert.equal(t.n, idx + 1);
    assert.ok(Number.isFinite(t.duracaoMs));
    assert.ok(['UP', 'UNAVAILABLE', 'TIMEOUT', 'UNEXPECTED'].includes(t.resultado));
    assert.equal(typeof t.detalhe, 'string');
  }
  assert.equal(r.tentativas[0].httpStatus, 500);
  assert.equal(r.tentativas[1].httpStatus, 200);
});

// ---------------------------------------------------------------
// decidirNotificacao — matriz de notificacao com dedup (reqs 5 e 6)
// ---------------------------------------------------------------
test('decisao: UP e nenhuma issue aberta -> nenhuma acao', () => {
  assert.equal(decidirNotificacao('UP', null), 'nenhuma');
});

test('decisao: UP e issue aberta -> recuperar (comentar e fechar)', () => {
  assert.equal(decidirNotificacao('UP', 42), 'recuperar');
});

test('decisao: falha e nenhuma issue aberta -> criar issue (1a notificacao)', () => {
  assert.equal(decidirNotificacao('UNAVAILABLE', null), 'criar');
  assert.equal(decidirNotificacao('TIMEOUT', undefined), 'criar');
});

test('decisao: falha e issue ja aberta -> atualizar em silencio (sem notificar de novo)', () => {
  assert.equal(decidirNotificacao('UNAVAILABLE', 7), 'atualizar');
  assert.equal(decidirNotificacao('UNEXPECTED', 7), 'atualizar');
  assert.equal(decidirNotificacao('TIMEOUT', 7), 'atualizar');
});

// ---------------------------------------------------------------
// gerarMarkdown — registro legivel (req 4)
// ---------------------------------------------------------------
test('markdown: contem resultado, data/horario, duracao e tabela de tentativas', () => {
  const md = gerarMarkdown(
    {
      url: 'https://x/health',
      timestamp: '2026-11-10T20:00:00.000Z',
      timestampLocal: '10/11/2026 17:00:00',
      resultado: 'UNAVAILABLE',
      duracaoTotalMs: 1234,
      detalhe: 'HTTP 503',
      tentativas: [
        { n: 1, duracaoMs: 600, httpStatus: 503, resultado: 'UNAVAILABLE', detalhe: 'HTTP 503' },
        { n: 2, duracaoMs: 634, httpStatus: 503, resultado: 'UNAVAILABLE', detalhe: 'HTTP 503' },
      ],
    },
    { runUrl: 'https://github.com/o/r/actions/runs/1' },
  );
  assert.match(md, /UNAVAILABLE/);
  assert.match(md, /2026-11-10T20:00:00\.000Z/);
  assert.match(md, /17:00:00/);
  assert.match(md, /1234/);
  assert.match(md, /\|\s*1\s*\|/);
  assert.match(md, /actions\/runs\/1/);
});

// ---------------------------------------------------------------
// CLI — os modos usados pelo GitHub Actions precisam sair com exit 0
// ---------------------------------------------------------------
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs2 from 'node:fs';
import os2 from 'node:os';
import path2 from 'node:path';

const SCRIPT = fileURLToPath(new URL('./check-health.mjs', import.meta.url));

function rodarCli(args, envExtra = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...envExtra },
  });
}

function arquivoTemporario(prefixo) {
  const dir = fs2.mkdtempSync(path2.join(os2.tmpdir(), prefixo));
  return path2.join(dir, 'resultado.json');
}

test('CLI: --decidir com UP e sem issue imprime "nenhuma" e sai 0', () => {
  const arquivo = arquivoTemporario('mon-cli-');
  fs2.writeFileSync(arquivo, JSON.stringify({ resultado: 'UP', tentativas: [] }));
  const r = rodarCli(['--decidir'], { MONITOR_RESULT_FILE: arquivo, MONITOR_ISSUE_ABERTA: '' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'nenhuma');
});

test('CLI: --decidir com falha e issue aberta imprime "atualizar" e sai 0', () => {
  const arquivo = arquivoTemporario('mon-cli-');
  fs2.writeFileSync(arquivo, JSON.stringify({ resultado: 'TIMEOUT', tentativas: [] }));
  const r = rodarCli(['--decidir'], { MONITOR_RESULT_FILE: arquivo, MONITOR_ISSUE_ABERTA: '3' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'atualizar');
});

test('CLI: --resumo imprime o markdown e sai 0', () => {
  const arquivo = arquivoTemporario('mon-cli-');
  fs2.writeFileSync(
    arquivo,
    JSON.stringify({
      url: 'u',
      timestamp: '2026-11-10T00:00:00.000Z',
      timestampLocal: '10/11/2026 00:00:00',
      resultado: 'UP',
      duracaoTotalMs: 1,
      detalhe: 'ok',
      tentativas: [{ n: 1, duracaoMs: 1, httpStatus: 200, resultado: 'UP', detalhe: 'ok' }],
    }),
  );
  const r = rodarCli(['--resumo'], { MONITOR_RESULT_FILE: arquivo });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /### Monitoramento da API — UP/);
  assert.match(r.stdout, /\|\s*1\s*\|/);
});

test('CLI: verificacao com falha grava o resultado e sai com exit 1', () => {
  const arquivo = arquivoTemporario('mon-cli-');
  const r = rodarCli([], {
    MONITOR_URL: 'http://127.0.0.1:9/health',
    MONITOR_ATTEMPTS: '1',
    MONITOR_GAP_MS: '0',
    MONITOR_RESULT_FILE: arquivo,
  });
  assert.equal(r.status, 1, r.stderr);
  const result = JSON.parse(fs2.readFileSync(arquivo, 'utf8'));
  assert.equal(result.resultado, 'UNAVAILABLE');
  assert.equal(result.tentativas.length, 1);
});
