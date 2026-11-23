import { describe, expect, it, vi } from 'vitest';
import {
  cacheKeyForIdentity,
  isSyncPendenteLegacy,
  isSyncPendenteOwnedBy,
  type SyncPendente,
} from './storage';

describe('isolamento de identidade do storage', () => {
  const operation = (userId: number): SyncPendente => ({
    operacaoId: 'op-1',
    userId,
    unidadeId: 7,
    criadaEm: '2026-11-22T12:00:00.000Z',
    payload: { operacaoId: 'op-1', userId, alteracoes: { solicitacoes: [] } },
  });

  it('namespaces o cache por identidade, unidade e perfil', () => {
    expect(cacheKeyForIdentity('solicitacoes', { id: 10, unidadeId: 7, perfil: 'coordenador' }))
      .toBe('sn_v6_u10_un7_pcoordenador_solicitacoes');
    expect(cacheKeyForIdentity('solicitacoes', { id: 11, unidadeId: 7, perfil: 'coordenador' }))
      .not.toBe(cacheKeyForIdentity('solicitacoes', { id: 10, unidadeId: 7, perfil: 'coordenador' }));
  });

  it('só considera a operação pertencente ao mesmo usuário', () => {
    expect(isSyncPendenteOwnedBy(operation(10), 10)).toBe(true);
    expect(isSyncPendenteOwnedBy(operation(10), 11)).toBe(false);
  });

  it('classifica operações sem proprietário verificável como legadas', () => {
    expect(isSyncPendenteLegacy({ operacaoId: 'legacy', payload: {} })).toBe(true);
    expect(isSyncPendenteLegacy(operation(10))).toBe(false);
  });

  it('não envia a fila de A quando B está autenticado', async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    const sincronizar = vi.fn().mockResolvedValue({});
    vi.resetModules();
    vi.doMock('./api', () => ({
      buscarDados: vi.fn().mockResolvedValue({
        usuarios: [], unidades: [], salas: [], turmas: [], reservas: [],
        chaves: [], notificacoes: [], solicitacoes: [],
      }),
      buscarUnidadesPublicas: vi.fn(),
      cancelarSolicitacao: vi.fn(),
      ErroApi: class extends Error { status = 500; },
      extrairUsuarioLogin: vi.fn(),
      login: vi.fn(),
      obterToken: vi.fn(() => 'token-b'),
      responderSolicitacao: vi.fn(),
      salvarToken: vi.fn(),
      sincronizar,
    }));
    vi.doMock('./theme', () => ({
      clearSessao: vi.fn(),
      getSessao: vi.fn(() => ({ id: 11, nome: 'B', email: 'b@edu.df.senac.br', senha: '', perfil: 'coordenador', unidadeId: 7 })),
      getTema: vi.fn(),
      initTema: vi.fn(),
      setSessao: vi.fn(),
      toggleTema: vi.fn(),
    }));
    const storage = await import('./storage');
    values.set(storage.K.syncPendentes, JSON.stringify([operation(10)]));

    storage.loadCache();
    await storage.sincronizarServidor();

    expect(sincronizar).not.toHaveBeenCalled();
    expect(JSON.parse(values.get(storage.K.syncPendentes) ?? '[]')).toHaveLength(1);
  });

  it('quarentena fila legada sem atribuí-la ao usuário atual', async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    vi.resetModules();
    vi.doMock('./api', () => ({
      buscarDados: vi.fn().mockResolvedValue({
        usuarios: [], unidades: [], salas: [], turmas: [], reservas: [],
        chaves: [], notificacoes: [], solicitacoes: [],
      }),
      buscarUnidadesPublicas: vi.fn(), cancelarSolicitacao: vi.fn(),
      ErroApi: class extends Error { status = 500; },
      extrairUsuarioLogin: vi.fn(), login: vi.fn(),
      obterToken: vi.fn(() => 'token-b'), responderSolicitacao: vi.fn(),
      salvarToken: vi.fn(), sincronizar: vi.fn().mockResolvedValue({}),
    }));
    vi.doMock('./theme', () => ({
      clearSessao: vi.fn(),
      getSessao: vi.fn(() => ({ id: 11, nome: 'B', email: 'b@edu.df.senac.br', senha: '', perfil: 'coordenador', unidadeId: 7 })),
      getTema: vi.fn(), initTema: vi.fn(), setSessao: vi.fn(), toggleTema: vi.fn(),
    }));
    const storage = await import('./storage');
    values.set(storage.K.syncPendentes, JSON.stringify([{ operacaoId: 'legacy', payload: {} }]));

    storage.loadCache();

    expect(storage.lerQuarentenaSync()).toHaveLength(1);
    expect(JSON.parse(values.get(storage.K.syncPendentes) ?? '[]')).toEqual([]);
  });
});
