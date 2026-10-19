/**
 * Pagina da Recepcao.
 *
 * As acoes de chave sao geradas por `features/recepcao/recepcao.ts` nos cards
 * de chave e no modal de atribuicao, alem das que o `recepcao.html` traz
 * estaticamente.
 */

import { instalarDelegacao, registrarAcoes } from '../core/actions';
import { registrarAcoesComuns } from '../core/acoes-comuns';
import * as recepcao from '../features/recepcao/recepcao';

registrarAcoesComuns({
  ir: recepcao.ir,
  atualizarBadge: recepcao.atualizarBadge,
});

registrarAcoes({
  // --- Chaves ---
  abrirChave: ({ num }) => recepcao.abrirChave(num ?? 0),
  salvarChave: () => void recepcao.salvarChave(),
  excluirChave: ({ num }) => recepcao.excluirChave(num ?? 0),
  liberarChaveRapido: ({ num }) => void recepcao.liberarChaveRapido(num ?? 0),
  abrirAtribuir: ({ num }) => recepcao.abrirAtribuir(num ?? 0),
  confirmarAtribuir: () => void recepcao.confirmarAtribuir(),
  devolverChaveRec: () => void recepcao.devolverChaveRec(),

  // --- Alvos dos botoes `data-action="atualizarSecao"` ---
  rdMapa: recepcao.rdMapa,
  rdChaves: recepcao.rdChaves,
  rdNotifs: recepcao.rdNotifs,
});

instalarDelegacao();

void recepcao.initRecepcao();