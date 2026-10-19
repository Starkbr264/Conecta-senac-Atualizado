/**
 * Reatualizacao de uma secao da tela.
 *
 * Extraido do antigo `storage.js` (funcao `atualizarSecao`) para evitar ciclo
 * de import: `storage.ts` nao precisa conhecer a UI e `ui.ts` nao conhece o
 * cache — este modulo e a ponte entre os dois.
 */

import { toast } from './ui';
import { loadCache } from './storage';
import { contextoSemAlvo, executarAcao, temAcao } from './actions';

/**
 * Executa `fnName` (acao registrada na pagina) com estado de carregamento.
 *
 * Antes o `fnName` era resolvido por `window[fnName]`; agora e resolvido pelo
 * registro de acoes (`core/actions.ts`). O nome continua sendo o mesmo nos
 * atributos `data-action="atualizarSecao" data-arg="rdSalas"`, entao nenhum
 * caller precisa mudar de sintaxe.
 *
 * @param fnName nome da acao registrada no entry da pagina.
 * @param botao  botao que disparou a acao (opcional; quando informado recebe
 *               o estado "Atualizando...")
 * @returns `false` quando a acao nao existe na pagina atual.
 */
export async function atualizarSecao(fnName: string, botao?: HTMLButtonElement | null): Promise<boolean> {
  if (!temAcao(fnName)) {
    toast('Atualizacao indisponivel nesta tela.', 'erro');
    console.warn(`[web] atualizarSecao: acao "${fnName}" nao registrada nesta pagina.`);
    return false;
  }

  let labelAnterior = '';
  const finalizar = (): void => {
    if (botao) {
      botao.disabled = false;
      botao.classList.remove('is-refreshing');
      botao.innerHTML = labelAnterior;
    }
  };

  if (botao) {
    labelAnterior = botao.innerHTML;
    botao.disabled = true;
    botao.classList.add('is-refreshing');
    botao.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Atualizando';
  }

  const atualizarIndicadores = (): void => {
    try {
      for (const nome of ['_atualizarBadge', '_atualizarBadges']) {
        if (temAcao(nome)) executarAcao(nome, contextoSemAlvo(nome));
      }
    } catch (err) {
      console.warn('[web] Falha ao atualizar indicadores:', err);
    }
  };

  try {
    loadCache();

    const resultado = executarAcao(fnName, contextoSemAlvo(fnName));

    if (resultado instanceof Promise) {
      await resultado;
      atualizarIndicadores();
      toast('Dados atualizados.', 'ok');
      finalizar();
      return true;
    }

    atualizarIndicadores();
    toast('Dados atualizados.', 'ok');
    setTimeout(finalizar, 220);
    return true;
  } catch (err) {
    console.error('[web] Erro ao atualizar secao:', err);
    toast('Nao foi possivel atualizar.', 'erro');
    finalizar();
    return false;
  }
}