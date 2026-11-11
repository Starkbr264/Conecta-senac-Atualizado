// Monitor de health pos-deploy da API Conecta-Senac (sem dependencias).
//
// Uso (verificacao):
//   node scripts/monitor/check-health.mjs
//     env: MONITOR_URL, MONITOR_TIMEOUT_MS, MONITOR_ATTEMPTS, MONITOR_GAP_MS,
//          MONITOR_RESULT_FILE (padrao: <tmp>/conecta-health-result.json)
//     sai com codigo 0 se UP, 1 caso contrario; sempre grava o JSON do resultado.
//
// Uso (modos auxiliares usados pelo GitHub Actions):
//   --resumo   -> imprime/atualiza o markdown do resultado (GITHUB_STEP_SUMMARY)
//   --decidir  -> imprime a acao de notificacao: criar|atualizar|recuperar|nenhuma
//   --corpo    -> imprime o markdown usado como corpo da issue
//
// Classificacao (requisitos 2 e 3):
//   UP         -> HTTP 200 + JSON valido + campo status === "UP"
//   UNAVAILABLE-> HTTP != 200 ou falha de conexao (indisponibilidade)
//   TIMEOUT    -> tempo esgotado (AbortSignal.timeout / AbortError)
//   UNEXPECTED -> HTTP 200 mas corpo inesperado (nao-JSON, sem status, status != UP)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const URL_PADRAO = 'https://conecta-senac-test.onrender.com/health';
export const RESULTADO_PADRAO = path.join(os.tmpdir(), 'conecta-health-result.json');

// --------------------------------------------------------------------------
// Classificacao da resposta HTTP
// --------------------------------------------------------------------------
export function classifyResponse(httpStatus, bodyText) {
  if (httpStatus !== 200) {
    const corpo = String(bodyText ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
    return {
      resultado: 'UNAVAILABLE',
      detalhe: corpo ? `HTTP ${httpStatus} — ${corpo}` : `HTTP ${httpStatus}`,
    };
  }
  const texto = bodyText ?? '';
  let parsed;
  try {
    parsed = JSON.parse(texto);
  } catch {
    return { resultado: 'UNEXPECTED', detalhe: 'corpo da resposta nao e JSON valido' };
  }
  if (parsed === null || typeof parsed !== 'object' || !('status' in parsed)) {
    return { resultado: 'UNEXPECTED', detalhe: 'JSON sem o campo "status"' };
  }
  if (parsed.status !== 'UP') {
    return {
      resultado: 'UNEXPECTED',
      detalhe: `status=${JSON.stringify(parsed.status)} (esperado "UP")`,
    };
  }
  return { resultado: 'UP', detalhe: 'JSON com "status":"UP"' };
}

// --------------------------------------------------------------------------
// Classificacao de erros de transporte (conexao vs timeout)
// --------------------------------------------------------------------------
export function classifyError(err) {
  const nome = err?.name ?? '';
  const msg = err?.message ?? String(err);
  if (nome === 'TimeoutError' || nome === 'AbortError') {
    return { resultado: 'TIMEOUT', detalhe: msg };
  }
  return { resultado: 'UNAVAILABLE', detalhe: msg };
}

// --------------------------------------------------------------------------
// Execucao da verificacao com tentativas (retry) e registro completo
// --------------------------------------------------------------------------
export async function checkHealth({
  url,
  timeoutMs = 120_000,
  attempts = 2,
  gapMs = 15_000,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  if (!url) throw new Error('checkHealth: url obrigatoria');
  const total = Math.max(1, Math.floor(attempts));
  const comecou = Date.now();
  const tentativas = [];
  let ultimo = { resultado: 'UNAVAILABLE', detalhe: 'sem tentativa' };

  for (let n = 1; n <= total; n += 1) {
    const t0 = Date.now();
    let httpStatus = null;
    let c;
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      const body = await res.text();
      httpStatus = res.status;
      c = classifyResponse(res.status, body);
    } catch (err) {
      c = classifyError(err);
    }
    ultimo = c;
    tentativas.push({
      n,
      duracaoMs: Date.now() - t0,
      httpStatus,
      resultado: c.resultado,
      detalhe: c.detalhe,
    });
    if (c.resultado === 'UP') break;
    if (n < total) await sleep(gapMs);
  }

  return {
    url,
    timestamp: new Date().toISOString(),
    timestampLocal: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    resultado: ultimo.resultado,
    duracaoTotalMs: Date.now() - comecou,
    tentativas,
    detalhe: ultimo.detalhe,
  };
}

// --------------------------------------------------------------------------
// Decisao de notificacao (dedup: uma issue aberta por falha)
// --------------------------------------------------------------------------
export function decidirNotificacao(resultado, issueAberta) {
  const aberta = issueAberta !== null && issueAberta !== undefined && issueAberta !== '';
  if (resultado === 'UP') return aberta ? 'recuperar' : 'nenhuma';
  return aberta ? 'atualizar' : 'criar';
}

// --------------------------------------------------------------------------
// Registro legivel (resumo do job e corpo da issue)
// --------------------------------------------------------------------------
export function gerarMarkdown(result, { runUrl } = {}) {
  const linhas = [
    '### Monitoramento da API — ' + result.resultado,
    '',
    `- **URL:** ${result.url}`,
    `- **Data/horário (UTC):** ${result.timestamp}`,
    `- **Horário local (Brasília):** ${result.timestampLocal}`,
    `- **Duração total:** ${result.duracaoTotalMs} ms`,
    `- **Detalhe:** ${result.detalhe}`,
    '',
    '| # | Duração (ms) | HTTP | Resultado | Detalhe |',
    '|---|---|---|---|---|',
  ];
  for (const t of result.tentativas) {
    linhas.push(
      `| ${t.n} | ${t.duracaoMs} | ${t.httpStatus ?? '—'} | ${t.resultado} | ${t.detalhe} |`,
    );
  }
  if (runUrl) {
    linhas.push('', `[Ver esta execução](${runUrl})`);
  }
  return linhas.join('\n');
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------
function arquivoResultado() {
  return process.env.MONITOR_RESULT_FILE || RESULTADO_PADRAO;
}

function lerResultado() {
  const arquivo = arquivoResultado();
  if (!fs.existsSync(arquivo)) {
    console.error(`resultado nao encontrado: ${arquivo}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

async function rodar() {
  const url = process.env.MONITOR_URL || URL_PADRAO;
  const timeoutMs = Number(process.env.MONITOR_TIMEOUT_MS || 120_000);
  const attempts = Number(process.env.MONITOR_ATTEMPTS || 2);
  const gapMs = Number(process.env.MONITOR_GAP_MS || 15_000);

  const result = await checkHealth({ url, timeoutMs, attempts, gapMs });
  const arquivo = arquivoResultado();
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.resultado === 'UP' ? 0 : 1;
}

function modoResumo() {
  const md = gerarMarkdown(lerResultado(), { runUrl: process.env.MONITOR_RUN_URL });
  const destino = process.env.GITHUB_STEP_SUMMARY;
  if (destino) {
    fs.appendFileSync(destino, md + '\n', 'utf8');
    console.log(md);
  } else {
    console.log(md);
  }
}

function modoCorpo() {
  const md = gerarMarkdown(lerResultado(), { runUrl: process.env.MONITOR_RUN_URL });
  console.log('# API indisponível — verificação de `/health`\n\n' + md);
}

function modoDecidir() {
  const result = lerResultado();
  const issue = process.env.MONITOR_ISSUE_ABERTA;
  console.log(decidirNotificacao(result.resultado, issue));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--resumo')) return modoResumo();
  if (args.includes('--corpo')) return modoCorpo();
  if (args.includes('--decidir')) return modoDecidir();
  return rodar();
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
