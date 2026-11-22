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
const emptyData: FixtureData = {
  usuarios: [], unidades: [unit], salas: [], turmas: [], reservas: [], chaves: [], notificacoes: [], solicitacoes: [],
};
const pendingData: FixtureData = {
  ...emptyData,
  solicitacoes: [{
    id: 9001,
    salaId: 1,
    instrutorId: 2,
    unidadeId: 1,
    data: '2026-12-20',
    dataInicio: '2026-12-20',
    dataFim: '2026-12-20',
    turnos: ['Matutino'],
    status: 'pendente',
    criadaEm: '2026-11-21T10:00:00Z',
    motivo: 'fixture',
  }],
};

type MockApiState = { writes: string[]; dataReads: number };

async function prepareApi(
  page: import('@playwright/test').Page,
  useBroadcast: boolean,
  state: MockApiState,
): Promise<{ writes: string[]; reads: () => number }> {
  if (!useBroadcast) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: undefined });
    });
  }
  await page.addInitScript(() => {
    localStorage.setItem('conecta_token', 'fixture-token');
    localStorage.setItem('sn_v6_sessao', JSON.stringify({
      id: 99, nome: 'Coordenador Fixture', email: 'fixture@example.test', perfil: 'coordenador', unidadeId: 1,
    }));
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      state.writes.push(`${request.method()} ${request.url()}`);
      await route.abort();
      return;
    }
    const url = new URL(request.url());
    if (url.pathname === '/api/dados') {
      state.dataReads += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.dataReads > 2 ? pendingData : emptyData),
      });
      return;
    }
    if (url.pathname === '/api/solicitacoes/configuracao-temporal') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          timezone: 'America/Sao_Paulo',
          agora: new Date().toISOString(),
          turnos: {
            matutino: { inicio: '06:00', fim: '12:00' },
            vespertino: { inicio: '12:00', fim: '18:00' },
            noturno: { inicio: '18:00', fim: '23:00' },
          },
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  return { writes: state.writes, reads: () => state.dataReads };
}

async function assertSyncMode(
  page1: import('@playwright/test').Page,
  page2: import('@playwright/test').Page,
  useBroadcast: boolean,
  reads: () => number,
): Promise<void> {
  const mode = useBroadcast ? 'BroadcastChannel' : 'storage fallback';
  await page1.goto('/coordenador.html', { waitUntil: 'networkidle' });
  await page2.goto('/coordenador.html', { waitUntil: 'networkidle' });
  await page2.click('#nav-solicitacoes');
  await expect(page2.locator('#solicCountPendentes')).toHaveText('0');

  if (useBroadcast) {
    await page1.evaluate(() => {
      const channel = new BroadcastChannel('conecta-data-sync-v1');
      channel.postMessage({ type: 'data-updated', sourceId: 'playwright-page-1', eventId: 'playwright-broadcast-1' });
      channel.close();
    });
  } else {
    await page1.evaluate(() => {
      localStorage.setItem('conecta:data-updated', JSON.stringify({
        type: 'data-updated', sourceId: 'playwright-page-1', eventId: 'playwright-storage-1',
      }));
    });
  }

  await expect(page2.locator('#solicCountPendentes')).toHaveText('1');
  const readsBeforeManual = reads();
  await page2.click('[data-action="atualizarSecao"][data-arg="rdSolics"]');
  await expect(page2.locator('#solicCountPendentes')).toHaveText('1');
  expect(mode).toBeTruthy();
  expect(reads()).toBeGreaterThan(readsBeforeManual);
}

test.describe('sincronizacao de solicitacoes sem escritas', () => {
  test('atualiza duas paginas via BroadcastChannel e preserva o botao manual', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const state = { writes: [], dataReads: 0 } satisfies MockApiState;
    const api1 = await prepareApi(page1, true, state);
    const api2 = await prepareApi(page2, true, state);
    await assertSyncMode(page1, page2, true, api2.reads);
    expect(api1.writes).toEqual([]);
    expect(api2.writes).toEqual([]);
    expect(api1.reads()).toBeGreaterThanOrEqual(4);
    await context.close();
  });

  test('atualiza duas paginas via fallback storage e bloqueia escritas', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const state = { writes: [], dataReads: 0 } satisfies MockApiState;
    const api1 = await prepareApi(page1, false, state);
    const api2 = await prepareApi(page2, false, state);
    await assertSyncMode(page1, page2, false, api2.reads);
    expect(api1.writes).toEqual([]);
    expect(api2.writes).toEqual([]);
    expect(api1.reads()).toBeGreaterThanOrEqual(4);
    await context.close();
  });
});
