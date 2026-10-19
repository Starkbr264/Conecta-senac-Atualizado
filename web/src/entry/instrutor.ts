/**
 * Pagina do Instrutor.
 *
 * As acoes `sl*` e `verificarDisponibilidadeSolic` sao geradas dentro dos
 * modais que `features/instrutor/instrutor.ts` monta, alem das que o
 * `instrutor.html` traz estaticamente.
 */

import { instalarDelegacao, registrarAcoes } from '../core/actions';
import { registrarAcoesComuns } from '../core/acoes-comuns';
import * as instrutor from '../features/instrutor/instrutor';

registrarAcoesComuns({
  ir: instrutor.ir,
  atualizarBadge: instrutor.atualizarBadge,
});

registrarAcoes({
  // --- Modal de solicitacao ---
  abrirSolic: ({ num }) => instrutor.abrirSolic(num ?? 0),
  slModoData: ({ arg }) => {
    if (arg === 'unica' || arg === 'periodo' || arg === 'especificas') {
      instrutor.slModoData(arg);
    }
  },
  slToggleTurno: ({ alvo }) => instrutor.slToggleTurno(alvo as HTMLElement),
  slAdicionarData: instrutor.slAdicionarData,
  slRemoverData: ({ arg }) => instrutor.slRemoverData(arg ?? ''),
  slOnTurmaChange: instrutor.slOnTurmaChange,
  verificarDisponibilidadeSolic: instrutor.verificarDisponibilidadeSolic,
  enviarSolic: () => void instrutor.enviarSolic(),

  // --- Alvos dos botoes `data-action="atualizarSecao"` ---
  rdTurmas: instrutor.rdTurmas,
  rdSalas: instrutor.rdSalas,
  rdNotifs: instrutor.rdNotifs,
});

instalarDelegacao();

void instrutor.initInstrutor();