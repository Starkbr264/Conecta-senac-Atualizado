/**
 * Acoes compartilhadas pelas paginas da aplicacao (admin, coordenador,
 * instrutor e recepcao).
 *
 * O web usava `<script>` classicos que publicavam funcoes em `window`, e o
 * HTML as chamava por `onclick="..."`. Isso e ruim por tres motivos:
 * o navegador resolve o nome no escopo global (funciona, mas invisivel para o
 * compilador), a string do handler nao e verificada, e nao da para tipar o
 * argumento. Aqui cada acao vira uma entrada de registro tipada e o HTML
 * declara apenas `data-action="nome"` mais os argumentos em `data-arg`,
 * `data-arg2`, ... O `ContextoAcao` entregue ao handler carrega o elemento que
 * disparou (`alvo`), o que substitui o antigo `this`.
 *
 * Este modulo registra apenas o que e identico em todas as paginas. Cada
 * `entry/<pagina>.ts` registra o restante.
 */

import { registrarAcao } from './actions';
import { sair } from './auth';
import { limparFiltros } from './filters';
import { atualizarSecao } from './refresh';
import { modalFechar } from './ui';
import { asInput } from './dom';
import { toggleTema } from './theme';
import {
  calAnterior,
  calDia,
  calFiltrar,
  calHoje,
  calProximo,
  calVista,
  rdCalendario,
} from '../features/calendario/calendario';

/**
 * Recebe o que muda de pagina para pagina.
 *
 * `ir` e o unico item realmente variavel: cada feature tem a sua versao do
 * menu lateral, com as suas abas — o `dashboard.html` nem sequer tem menu, por
 * isso o campo e opcional. `atualizarBadge` e `atualizarBadges` sao chamados
 * por `refresh.atualizarSecao` depois de cada recarga; tambem opcionais porque
 * nem toda pagina tem indicador na barra lateral.
 */
export interface ContextoAcoesComuns {
  /** Troca de aba. No legado era a funcao `ir` exportada pela feature. */
  ir?: (aba: string) => void;
  /** Atualiza o contador de notificacoes da barra lateral, quando existir. */
  atualizarBadge?: () => void;
  /** Atualiza os contadores (notificacoes e solicitacoes) da pagina. */
  atualizarBadges?: () => void;
}

/**
 * Registra o conjunto de acoes que as quatro paginas internas compartilham.
 *
 * Os nomes sao propositalmente iguais aos das funcoes legadas: assim o HTML
 * continua legivel e a busca por `data-action="salvarSala"` leva direto ao
 * ponto do codigo que salva a sala.
 */
export function registrarAcoesComuns(ctx: ContextoAcoesComuns): void {
  registrarAcao('sair', sair);
  registrarAcao('toggleTema', () => {
    toggleTema();
  });
  if (ctx.ir) registrarAcao('ir', ({ arg }) => {
    ctx.ir?.(arg ?? 'dashboard');
    document.body.classList.remove('sidebar-aberta');
  });

  // `atualizarSecao('rdSalas', this)`: o `this` legado era o botao, que agora
  // vem no contexto como `botao`.
  registrarAcao('atualizarSecao', ({ arg, botao }) => {
    void atualizarSecao(arg ?? '', botao);
  });

  registrarAcao('modalFechar', ({ arg }) => {
    if (arg) modalFechar(arg);
  });

  registrarAcao('calAnterior', () => calAnterior());
  registrarAcao('calDia', ({ arg }) => { if (arg) calDia(arg); });
  registrarAcao('calProximo', () => calProximo());
  registrarAcao('calHoje', () => calHoje());
  registrarAcao('calVista', ({ arg }) => calVista(arg ?? 'mes'));
  registrarAcao('calFiltrar', () => calFiltrar());
  registrarAcao('rdCalendario', rdCalendario);
  registrarAcao('toggleSidebar', () => {
    document.body.classList.toggle('sidebar-aberta');
  });

  // Gerado em tempo de execucao por `core/filters.ts`.
  registrarAcao('limparFiltros', ({ arg, arg2 }) => limparFiltros(arg ?? '', arg2 ?? undefined));
  registrarAcao('limparCampoBusca', ({ arg }) => {
    if (!arg) return;
    const campo = asInput(document.getElementById(arg));
    if (campo === null) return;
    campo.value = '';
    // Dispara `input` para que o `onUpdate` da barra seja chamado.
    campo.dispatchEvent(new Event('input'));
  });

  // Chamados por `core/refresh.ts` no fim de cada `atualizarSecao`. Registrados
  // com o prefixo legado (`_`) porque e assim que o proprio refresh os procura.
  if (ctx.atualizarBadge) registrarAcao('_atualizarBadge', ctx.atualizarBadge);
  if (ctx.atualizarBadges) registrarAcao('_atualizarBadges', ctx.atualizarBadges);
}
