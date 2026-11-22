import { describe, expect, it, vi } from 'vitest';
import { createDataSyncController, createReadVersionGuard, type DataSyncChannel } from './data-sync';

class FakeChannel implements DataSyncChannel {
  private readonly listeners = new Set<(event: { data: unknown }) => void>();
  readonly sent: unknown[] = [];
  closed = false;

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  addEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
    this.listeners.delete(listener);
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
  }

  receive(data: unknown): void {
    this.listeners.forEach((listener) => listener({ data }));
  }
}

describe('atualizacao de dados entre abas', () => {
  it('descarta resposta iniciada antes de uma mutacao confirmada', () => {
    const guard = createReadVersionGuard();
    const readVersion = guard.beginRead();
    let cache = 'estado-recente';

    guard.invalidate();
    if (guard.isCurrent(readVersion)) cache = 'resposta-antiga';

    expect(cache).toBe('estado-recente');
    expect(guard.isCurrent(guard.beginRead())).toBe(true);
  });

  it('sincroniza uma vez quando recebe notificacoes duplicadas do canal e do storage', async () => {
    const channel = new FakeChannel();
    const storageListeners: Array<(event: { key: string | null; newValue: string | null }) => void> = [];
    const sync = vi.fn().mockResolvedValue(undefined);
    const updated = vi.fn();
    const controller = createDataSyncController({
      channel,
      sync,
      onUpdated: updated,
      isVisible: () => true,
      subscribeStorage: (listener) => {
        storageListeners.push(listener);
        return () => storageListeners.splice(storageListeners.indexOf(listener), 1);
      },
      scheduleTask: (task) => task(),
    });

    controller.start();
    channel.receive({ type: 'data-updated', sourceId: 'other-tab', eventId: 'same-event' });
    storageListeners[0]({ key: 'conecta:data-updated', newValue: '{"type":"data-updated","sourceId":"other-tab","eventId":"same-event"}' });
    await Promise.resolve();

    expect(sync).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('nao inicia sincronizacao concorrente e executa uma pendente depois da atual', async () => {
    const channel = new FakeChannel();
    let resolveSync!: () => void;
    const sync = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveSync = resolve; }));
    const controller = createDataSyncController({
      channel,
      sync,
      onUpdated: vi.fn(),
      isVisible: () => true,
      subscribeStorage: () => () => undefined,
      scheduleTask: (task) => task(),
    });

    controller.start();
    channel.receive({ type: 'data-updated', sourceId: 'one', eventId: 'one-event' });
    channel.receive({ type: 'data-updated', sourceId: 'two', eventId: 'two-event' });
    expect(sync).toHaveBeenCalledTimes(1);
    resolveSync();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(sync).toHaveBeenCalledTimes(2);
    controller.stop();
  });

  it('ignora a propria notificacao e nao sincroniza polling com a aba oculta', async () => {
    const channel = new FakeChannel();
    let poll!: () => void;
    let visible = false;
    const sync = vi.fn().mockResolvedValue(undefined);
    const controller = createDataSyncController({
      channel,
      sync,
      onUpdated: vi.fn(),
      isVisible: () => visible,
      subscribeStorage: () => () => undefined,
      setIntervalTask: (task) => { poll = task; return 1; },
      clearIntervalTask: vi.fn(),
    });

    controller.start();
    channel.receive({ type: 'data-updated', sourceId: controller.sourceId });
    poll();
    expect(sync).not.toHaveBeenCalled();
    visible = true;
    poll();
    await Promise.resolve();
    expect(sync).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('preserva a tela quando a consulta remota falha', async () => {
    const channel = new FakeChannel();
    const sync = vi.fn().mockRejectedValue(new Error('offline'));
    const updated = vi.fn();
    const controller = createDataSyncController({
      channel,
      sync,
      onUpdated: updated,
      isVisible: () => true,
      subscribeStorage: () => () => undefined,
      scheduleTask: (task) => task(),
    });

    controller.start();
    channel.receive({ type: 'data-updated', sourceId: 'other', eventId: 'offline-event' });
    await Promise.resolve();
    await Promise.resolve();

    expect(sync).toHaveBeenCalledTimes(1);
    expect(updated).not.toHaveBeenCalled();
    controller.stop();
  });

  it('invalida uma leitura em andamento ao receber aviso de outra aba', async () => {
    const channel = new FakeChannel();
    const invalidate = vi.fn();
    const controller = createDataSyncController({
      channel,
      sync: vi.fn().mockResolvedValue(undefined),
      onUpdated: vi.fn(),
      onInvalidated: invalidate,
      isVisible: () => true,
      subscribeStorage: () => () => undefined,
      scheduleTask: (task) => task(),
    });

    controller.start();
    channel.receive({ type: 'data-updated', sourceId: 'other', eventId: 'invalidate-event' });

    expect(invalidate).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('mantem inicializacao idempotente, encerra recursos e expira eventos antigos', async () => {
    const channel = new FakeChannel();
    const now = vi.fn().mockReturnValue(1_000);
    const sync = vi.fn().mockResolvedValue(undefined);
    let intervalCreates = 0;
    let intervalClears = 0;
    const controller = createDataSyncController({
      channel,
      sync,
      onUpdated: vi.fn(),
      isVisible: () => true,
      subscribeStorage: () => () => undefined,
      setIntervalTask: () => { intervalCreates += 1; return intervalCreates; },
      clearIntervalTask: () => { intervalClears += 1; },
      scheduleTask: (task) => task(),
      now,
      seenEventTtlMs: 100,
      maxSeenEvents: 2,
    });

    controller.start();
    controller.start();
    channel.receive({ type: 'data-updated', sourceId: 'other', eventId: 'same' });
    channel.receive({ type: 'data-updated', sourceId: 'other', eventId: 'same' });
    await Promise.resolve();
    await Promise.resolve();
    expect(sync).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1_101);
    channel.receive({ type: 'data-updated', sourceId: 'other', eventId: 'same' });
    await Promise.resolve();
    await Promise.resolve();
    expect(sync).toHaveBeenCalledTimes(2);
    controller.stop();

    expect(intervalCreates).toBe(1);
    expect(intervalClears).toBe(1);
    expect(channel.closed).toBe(true);
  });

  describe('coalescencia de requestRefresh', () => {
    it('agenda um unico run mesmo com chamadas repetidas', () => {
      const sync = vi.fn().mockResolvedValue(undefined);
      const scheduled: Array<() => void> = [];
      const scheduleTask = (task: () => void): void => { scheduled.push(task); };
      const controller = createDataSyncController({
        sync,
        onUpdated: vi.fn(),
        isVisible: () => true,
        setIntervalTask: () => 1,
        clearIntervalTask: () => undefined,
        scheduleTask,
        channel: null,
        subscribeStorage: () => () => undefined,
      });

      controller.requestRefresh();
      controller.requestRefresh();
      controller.requestRefresh();

      expect(scheduled).toHaveLength(1);
    });

    it('reagenda uma unica vez apos concluir o run em andamento', async () => {
      let resolverSync!: () => void;
      const sync = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolverSync = resolve; }));
      const scheduled: Array<() => void> = [];
      const scheduleTask = (task: () => void): void => { scheduled.push(task); };
      const controller = createDataSyncController({
        sync,
        onUpdated: vi.fn(),
        isVisible: () => true,
        setIntervalTask: () => 1,
        clearIntervalTask: () => undefined,
        scheduleTask,
        channel: null,
        subscribeStorage: () => () => undefined,
      });

      controller.requestRefresh();
      expect(scheduled).toHaveLength(1);
      scheduled.shift()!();

      // Enquanto o run esta em andamento, novas chamadas marcam queued.
      controller.requestRefresh();
      controller.requestRefresh();
      expect(scheduled).toHaveLength(0);

      resolverSync();
      await vi.waitFor(() => {
        expect(scheduled).toHaveLength(1);
      }, { timeout: 1000 });
    });
  });
});
