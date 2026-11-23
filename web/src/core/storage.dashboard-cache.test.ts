import { describe, expect, it, vi } from 'vitest';

const colecoesDashboard = ['salas', 'turmas', 'reservas', 'solicitacoes'] as const;

function instalarLocalStorage(values: Map<string, string>): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
}

async function carregarStorageComSessao(id: number) {
  vi.resetModules();
  vi.doMock('./theme', () => ({
    clearSessao: vi.fn(),
    getSessao: vi.fn(() => ({
      id,
      nome: 'Teste',
      email: 'teste@edu.df.senac.br',
      senha: '',
      perfil: 'coordenador',
      unidadeId: 1,
    })),
    getTema: vi.fn(),
    initTema: vi.fn(),
    setSessao: vi.fn(),
    toggleTema: vi.fn(),
  }));
  vi.doMock('./api', () => ({
    ErroApi: class extends Error { status = 500; },
    buscarDados: vi.fn(),
    buscarUnidadesPublicas: vi.fn(),
    cancelarSolicitacao: vi.fn(),
    extrairUsuarioLogin: vi.fn(),
    login: vi.fn(),
    obterToken: vi.fn(() => 'token'),
    responderSolicitacao: vi.fn(),
    salvarToken: vi.fn(),
    sincronizar: vi.fn(),
  }));
  return import('./storage');
}

describe('confiabilidade do cache do dashboard', () => {
  it('aceita snapshot vazio, mas completo, da identidade atual', async () => {
    const values = new Map<string, string>();
    instalarLocalStorage(values);
    const storage = await carregarStorageComSessao(10);

    for (const colecao of colecoesDashboard) {
      values.set(storage.cacheKeyForIdentity(colecao, { id: 10, unidadeId: 1, perfil: 'coordenador' }), '[]');
    }

    expect(storage.cacheDashboardConfiavel()).toBe(true);
  });

  it('rejeita snapshot incompleto ou malformado', async () => {
    const values = new Map<string, string>();
    instalarLocalStorage(values);
    const storage = await carregarStorageComSessao(10);
    const identidade = { id: 10, unidadeId: 1, perfil: 'coordenador' };

    for (const colecao of colecoesDashboard) {
      values.set(storage.cacheKeyForIdentity(colecao, identidade), '[]');
    }
    values.delete(storage.cacheKeyForIdentity('reservas', identidade));
    expect(storage.cacheDashboardConfiavel()).toBe(false);

    values.set(storage.cacheKeyForIdentity('reservas', identidade), '[{"semId":true}]');
    expect(storage.cacheDashboardConfiavel()).toBe(false);
  });

  it('não considera cache persistido para outro usuário', async () => {
    const values = new Map<string, string>();
    instalarLocalStorage(values);
    const storage = await carregarStorageComSessao(10);

    for (const colecao of colecoesDashboard) {
      values.set(storage.cacheKeyForIdentity(colecao, { id: 11, unidadeId: 1, perfil: 'coordenador' }), '[{"id":1}]');
    }

    expect(storage.cacheDashboardConfiavel()).toBe(false);
  });
});
