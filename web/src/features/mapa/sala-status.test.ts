/**
 * Regressão do "botão verde do Mapa de Salas".
 *
 * O override manual (`statusManual`) — inclusive `livre` — tem precedência
 * absoluta sobre o cálculo automático e sobre o status remoto do servidor.
 * Estes casos cobrem a causa raiz do defeito: `livre` era tratado como `Auto`
 * (null) e a mesclagem com `GET /api/salas/status` descartava o override local.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { cacheKeyForIdentity, loadCache, K } from '../../core/storage';
import { calcularStatusSala, diaDaSemanaDe, mesclarStatusRemoto } from './sala-status';
import type { SalaStatusRemoto } from '../../core/api';
import type { Reserva, Sala } from '../../types';

/** Espelho em memória: `storage.ts` usa `localStorage` puro (protegido por try/catch). */
const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (chave: string) => mem.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void mem.set(chave, String(valor)),
    removeItem: (chave: string) => void mem.delete(chave),
    clear: () => mem.clear(),
  },
});

const HOJE = '2026-11-17';
const SALA_ID = 5002;
const UNIDADE_ID = 1001;
const IDENTIDADE = { id: 10, unidadeId: UNIDADE_ID, perfil: 'coordenador' };

function salaCom(statusManual?: Sala['statusManual']): Sala {
  return {
    id: SALA_ID,
    nome: 'Sala Comum 01',
    tipo: 'Sala Comum',
    turnosDisponiveis: ['Matutino', 'Vespertino', 'Noturno'],
    unidadeId: UNIDADE_ID,
    statusManual,
    motivoManual: '',
    manualPor: statusManual ? 'Coordenador' : '',
    manualCriadaEm: statusManual ? '2026-11-17T20:00:00.000Z' : null,
    ativa: true,
  };
}

function reservaAvulsaAtiva(): Reserva {
  return {
    id: 7001,
    salaId: SALA_ID,
    turno: 'Matutino',
    diasSemana: [diaDaSemanaDe(HOJE)],
    dataInicio: '2026-11-01',
    dataFim: '2026-12-01',
    unidadeId: UNIDADE_ID,
    status: 'ATIVA',
    avulsa: true,
  };
}

function gravar(sala: Sala, reservas: Reserva[] = []): void {
  mem.set(K.sessao, JSON.stringify({
    id: IDENTIDADE.id, nome: 'Fixture', email: 'fixture@edu.df.senac.br',
    senha: '', perfil: IDENTIDADE.perfil, unidadeId: IDENTIDADE.unidadeId,
  }));
  mem.set(cacheKeyForIdentity('salas', IDENTIDADE), JSON.stringify([sala]));
  mem.set(cacheKeyForIdentity('reservas', IDENTIDADE), JSON.stringify(reservas));
  mem.set(cacheKeyForIdentity('turmas', IDENTIDADE), JSON.stringify([]));
  mem.set(cacheKeyForIdentity('usuarios', IDENTIDADE), JSON.stringify([]));
  loadCache();
}

function remoto(status: SalaStatusRemoto['status'], extra: Partial<SalaStatusRemoto> = {}): SalaStatusRemoto {
  return {
    id: SALA_ID,
    nome: 'Sala Comum 01',
    status,
    reason: null,
    inicio: null,
    fim: null,
    turma: null,
    statusAtual: status,
    ...extra,
  };
}

beforeEach(() => {
  mem.clear();
});

describe('calcularStatusSala — precedência do estado manual (livre)', () => {
  it('mantém override livre mesmo com reserva ativa na sala', () => {
    gravar(salaCom('livre'), [reservaAvulsaAtiva()]);

    const info = calcularStatusSala(salaCom('livre'), HOJE);

    expect(info.stat).toBe('livre');
    expect(info.override?.status).toBe('livre');
  });

  it('apresenta ocupada (nunca livre indevidamente) sem override e com reserva ativa', () => {
    gravar(salaCom(null), [reservaAvulsaAtiva()]);

    const info = calcularStatusSala(salaCom(null), HOJE);

    expect(info.stat).toBe('ocupada');
    expect(info.override).toBeNull();
  });

  it('devolve o cálculo ao automático quando statusManual é nulo (Auto)', () => {
    gravar(salaCom(null), []);

    const info = calcularStatusSala(salaCom(null), HOJE);

    expect(info.stat).toBe('livre');
    expect(info.override).toBeNull();
  });

  it('mantém os demais quatro estados manuais com precedência', () => {
    for (const status of ['ocupada', 'iminente', 'manutencao', 'indisponivel'] as const) {
      gravar(salaCom(status), []);

      const info = calcularStatusSala(salaCom(status), HOJE);

      expect(info.stat, `estado '${status}'`).toBe(status);
      expect(info.override?.status, `estado '${status}'`).toBe(status);
    }
  });
});

describe('mesclarStatusRemoto — status remoto x override local', () => {
  it('override local livre prevalece sobre o status remoto ocupada', () => {
    gravar(salaCom('livre'), []);
    const local = calcularStatusSala(salaCom('livre'), HOJE);

    const info = mesclarStatusRemoto(local, remoto('ocupada'));

    expect(info.stat).toBe('livre');
    expect(info.override?.status).toBe('livre');
  });

  it('sem override local, o status remoto alimenta o card', () => {
    gravar(salaCom(null), []);
    const local = calcularStatusSala(salaCom(null), HOJE);

    const info = mesclarStatusRemoto(local, remoto('ocupada', { turma: '2025.01.1' }));

    expect(info.stat).toBe('ocupada');
    expect(info.override).toBeNull();
    expect(info.periodos).toHaveLength(1);
    expect(info.periodos[0].turmaNome).toBe('2025.01.1');
  });

  it('sem status remoto, mantém o cálculo local', () => {
    gravar(salaCom('manutencao'), []);
    const local = calcularStatusSala(salaCom('manutencao'), HOJE);

    const info = mesclarStatusRemoto(local, undefined);

    expect(info.stat).toBe('manutencao');
    expect(info.override?.status).toBe('manutencao');
  });

  it('sem override e sem reserva, reflete o remoto livre', () => {
    gravar(salaCom(null), []);
    const local = calcularStatusSala(salaCom(null), HOJE);

    const info = mesclarStatusRemoto(local, remoto('livre'));

    expect(info.stat).toBe('livre');
    expect(info.override).toBeNull();
  });
});
