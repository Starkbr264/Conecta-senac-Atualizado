/**
 * Avisos leves de alteracao do cache compartilhado entre abas.
 *
 * O aviso nunca transporta dados: a aba receptora sempre consulta a fonte da
 * verdade atraves de `sync`. Isso evita que um cache local antigo seja tratado
 * como autoridade.
 */

export const DATA_SYNC_STORAGE_KEY = 'conecta:data-updated';
const DATA_SYNC_CHANNEL = 'conecta-data-sync-v1';

export interface DataSyncMessage {
  type: 'data-updated';
  sourceId: string;
  eventId: string;
}

export interface DataSyncChannel {
  postMessage(message: DataSyncMessage): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  close(): void;
}

type StorageListener = (event: { key: string | null; newValue: string | null }) => void;

interface ControllerOptions {
  channel?: DataSyncChannel | null;
  sync: () => Promise<void>;
  onUpdated: () => void;
  onInvalidated?: () => void;
  isVisible: () => boolean;
  intervalMs?: number;
  subscribeStorage?: (listener: StorageListener) => () => void;
  scheduleTask?: (task: () => void) => void;
  setIntervalTask?: (task: () => void, ms: number) => number;
  clearIntervalTask?: (id: number) => void;
  now?: () => number;
  seenEventTtlMs?: number;
  maxSeenEvents?: number;
  random?: () => number;
}

export interface ReadVersionGuard {
  beginRead(): number;
  invalidate(): number;
  isCurrent(version: number): boolean;
}

/** Versao monotonicamente crescente para proteger leituras contra respostas antigas. */
export function createReadVersionGuard(): ReadVersionGuard {
  let version = 0;
  return {
    beginRead: () => version,
    invalidate: () => ++version,
    isCurrent: (readVersion) => readVersion === version,
  };
}

function novoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function canalPadrao(): DataSyncChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(DATA_SYNC_CHANNEL) as unknown as DataSyncChannel;
}

function storagePadrao(listener: StorageListener): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => undefined;
  const onStorage = (event: StorageEvent): void => listener(event);
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

function mensagemValida(value: unknown): value is DataSyncMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<DataSyncMessage>;
  return m.type === 'data-updated' && typeof m.sourceId === 'string' && typeof m.eventId === 'string';
}

let publisher: DataSyncChannel | null | undefined;
let publisherSourceId: string | undefined;

/** Publica somente um aviso; os dados serão relidos pela aba destinatária. */
export function publishDataUpdate(): void {
  if (publisher === undefined) {
    publisher = canalPadrao();
    publisherSourceId = novoId();
  }
  const message: DataSyncMessage = {
    type: 'data-updated',
    sourceId: publisherSourceId ?? novoId(),
    eventId: novoId(),
  };
  publisher?.postMessage(message);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DATA_SYNC_STORAGE_KEY, JSON.stringify(message));
    } catch {
      // O BroadcastChannel continua sendo suficiente quando o storage está bloqueado.
    }
  }
}

export interface DataSyncController {
  readonly sourceId: string;
  start(): void;
  stop(): void;
  requestRefresh(): void;
}

/**
 * Coordena notificacoes, polling e uma unica sincronizacao por vez.
 * A funcao `sync` deve atualizar o cache a partir do backend.
 */
export function createDataSyncController(options: ControllerOptions): DataSyncController {
  const sourceId = novoId();
  const channel = options.channel === undefined ? canalPadrao() : options.channel;
  const subscribeStorage = options.subscribeStorage ?? storagePadrao;
  const scheduleTask = options.scheduleTask ?? ((task: () => void) => queueMicrotask(task));
  const setIntervalTask = options.setIntervalTask ?? ((task, ms) => window.setInterval(task, ms));
  const clearIntervalTask = options.clearIntervalTask ?? ((id) => window.clearInterval(id));
  const intervalMs = options.intervalMs ?? 30_000;
  const now = options.now ?? (() => Date.now());
  const seenEventTtlMs = options.seenEventTtlMs ?? 5 * 60_000;
  const maxSeenEvents = options.maxSeenEvents ?? 512;
  const random = options.random ?? Math.random;
  const seenEvents = new Map<string, number>();
  let running = false;
  let queued = false;
  let started = false;
  let intervalId: number | null = null;
  let unsubscribeStorage = (): void => undefined;

  const limparEventosAntigos = (agora: number): void => {
    for (const [eventId, recebidoEm] of seenEvents) {
      if (agora - recebidoEm >= seenEventTtlMs) seenEvents.delete(eventId);
    }
    while (seenEvents.size > maxSeenEvents) {
      const primeiro = seenEvents.keys().next().value as string | undefined;
      if (primeiro === undefined) break;
      seenEvents.delete(primeiro);
    }
  };

  const run = (): void => {
    if (!options.isVisible()) {
      queued = true;
      return;
    }
    if (running) {
      queued = true;
      return;
    }
    running = true;
    void options.sync()
      .then(() => options.onUpdated())
      .catch(() => undefined)
      .finally(() => {
        running = false;
        if (queued) {
          queued = false;
          scheduleTask(run);
        }
      });
  };

  const requestRefresh = (): void => {
    if (running) {
      queued = true;
      return;
    }
    scheduleTask(run);
  };

  const receive = (value: unknown): void => {
    if (!mensagemValida(value)) return;
    if (value.sourceId === sourceId) return;
    const agora = now();
    limparEventosAntigos(agora);
    const recebidoEm = seenEvents.get(value.eventId);
    if (recebidoEm !== undefined && agora - recebidoEm < seenEventTtlMs) return;
    seenEvents.set(value.eventId, agora);
    limparEventosAntigos(agora);
    options.onInvalidated?.();
    requestRefresh();
  };

  const onStorage: StorageListener = (event) => {
    if (event.key !== DATA_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      receive(JSON.parse(event.newValue));
    } catch {
      // Ignora somente o aviso malformado; o cache continua intacto.
    }
  };

  const onVisibility = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && queued) {
      queued = false;
      requestRefresh();
    }
  };

  const start = (): void => {
    if (started) return;
    started = true;
    channel?.addEventListener('message', onMessage);
    unsubscribeStorage = subscribeStorage(onStorage);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    const jitter = Math.floor(random() * Math.min(1_000, Math.max(250, Math.floor(intervalMs * 0.1))));
    intervalId = setIntervalTask(requestRefresh, intervalMs + jitter);
  };

  const onMessage = (event: { data: unknown }): void => receive(event.data);

  const stop = (): void => {
    if (!started) return;
    started = false;
    unsubscribeStorage();
    channel?.removeEventListener('message', onMessage);
    channel?.close();
    if (intervalId !== null) clearIntervalTask(intervalId);
    intervalId = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
  };

  return { sourceId, start, stop, requestRefresh };
}
