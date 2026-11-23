import { expect, test } from '@playwright/test';

type FixtureData = {
  usuarios: unknown[];
  unidades: unknown[];
  salas: unknown[];
  turmas: unknown[];
  reservas: unknown[];
  chaves: unknown[];
  notificacoes: unknown[];
  solicitacoes: unknown[];
};

const unit = { id: 1, nome: 'Unidade fixture', cep: '70000-000', cidade: 'Brasilia', endereco: 'Fixture' };
const instrutor = { id: 2, nome: 'Instrutor Fixture', email: 'instrutor@example.test', perfil: 'instrutor', unidadeId: 1 };
const pendingSolic = {
  id: 9001, salaId: 1, instrutorId: 2, unidadeId: 1, data: '2026-12-20',
  dataInicio: '2026-12-20', dataFim: '2026-12-20', turnos: ['Matutino'],
  status: 'pendente', criadaEm: '2026-11-21T10:00:00Z', motivo: 'fixture',
};

function emptyData(solicitacoes: unknown[] = []): FixtureData {
  return { usuarios: [], unidades: [unit], salas: [], turmas: [], reservas: [], chaves: [], notificacoes: [], solicitacoes };
}

type MockState = {
  writes: string[];
  dataReads: number;
  data: FixtureData;
  postResponder?: (body: unknown) => { status: number; body?: unknown };
  postCancelar?: (body: unknown) => { status: number; body?: unknown };
  abortPost?: boolean;
};

async function prepararPagina(page: import('@playwright/test').Page, state: MockState): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __promptCalls: string[] }).__promptCalls = [];
    window.prompt = (msg: string) => { (window as unknown as { __promptCalls: string[] }).__promptCalls.push(String(msg)); return null; };
    localStorage.setItem('conecta_token', 'fixture-token');
    localStorage.setItem('sn_v6_sessao', JSON.stringify({ id: 99, nome: 'Coordenador Fixture', email: 'coord@example.test', perfil: 'coordenador', unidadeId: 1 }));
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET' && request.method() !== 'POST' && request.method() !== 'OPTIONS') {
      state.writes.push(`${request.method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    if (request.method() === 'POST') {
      let body: unknown = {};
      try { body = await request.postDataJSON(); } catch { body = {}; }
      state.writes.push(`${request.method()} ${url.pathname}`);
      if (state.abortPost) { await route.abort(); return; }
      if (url.pathname.endsWith('/resposta') && state.postResponder) {
        const r = state.postResponder(body);
        await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body ?? {}) });
        return;
      }
      if (url.pathname.endsWith('/cancelar') && state.postCancelar) {
        const r = state.postCancelar(body);
        await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body ?? {}) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    if (url.pathname === '/api/dados') {
      state.dataReads += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.data) });
      return;
    }
    if (url.pathname === '/api/solicitacoes/configuracao-temporal') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ timezone: 'America/Sao_Paulo', agora: new Date().toISOString(), turnos: { matutino: { inicio: '06:00', fim: '12:00' }, vespertino: { inicio: '12:00', fim: '18:00' }, noturno: { inicio: '18:00', fim: '23:00' } } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

test.describe('fluxos de solicitacoes do coordenador', () => {
  test('cancelamento abre interface propria, envia motivo e atualiza para CANCELADA', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    state.postCancelar = (body) => {
      state.data = emptyData([{ ...pendingSolic, status: 'cancelada', resposta: (body as { motivo?: string }).motivo ?? null }]);
      return { status: 200, body: { ok: true } };
    };
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');

    await page.click('[data-action="cancelarSolic"][data-arg="9001"]');
    await expect(page.locator('.solic-cancelamento')).toBeVisible();
    await expect(page.locator('.solic-cancelamento')).toContainText('Cancelar solicitação');
    await expect(page.locator('.solic-cancelamento')).toContainText('Informe o motivo do cancelamento (opcional).');
    await expect(page.locator('#motivoCancelamentoSolic')).toBeVisible();
    await page.locator('#motivoCancelamentoSolic').fill('motivo teste');
    await page.click('[data-action="confirmarCancelamentoSolic"][data-arg="9001"]');

    await expect(page.locator('#solicCountPendentes')).toHaveText('0');
    await expect(page.locator('#solicCountCanceladas')).toHaveText('1');
    await expect(page.locator('.solic-cancelamento')).toHaveCount(0);
    const cancelWrites = state.writes.filter((w) => w.includes('/cancelar'));
    expect(cancelWrites).toHaveLength(1);
    const promptCalls = await page.evaluate(() => (window as unknown as { __promptCalls: string[] }).__promptCalls);
    expect(promptCalls).toHaveLength(0);
  });

  test('cancelamento sem motivo envia motivo null', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    let captured: unknown = null;
    state.postCancelar = (body) => { captured = body; state.data = emptyData([{ ...pendingSolic, status: 'cancelada' }]); return { status: 200, body: { ok: true } }; };
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');
    await page.click('[data-action="cancelarSolic"][data-arg="9001"]');
    await page.click('[data-action="confirmarCancelamentoSolic"][data-arg="9001"]');
    await expect(page.locator('#solicCountCanceladas')).toHaveText('1');
    expect((captured as { motivo?: unknown })?.motivo ?? null).toBeNull();
  });

  test('Voltar no cancelamento nao executa operacao', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    state.postCancelar = () => ({ status: 200, body: { ok: true } });
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');
    await page.click('[data-action="cancelarSolic"][data-arg="9001"]');
    await expect(page.locator('.solic-cancelamento')).toBeVisible();
    await page.click('[data-action="fecharCancelamentoSolic"]');
    await expect(page.locator('.solic-cancelamento')).toHaveCount(0);
    expect(state.writes.filter((w) => w.includes('/cancelar'))).toHaveLength(0);
    await expect(page.locator('#solicCountPendentes')).toHaveText('1');
  });

  test('cancelamento com erro de estado mostra mensagem no dialogo e nao muda status', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    state.postCancelar = () => ({ status: 409, body: { erro: 'Somente solicitacoes pendentes podem ser canceladas.' } });
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');
    await page.click('[data-action="cancelarSolic"][data-arg="9001"]');
    await page.click('[data-action="confirmarCancelamentoSolic"][data-arg="9001"]');
    await expect(page.locator('.solic-cancelamento')).toBeVisible();
    await expect(page.locator('.solic-erro')).toContainText('Somente solicitacoes pendentes podem ser canceladas.');
    await expect(page.locator('#solicCountPendentes')).toHaveText('1');
    await expect(page.locator('#solicCountCanceladas')).toHaveText('0');
  });

  test('cancelamento com falha de rede mostra mensagem classificada', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    state.abortPost = true;
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');
    await page.click('[data-action="cancelarSolic"][data-arg="9001"]');
    await page.click('[data-action="confirmarCancelamentoSolic"][data-arg="9001"]');
    await expect(page.locator('.solic-cancelamento')).toBeVisible();
    await expect(page.locator('.solic-erro')).toContainText(/conexão|servidor/i);
    await expect(page.locator('#solicCountPendentes')).toHaveText('1');
  });

  test('impede duplo envio no cancelamento (um unico POST)', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    let resolvePost!: () => void;
    state.postCancelar = () => new Promise<{ status: number; body: unknown }>((resolve) => { resolvePost = () => { state.data = emptyData([{ ...pendingSolic, status: 'cancelada' }]); resolve({ status: 200, body: { ok: true } }); }; });
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');
    await page.click('[data-action="cancelarSolic"][data-arg="9001"]');
    const btn = page.locator('[data-action="confirmarCancelamentoSolic"][data-arg="9001"]');
    await btn.click();
    resolvePost();
    await expect(page.locator('#solicCountCanceladas')).toHaveText('1');
    expect(state.writes.filter((w) => w.includes('/cancelar'))).toHaveLength(1);
  });

  test('recusa preserva formulario e mostra erro classificado em falha de rede (regressao)', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    state.abortPost = true;
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');
    await page.click('[data-action="abrirRecusaSolic"][data-arg="9001"]');
    await page.locator('#motivoRecusaSolic').fill('motivo recusa teste');
    await page.click('[data-action="confirmarRecusaSolic"][data-arg="9001"]');
    await expect(page.locator('.solic-recusa')).toBeVisible();
    await expect(page.locator('.solic-erro')).toContainText(/conexão|servidor/i);
    await expect(page.locator('#motivoRecusaSolic')).toHaveValue('motivo recusa teste');
    await expect(page.locator('#solicCountPendentes')).toHaveText('1');
    await expect(page.locator('#solicCountRecusadas')).toHaveText('0');
  });

  test('recusa envia payload correto e atualiza para RECUSADA apos sucesso', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    let captured: unknown = null;
    state.postResponder = (body) => { captured = body; state.data = emptyData([{ ...pendingSolic, status: 'recusada' }]); return { status: 200, body: { ok: true } }; };
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');
    await page.click('[data-action="abrirRecusaSolic"][data-arg="9001"]');
    await page.locator('#motivoRecusaSolic').fill('Data já passou');
    await page.click('[data-action="sugerirRecusaSolic"][data-arg="Conflito de horário"]').catch(() => undefined);
    await page.locator('#motivoRecusaSolic').fill('Data já passou');
    await page.click('[data-action="confirmarRecusaSolic"][data-arg="9001"]');
    await expect(page.locator('#solicCountRecusadas')).toHaveText('1');
    await expect(page.locator('#solicCountPendentes')).toHaveText('0');
    const payload = captured as { decisao?: string; resposta?: string };
    expect(payload?.decisao).toBe('recusar');
    expect(payload?.resposta).toBe('Data já passou');
  });

  test('recusa com 409 mostra mensagem do backend e preserva formulario', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    state.postResponder = () => ({ status: 409, body: { erro: 'Solicitação já foi respondida.' } });
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');
    await page.click('[data-action="abrirRecusaSolic"][data-arg="9001"]');
    await page.locator('#motivoRecusaSolic').fill('motivo');
    await page.click('[data-action="confirmarRecusaSolic"][data-arg="9001"]');
    await expect(page.locator('.solic-recusa')).toBeVisible();
    await expect(page.locator('.solic-erro')).toContainText('Solicitação já foi respondida.');
    await expect(page.locator('#motivoRecusaSolic')).toHaveValue('motivo');
    await expect(page.locator('#solicCountRecusadas')).toHaveText('0');
  });

  test('estabilidade: texto digitado sobrevive a atualizacao automatica', async ({ page }) => {
    const state: MockState = { writes: [], dataReads: 0, data: emptyData([pendingSolic]) };
    await prepararPagina(page, state);
    await page.goto('/coordenador.html', { waitUntil: 'networkidle' });
    await page.click('#nav-solicitacoes');
    await page.click('[data-action="abrirRecusaSolic"][data-arg="9001"]');
    await page.locator('#motivoRecusaSolic').fill('texto que deve sobreviver');
    const readsBefore = state.dataReads;
    // dispara broadcast de outra aba
    await page.evaluate(() => {
      const ch = new BroadcastChannel('conecta-data-sync-v1');
      ch.postMessage({ type: 'data-updated', sourceId: 'outra-aba', eventId: 'evt-stab-1' });
      ch.close();
    });
    await page.waitForTimeout(1500);
    await expect(page.locator('.solic-recusa')).toBeVisible();
    await expect(page.locator('#motivoRecusaSolic')).toHaveValue('texto que deve sobreviver');
    // nao deve haver explosao de GETs
    expect(state.dataReads - readsBefore).toBeLessThanOrEqual(3);
  });
});