/**
 * Pagina de Administrador.
 *
 * Registra as acoes que o `admin.html` dispara (`data-action="..."`) e liga a
 * delegacao de eventos. Substitui o antigo `installGlobals`, que publicava os
 * nomes das funcoes direto em `window` para que o `onclick="..."` do HTML
 * pudesse resolve-los.
 */

import { instalarDelegacao, registrarAcoes } from '../core/actions';
import { registrarAcoesComuns } from '../core/acoes-comuns';
import * as admin from '../features/admin/admin';

registrarAcoesComuns({ ir: admin.ir });

registrarAcoes({
  // --- Usuario ---
  abrirUser: ({ num }) => admin.abrirUser(num),
  fecharUser: admin.fecharUser,
  salvarUser: () => void admin.salvarUser(),
  resetSenha: ({ num }) => admin.resetSenha(num ?? 0),
  excluirUser: ({ num }) => admin.excluirUser(num ?? 0),

  // --- Unidade ---
  abrirUnid: ({ num }) => admin.abrirUnid(num),
  fecharUnid: admin.fecharUnid,
  salvarUnid: () => void admin.salvarUnid(),
  excluirUnid: ({ num }) => admin.excluirUnid(num ?? 0),

  // --- Alvos dos botoes `data-action="atualizarSecao" data-arg="..."` ---
  rdUsuarios: admin.rdUsuarios,
  rdUnidades: admin.rdUnidades,
  rdTodasSalas: admin.rdTodasSalas,
  rdTodasTurmas: admin.rdTodasTurmas,
  rdTodasReservas: admin.rdTodasReservas,
  rdTodasChaves: admin.rdTodasChaves,
});

instalarDelegacao();

void admin.initAdmin();