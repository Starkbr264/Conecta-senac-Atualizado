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

const bancoCompleto = (id = 1) => ({
  usuarios: [{ id }],
  unidades: [{ id }],
  salas: [{ id }],
  turmas: [{ id }],
  reservas: [{ id }],
  chaves: [{ id }],
  notificacoes: [{ id }],
  solicitacoes: [{ ...initialSolicitacao, id }],
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

  it('aceita resposta completa e arrays vazios, limpando a flag de falha', async () => {
    const buscarDados = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(bancoCompleto(77));
    const storage = await importaStorage(buscarDados);
    storage.loadCache();

    await storage.sincronizarServidor();
    expect(storage.ultimaSincronizacaoFalhou()).toBe(true);

    await storage.sincronizarServidor();
    expect(storage.ultimaSincronizacaoFalhou()).toBe(false);
    expect(storage.CACHE.salas[0]?.id).toBe(77);

    const vazio = {
      usuarios: [], unidades: [], salas: [], turmas: [], reservas: [],
      chaves: [], notificacoes: [], solicitacoes: [],
    };
    buscarDados.mockResolvedValueOnce(vazio);
    await storage.sincronizarServidor();
    expect(storage.ultimaSincronizacaoFalhou()).toBe(false);
    expect(storage.CACHE.salas).toEqual([]);
  });

  it.each(['usuarios', 'unidades', 'salas', 'turmas', 'reservas', 'chaves', 'notificacoes', 'solicitacoes'] as const)(
    'recusa resposta sem a coleção obrigatória %s sem persistência parcial',
    async (ausente) => {
      const buscarDados = vi.fn().mockResolvedValue(bancoCompleto(200));
      const storage = await importaStorage(buscarDados);
      for (const colecao of [
        'usuarios', 'unidades', 'salas', 'turmas', 'reservas',
        'chaves', 'notificacoes', 'solicitacoes',
      ] as const) {
        localStorage.setItem(
          storage.cacheKeyForIdentity(colecao, { id: 10, unidadeId: 1, perfil: 'coordenador' }),
          JSON.stringify([{ id: 100 }]),
        );
      }
      storage.loadCache();
      const resposta = bancoCompleto(200) as Record<string, unknown>;
      delete resposta[ausente];
      buscarDados.mockResolvedValueOnce(resposta);

      await storage.sincronizarServidor();

      expect(storage.ultimaSincronizacaoFalhou()).toBe(true);
      expect(Object.values(storage.CACHE).some((valor) => Array.isArray(valor)
        && valor[0] && typeof valor[0] === 'object'
        && (valor[0] as { id?: number }).id === 200)).toBe(false);
      expect(storage.CACHE.salas[0]?.id).toBe(100);
    },
  );

  it.each([
    ['null', null],
    ['objeto', {}],
    ['string', 'invalido'],
    ['numero', 42],
  ] as const)('recusa coleção com tipo incorreto (%s)', async (_nome, valor) => {
    const buscarDados = vi.fn();
    const storage = await importaStorage(buscarDados);
    const resposta = bancoCompleto(300) as Record<string, unknown>;
    resposta.salas = valor;
    buscarDados.mockResolvedValue(resposta);

    await storage.sincronizarServidor();

    expect(storage.ultimaSincronizacaoFalhou()).toBe(true);
    expect(storage.CACHE.salas).toEqual([]);
  });

  it('recupera integralmente após resposta parcial e não mantém falha antiga', async () => {
    const parcial = bancoCompleto(400) as Record<string, unknown>;
    delete parcial.reservas;
    const buscarDados = vi.fn().mockResolvedValueOnce(parcial).mockResolvedValueOnce(bancoCompleto(401));
    const storage = await importaStorage(buscarDados);
    storage.loadCache();

    await storage.sincronizarServidor();
    expect(storage.ultimaSincronizacaoFalhou()).toBe(true);
    expect(storage.CACHE.salas).toEqual([]);

    await storage.sincronizarServidor();
    expect(storage.ultimaSincronizacaoFalhou()).toBe(false);
    expect(storage.CACHE.salas[0]?.id).toBe(401);
    expect(storage.CACHE.reservas[0]?.id).toBe(401);
  });

  it('recusa registro sem identificador e preserva o snapshot anterior', async () => {
    const buscarDados = vi.fn();
    const storage = await importaStorage(buscarDados);
    localStorage.setItem(
      storage.cacheKeyForIdentity('salas', { id: 10, unidadeId: 1, perfil: 'coordenador' }),
      JSON.stringify([{ id: 91 }]),
    );
    storage.loadCache();
    const resposta = bancoCompleto(500) as Record<string, unknown>;
    resposta.salas = [{ unidadeId: 1 }];
    buscarDados.mockResolvedValue(resposta);

    await storage.sincronizarServidor();

    expect(storage.ultimaSincronizacaoFalhou()).toBe(true);
    expect(storage.CACHE.salas[0]?.id).toBe(91);
  });
});
