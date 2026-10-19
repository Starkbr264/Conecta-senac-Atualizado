/**
 * Pagina do Coordenador.
 *
 * Registra as acoes que o `coordenador.html` dispara e liga a delegacao de
 * eventos. As acoes `sair`, `toggleTema`, `ir`, `atualizarSecao`, `modalFechar`
 * e as do calendario sao compartilhadas e vem de `core/acoes-comuns`.
 */

import { instalarDelegacao, registrarAcoes } from '../core/actions';
import { registrarAcoesComuns } from '../core/acoes-comuns';
import * as coordenador from '../features/coordenador/coordenador';
import type { StatusSolicitacao } from '../types';

registrarAcoesComuns({
  ir: coordenador.ir,
  atualizarBadges: coordenador.atualizarBadges,
});

registrarAcoes({
  // --- Salas ---
  abrirSala: ({ num }) => coordenador.abrirSala(num),
  salvarSala: () => void coordenador.salvarSala(),
  excluirSala: ({ num }) => coordenador.excluirSala(num ?? 0),

  // --- Turmas ---
  abrirTurma: ({ num }) => coordenador.abrirTurma(num),
  salvarTurma: () => void coordenador.salvarTurma(),
  excluirTurma: ({ num }) => coordenador.excluirTurma(num ?? 0),

  // --- Reservas ---
  abrirReserva: ({ num }) => coordenador.abrirReserva(num),
  salvarReserva: () => void coordenador.salvarReserva(),
  excluirReserva: ({ num }) => coordenador.excluirReserva(num ?? 0),
  // Substitui o `onclick="_editReservaId=null;modalFechar('modalRes')"` legado,
  // que encadeava duas operacoes num unico atributo.
  cancelarEdicaoReserva: coordenador.cancelarEdicaoReserva,

  // --- Instrutores ---
  abrirAtrib: ({ num }) => coordenador.abrirAtrib(num ?? 0),
  salvarAtrib: () => void coordenador.salvarAtrib(),
  ovClick: ({ alvo }) => coordenador.ovClick(alvo as HTMLElement),

  // --- Solicitações e notificacoes ---
  // `data-arg` carrega o id da solicitacao e `data-arg2` a decisao. O HTML e o
  // unico produtor de `data-arg2` e so emite 'aprovada'/'recusada', por isso o
  // estreitamento para `StatusSolicitacao` e seguro (sem `any`).
  responderSolic: ({ num, arg2 }) =>
    void coordenador.responderSolic(num ?? 0, arg2 as StatusSolicitacao),
  marcarTodasLidasLocal: coordenador.marcarTodasLidasLocal,

  // --- Alvos dos botoes `data-action="atualizarSecao"` ---
  rdMapa: coordenador.rdMapa,
  rdSolics: coordenador.rdSolics,
  rdNotifs: coordenador.rdNotifs,
});

instalarDelegacao();

void coordenador.initCoordenador();