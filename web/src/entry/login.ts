/**
 * Pagina de login.
 *
 * O `login.html` nao possui nenhum atributo de evento: o formulario e ligado
 * por `addEventListener('submit')` dentro de `features/login/login.ts`. Ainda
 * assim a delegacao e instalada, para que acoes inseridas dinamicamente no
 * futuro sejam resolvidas.
 */

import { instalarDelegacao } from '../core/actions';
import { initLogin } from '../features/login/login';

instalarDelegacao();

void initLogin();