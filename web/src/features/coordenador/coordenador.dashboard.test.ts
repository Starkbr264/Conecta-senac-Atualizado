import { describe, expect, it } from 'vitest';
import {
  calcularIndicadoresDashboard,
  dashboardViewModel,
  estadoDashboardAposSincronizacao,
  type DashboardIndicadores,
} from './coordenador';

describe('estado de carregamento do dashboard do coordenador', () => {
  const indicadores: DashboardIndicadores = {
    salas: 7,
    turmasAtivas: 3,
    reservas: 10,
    solicitacoesPendentes: 2,
  };

  it('não apresenta zeros enquanto os dados estão carregando', () => {
    const view = dashboardViewModel('carregando', indicadores);

    expect(view.salas).toBe('Carregando...');
    expect(view.turmasAtivas).toBe('Carregando...');
    expect(view.reservas).toBe('Carregando...');
    expect(view.solicitacoesPendentes).toBe('Carregando...');
    expect(view.mensagem).toContain('Carregando');
  });

  it('apresenta os quatro indicadores quando o carregamento termina', () => {
    const view = dashboardViewModel('pronto', indicadores);

    expect(view).toEqual({
      salas: '7',
      turmasAtivas: '3',
      reservas: '10',
      solicitacoesPendentes: '2',
      mensagem: null,
    });
  });

  it('apresenta indisponibilidade quando o carregamento falha', () => {
    const view = dashboardViewModel('erro', indicadores);

    expect(view.salas).toBe('Indisponível');
    expect(view.turmasAtivas).toBe('Indisponível');
    expect(view.reservas).toBe('Indisponível');
    expect(view.solicitacoesPendentes).toBe('Indisponível');
    expect(view.mensagem).toContain('Não foi possível');
  });

  it('atualiza o modelo de carregamento para os valores finais', () => {
    const inicial = dashboardViewModel('carregando', indicadores);
    const final = dashboardViewModel('pronto', indicadores);

    expect(inicial.salas).not.toBe(final.salas);
    expect(final.solicitacoesPendentes).toBe('2');
  });

  it('mantém zero como valor válido somente depois do carregamento', () => {
    const view = dashboardViewModel('pronto', {
      salas: 0,
      turmasAtivas: 0,
      reservas: 0,
      solicitacoesPendentes: 0,
    });

    expect(view.salas).toBe('0');
    expect(view.turmasAtivas).toBe('0');
    expect(view.reservas).toBe('0');
    expect(view.solicitacoesPendentes).toBe('0');
    expect(view.mensagem).toBeNull();
  });

  it('calcula indicadores com unidadeId numérico ou textual', () => {
    const dados = calcularIndicadoresDashboard(
      1,
      [
        { unidadeId: 1 },
        { unidadeId: '1' },
        { unidadeId: 2 },
      ] as never,
      [
        { unidadeId: '1', dataInicio: '2000-01-01', dataFim: '2999-01-01' },
        { unidadeId: 1, dataInicio: '2000-01-01', dataFim: '2000-01-02' },
      ] as never,
      [
        { unidadeId: '1' },
        { unidadeId: 1 },
        { unidadeId: 2 },
      ] as never,
      [
        { unidadeId: '1', status: 'pendente' },
        { unidadeId: 1, status: 'aprovada' },
        { unidadeId: 2, status: 'pendente' },
      ] as never,
    );

    expect(dados).toEqual({
      salas: 2,
      turmasAtivas: 1,
      reservas: 2,
      solicitacoesPendentes: 1,
    });
  });

  it('não transforma unidade ausente ou inválida em uma unidade válida', () => {
    const registros = [{ unidadeId: 1, dataInicio: '2000-01-01', dataFim: '2999-01-01' }] as never;
    expect(calcularIndicadoresDashboard(null, registros, registros, registros, registros))
      .toEqual({ salas: 0, turmasAtivas: 0, reservas: 0, solicitacoesPendentes: 0 });
    expect(calcularIndicadoresDashboard('', registros, registros, registros, registros))
      .toEqual({ salas: 0, turmasAtivas: 0, reservas: 0, solicitacoesPendentes: 0 });
    expect(calcularIndicadoresDashboard(Number.NaN, registros, registros, registros, registros))
      .toEqual({ salas: 0, turmasAtivas: 0, reservas: 0, solicitacoesPendentes: 0 });
    expect(calcularIndicadoresDashboard('invalido', registros, registros, registros, registros))
      .toEqual({ salas: 0, turmasAtivas: 0, reservas: 0, solicitacoesPendentes: 0 });
  });

  it('não mistura identificadores de unidades diferentes', () => {
    const registros = [{ unidadeId: '2', dataInicio: '2000-01-01', dataFim: '2999-01-01' }] as never;
    expect(calcularIndicadoresDashboard(1, registros, registros, registros, registros))
      .toEqual({ salas: 0, turmasAtivas: 0, reservas: 0, solicitacoesPendentes: 0 });
  });

  it('usa cache confiável quando a sincronização falha', () => {
    expect(estadoDashboardAposSincronizacao(true, true)).toBe('offline');
    expect(dashboardViewModel('offline', indicadores)).toMatchObject({
      salas: '7',
      mensagem: 'Sem conexão com o servidor. Exibindo dados salvos localmente.',
    });
  });

  it('não usa cache quando a sincronização falha sem snapshot confiável', () => {
    expect(estadoDashboardAposSincronizacao(true, false)).toBe('erro');
  });

  it('recupera o estado pronto após uma sincronização bem-sucedida', () => {
    expect(estadoDashboardAposSincronizacao(false, true)).toBe('pronto');
    expect(estadoDashboardAposSincronizacao(false, false)).toBe('pronto');
  });

  it('mantém a indisponibilidade quando uma falha antiga ainda é a última tentativa', () => {
    expect(estadoDashboardAposSincronizacao(true, false)).toBe('erro');
  });
});
