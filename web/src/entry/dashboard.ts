/**
 * Painel de demonstracao (salas, turmas, reservas e disponibilidade).
 *
 * As tabelas sao redesenhadas por `features/dashboard/*`, que geram os botoes
 * `data-action="editarSala"`, `data-action="excluirTurma"` etc. no proprio
 * HTML — por isso as acoes abaixo precisam estar registradas aqui, e nao
 * apenas as que aparecem no `dashboard.html` estatico.
 */

import { instalarDelegacao, registrarAcoes } from '../core/actions';
import { registrarAcoesComuns } from '../core/acoes-comuns';
import * as dashboard from '../features/dashboard/dashboard';
import * as reservas from '../features/dashboard/reservas';
import * as salas from '../features/dashboard/salas';
import * as turmas from '../features/dashboard/turmas';

// O `dashboard.html` nao tem menu lateral, logo nao ha `ir` para registrar.
registrarAcoesComuns({});

registrarAcoes({
  // --- Navegacao do painel ---
  mostrarSecao: ({ arg }) => dashboard.mostrarSecao(arg ?? 'salas'),

  // --- Salas ---
  editarSala: ({ num }) => salas.editarSala(num ?? 0),
  cancelarEdicaoSala: salas.cancelarEdicaoSala,
  excluirSala: ({ num }) => salas.excluirSala(num ?? 0),

  // --- Turmas ---
  editarTurma: ({ num }) => turmas.editarTurma(num ?? 0),
  cancelarEdicaoTurma: turmas.cancelarEdicaoTurma,
  excluirTurma: ({ num }) => turmas.excluirTurma(num ?? 0),

  // --- Reservas ---
  excluirReserva: ({ num }) => reservas.excluirReserva(num ?? 0),
});

instalarDelegacao();

void dashboard.initDashboard();