import { beforeEach, describe, expect, it, vi } from 'vitest';

const initialSolicitacao = {
  id: 9001,
  salaId: 1,
  instrutorId: 2,
  unidadeId: 1,
  data: '2026-12-20',
  turnos: ['Matutino'],
  status: 'pendente',
  criadaEm: '2026-11-21T10:00:00Z',
};

const cacheCom = (solicitacoes: unknown[]) => ({
  usuarios: [], unidades: [], salas: [], turmas: [], reservas: [], chaves: [], notificacoes: [], solicitacoes,
});

function preparaLocalStorage(): void {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, String(value)),
      removeItem: (key: string) => void values.delete(key),
    },
  });
}

async function importaStorage(buscarDados: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  vi.doMock('./api', () => ({
    buscarDados,
    buscarUnidadesPublicas: vi.fn(),
    cancelarSolicitacao: vi.fn(),
    ErroApi: class extends Error { status = 500; },
    extrairUsuarioLogin: vi.fn(),
    login: vi.fn(),
    obterToken: vi.fn(() => 'fixture-token'),
    responderSolicitacao: vi.fn(),
    salvarToken: vi.fn(),
    sincronizar: vi.fn().mockResolvedValue({}),
  }));
  vi.doMock('./theme', () => ({
    clearSessao: vi.fn(),
    getSessao: vi.fn(() => ({ id: 10, nome: 'Fixture', email: 'fixture@edu.df.senac.br', senha: '', perfil: 'coordenador', unidadeId: 1 })),
    getTema: vi.fn(),
    initTema: vi.fn(),
    setSessao: vi.fn(),
    toggleTema: vi.fn(),
  }));
  return import('./storage');
}

describe('storage e sincronizacao de solicitacoes', () => {
  beforeEach(() => {
    preparaLocalStorage();
  });

  it('descarta GET antigo apos mutacao confirmada e preserva o cache atualizado', async () => {
    let liberarGetAntigo!: (dados: unknown) => void;
    let leituras = 0;
    const getAntigo = new Promise<unknown>((resolve) => { liberarGetAntigo = resolve; });
    const buscarDados = vi.fn().mockImplementation(() => {
      leituras += 1;
      if (leituras === 1) return getAntigo;
      return Promise.resolve(cacheCom([{ ...initialSolicitacao, status: 'aprovada' }]));
    });
    const storage = await importaStorage(buscarDados);
    localStorage.setItem(
      storage.cacheKeyForIdentity('solicitacoes', { id: 10, unidadeId: 1, perfil: 'coordenador' }),
      JSON.stringify([initialSolicitacao]),
    );
    storage.loadCache();

    const leituraPendente = storage.sincronizarServidor();
    await Promise.resolve();
    expect(buscarDados).toHaveBeenCalledTimes(1);

    await storage.updSolicAsync(9001, { status: 'aprovada' });
    expect(storage.getSolics().find((item) => item.id === 9001)?.status).toBe('aprovada');

    liberarGetAntigo(cacheCom([{ ...initialSolicitacao, status: 'pendente' }]));
    await leituraPendente;

    expect(buscarDados).toHaveBeenCalledTimes(2);
    expect(storage.getSolics().find((item) => item.id === 9001)?.status).toBe('aprovada');
  });

  it('preserva exatamente o cache quando o GET falha', async () => {
    const buscarDados = vi.fn().mockRejectedValue(new Error('offline'));
    const storage = await importaStorage(buscarDados);
    localStorage.setItem(
      storage.cacheKeyForIdentity('solicitacoes', { id: 10, unidadeId: 1, perfil: 'coordenador' }),
      JSON.stringify([initialSolicitacao]),
    );
    storage.loadCache();
    const antes = storage.getSolics();

    await storage.sincronizarServidor();

    expect(storage.getSolics()).toEqual(antes);
  });

  it('limpa flag de erro quando sincronizacao conclui com sucesso', async () => {
    const buscarDados = vi.fn().mockResolvedValue(cacheCom([]));
    const storage = await importaStorage(buscarDados);
    storage.loadCache();

    await storage.sincronizarServidor();

    expect(storage.ultimaSincronizacaoFalhou()).toBe(false);
  });

  it('define flag de erro quando sincronizacao falha (offline)', async () => {
    const buscarDados = vi.fn().mockRejectedValue(new Error('offline'));
    const storage = await importaStorage(buscarDados);
    storage.loadCache();

    await storage.sincronizarServidor();

    expect(storage.ultimaSincronizacaoFalhou()).toBe(true);
  });

  it('limpa flag de erro no inicio de nova tentativa', async () => {
    const buscarDados = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(cacheCom([]));
    const storage = await importaStorage(buscarDados);
    storage.loadCache();

    // Primeira tentativa falha
    await storage.sincronizarServidor();
    expect(storage.ultimaSincronizacaoFalhou()).toBe(true);

    // Segunda tentativa: flag limpa no inicio, sync sucede
    await storage.sincronizarServidor();
    expect(storage.ultimaSincronizacaoFalhou()).toBe(false);
  });

  it('deduplica chamadas concorrentes de sincronizarServidor no storage', async () => {
    let liberar!: (dados: unknown) => void;
    const buscarDados = vi.fn().mockImplementation(() => new Promise((resolve) => { liberar = resolve; }));
    const storage = await importaStorage(buscarDados);
    storage.loadCache();

    const primeira = storage.sincronizarServidor();
    const segunda = storage.sincronizarServidor();
    expect(primeira).toBe(segunda);
    expect(buscarDados).toHaveBeenCalledTimes(1);

    liberar(cacheCom([]));
    await Promise.all([primeira, segunda]);
  });
});
