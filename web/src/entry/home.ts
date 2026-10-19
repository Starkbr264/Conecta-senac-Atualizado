/**
 * Pagina inicial (landing).
 *
 * A unica acao e o alternador de tema. `data-action="toggleTema"` precisa
 * apontar para `home.alternarTema` (e nao para `core/theme.toggleTema`) porque
 * o legado sobrescrevia `toggleTema` para redesenhar o icone do botao.
 */

import { instalarDelegacao, registrarAcoes } from '../core/actions';
import { alternarTema, initHome } from '../features/home/home';

registrarAcoes({ toggleTema: () => void alternarTema() });

instalarDelegacao();

void initHome();