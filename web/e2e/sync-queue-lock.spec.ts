import { expect, test } from '@playwright/test';

async function runLock(page: import('@playwright/test').Page, key: string): Promise<number> {
  return page.evaluate(async (lockKey) => {
    const { withSyncQueueLock } = await import('/src/core/storage.ts');
    return withSyncQueueLock(async () => {
      const active = Number(localStorage.getItem(`${lockKey}:active`) ?? '0') + 1;
      const max = Math.max(Number(localStorage.getItem(`${lockKey}:max`) ?? '0'), active);
      localStorage.setItem(`${lockKey}:active`, String(active));
      localStorage.setItem(`${lockKey}:max`, String(max));
      await new Promise((resolve) => setTimeout(resolve, 180));
      localStorage.setItem(`${lockKey}:active`, String(active - 1));
      return max;
    });
  }, key);
}

async function openOrigin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
}

test.describe('lock da fila de sincronização', () => {
  test('serializa duas páginas com Web Locks', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const key = `pw-web-lock-${Date.now()}`;
    await Promise.all([openOrigin(page1), openOrigin(page2)]);

    const [max1, max2] = await Promise.all([
      runLock(page1, key),
      runLock(page2, key),
    ]);

    expect(Math.max(max1, max2)).toBe(1);
    await context.close();
  });

  test('fallback usa lease expirável e libera apenas seu próprio owner', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const page2 = await context.newPage();
    const disableWebLocks = () => {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: undefined,
      });
    };
    await page.addInitScript(disableWebLocks);
    await page2.addInitScript(disableWebLocks);
    await openOrigin(page);
    await openOrigin(page2);
    const key = `pw-fallback-lock-${Date.now()}`;

    await page.evaluate((lockKey) => {
      localStorage.setItem('sn_v6_sync_lock', JSON.stringify({
        owner: 'aba-abandonada',
        expires: Date.now() - 1,
      }));
      localStorage.removeItem(`${lockKey}:active`);
      localStorage.removeItem(`${lockKey}:max`);
    }, key);

    await Promise.all([runLock(page, key), runLock(page2, key)]);

    expect(await page.evaluate(() => localStorage.getItem('sn_v6_sync_lock'))).toBeNull();

    const renewal = page.evaluate(async () => {
      const { withSyncQueueLock } = await import('/src/core/storage.ts');
      return withSyncQueueLock(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5_500));
        return true;
      });
    });
    await page.waitForTimeout(5_200);
    const lease = await page.evaluate(() => JSON.parse(
      localStorage.getItem('sn_v6_sync_lock') ?? '{}',
    ) as { owner?: string; expires?: number });
    expect(lease.owner).toBeTruthy();
    expect((lease.expires ?? 0) - Date.now()).toBeGreaterThan(8_000);
    await renewal;
    expect(await page.evaluate(() => localStorage.getItem('sn_v6_sync_lock'))).toBeNull();

    const conditionalRelease = page.evaluate(async () => {
      const { withSyncQueueLock } = await import('/src/core/storage.ts');
      return withSyncQueueLock(async () => {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return true;
      });
    });
    await page.waitForTimeout(40);
    await page2.evaluate(() => {
      localStorage.setItem('sn_v6_sync_lock', JSON.stringify({
        owner: 'outra-aba',
        expires: Date.now() + 10_000,
      }));
    });
    await conditionalRelease;
    expect(await page.evaluate(() => JSON.parse(
      localStorage.getItem('sn_v6_sync_lock') ?? '{}',
    ).owner)).toBe('outra-aba');
    await page.evaluate(() => localStorage.removeItem('sn_v6_sync_lock'));
    await context.close();
  });
});
