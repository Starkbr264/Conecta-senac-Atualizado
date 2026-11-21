/**
 * Regressão da FALHA 2 da homologação — solicitação 717.
 *
 * Cenário real: turma cadastrada como **Matutino** e solicitação contendo
 * **Matutino, Vespertino e Noturno**. O backend rejeitava a aprovação com
 * HTTP 409 ("A solicitacao deve usar o turno da turma"), mas a interface do
 * coordenador mantinha o botão **Aprovar** habilitado e não mostrava a
 * incompatibilidade entre turma e turnos.
 *
 * A correção reutiliza `turnosCompativeisComTurma` (módulo do instrutor) dentro
 * de `diagnosticarSolicitacao`, que alimenta os indicadores do cartão e o
 * `disabled` do botão Aprovar. A validação definitiva continua no backend.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { K, loadCache } from '../../core/storage';
import type { Solicitacao, Turno, Turma } from '../../types';
import { cardSolic, diagnosticarSolicitacao } from './coordenador';

// Relógio determinístico: "hoje" fixo, sem turno classificado pela hora real.
vi.mock('../../core/temporal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/temporal')>()),
  hojeTemporalISO: () => '2026-11-18',
  classificarTurno: () => null,
}));

// Conflito de sala isola o diagnóstico de turma x turnos nestes testes.
vi.mock('../dashboard/reservas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../dashboard/reservas')>()),
  verificarConflito: () => null,
}));

/** Espelho em memória: `storage.ts` usa `localStorage` puro (protegido por try/catch). */
const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (chave: string) => mem.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void mem.set(chave, String(valor)),
    removeItem: (chave: string) => void mem.delete(chave),
    clear: () => void mem.clear(),
  },
});

const TURMA_MATUTINO: Turma = {
  id: 6010,
  nome: 'Turma 2025.01.10',
  curso: 'Fotografia',
  turno: 'Matutino',
  unidadeId: 1003,
};

/** Espelho da solicitação 717: turma Matutino x turnos Matutino/Vespertino/Noturno. */
function solic717(turmaId: number | null = 6010, turnos: Turno[] = ['Matutino', 'Vespertino', 'Noturno']): Solicitacao {
  return {
    id: 717,
    salaId: 5001,
    instrutorId: 17,
    turmaId,
    unidadeId: 1003,
    data: '2026-11-20',
    dataInicio: '2026-11-20',
    dataFim: '2026-11-20',
    turnos,
    diasSemana: ['seg'],
    status: 'pendente',
    criadaEm: '2026-11-18T10:00:00Z',
    motivo: 'Aula prática de fotografia',
  };
}

function semear(turmas: Turma[], solicitacoes: Solicitacao[]): void {
  mem.clear();
  localStorage.setItem(K.turmas, JSON.stringify(turmas));
  localStorage.setItem(K.solicitacoes, JSON.stringify(solicitacoes));
  localStorage.setItem(K.reservas, JSON.stringify([]));
  localStorage.setItem(K.salas, JSON.stringify([]));
  localStorage.setItem(K.usuarios, JSON.stringify([]));
  localStorage.setItem(K.unidades, JSON.stringify([]));
  localStorage.setItem(K.notificacoes, JSON.stringify([]));
  localStorage.setItem(K.chaves, JSON.stringify([]));
  loadCache();
}

function botao(html: string, classe: string): string {
  return html.match(new RegExp(`<button class="${classe}"[^>]*>`))?.[0] ?? '';
}

describe('diagnóstico turma x turnos no coordenador (FALHA 2)', () => {
  beforeEach(() => {
    semear([TURMA_MATUTINO], [solic717()]);
  });

  it('marca a solicitação 717 como incompatível e informa os turnos não permitidos', () => {
    const diagnostico = diagnosticarSolicitacao(solic717());

    expect(diagnostico.rotulos).toContain('Turno incompatível com a turma');
    const mensagem = diagnostico.impedimentos.join(' ');
    expect(mensagem).toContain('Turno incompatível com a turma');
    expect(mensagem).toContain('Vespertino');
    expect(mensagem).toContain('Noturno');
    // O turno da própria turma não pode aparecer como bloqueado.
    expect(mensagem).not.toContain('não permitido(s): Matutino');
  });

  it('não sinaliza incompatibilidade quando o turno é o da turma', () => {
    const diagnostico = diagnosticarSolicitacao(solic717(6010, ['Matutino']));

    expect(diagnostico.rotulos).not.toContain('Turno incompatível com a turma');
    expect(diagnostico.impedimentos).toEqual([]);
  });

  it('desabilita Aprovar e mantém Recusar disponível no cartão da 717', () => {
    const html = cardSolic(solic717());

    expect(html).toContain('Turno incompatível com a turma');
    expect(botao(html, 'btn btn-success btn-sm')).toContain('disabled');
    const recusar = botao(html, 'btn btn-danger btn-sm');
    expect(recusar).not.toContain('disabled');
    expect(recusar).toContain('data-action="abrirRecusaSolic"');
  });

  it('mantém Aprovar habilitado quando o turno é compatível', () => {
    const html = cardSolic(solic717(6010, ['Matutino']));

    expect(html).not.toContain('Turno incompatível com a turma');
    expect(botao(html, 'btn btn-success btn-sm')).not.toContain('disabled');
    expect(botao(html, 'btn btn-success btn-sm')).toContain('data-action="responderSolic"');
  });

  it('não presume compatibilidade quando os dados da turma estão indisponíveis', () => {
    semear([], [solic717(99999)]);
    const diagnostico = diagnosticarSolicitacao(solic717(99999));

    expect(diagnostico.impedimentos.join(' ')).toContain('dados da turma indisponíveis');
    expect(botao(cardSolic(solic717(99999)), 'btn btn-success btn-sm')).toContain('disabled');
  });
});
