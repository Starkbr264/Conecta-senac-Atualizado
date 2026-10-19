/**
 * Utilitarios de busca e filtro usados nas tabelas das paginas.
 *
 * Conversao tipada do antigo `search.js`. As funcoes continuam sendo
 * registradas no `window` porque o HTML gerado por `htmlBarraBusca` /
 * `montarBarraPesquisaFiltros` gera os botoes com `data-action="limparFiltros"` e
 */

import { esc } from './format';

/** Campo indexavel de uma linha, ou funcao que extrai o valor a buscar. */
export type CampoBusca<T> = keyof T | ((item: T) => unknown);

/** Descricao de um filtro exibido como `<select>`. */
export interface FiltroSelect {
  id: string;
  label: string;
  opcoes: Array<{ value: string | number; label: string }>;
  /** Campo usado ao ler o valor; quando ausente usa `id`. */
  campo?: string;
}

/** Configuracao da barra de busca + filtros. */
export interface ConfigBarraFiltros {
  busca?: { id: string; placeholder?: string };
  filtros?: FiltroSelect[];
  mostrarBotaoLimpar?: boolean;
}

/** Valores lidos de uma barra de filtros. */
export type ValoresFiltro = Record<string, string>;

/**
 * Filtra `lista` por um termo livre, procurando em `campos`.
 *
 * Termo vazio devolve a lista original (mesma referencia) — comportamento do
 * legado preservado.
 */
export function filtrarLista<T>(lista: T[], termo: string | null | undefined, campos: Array<CampoBusca<T>>): T[] {
  if (!termo || !termo.trim()) return lista;

  const alvo = termo.trim().toLowerCase();

  return lista.filter((item) =>
    campos.some((c) => {
      const valor = typeof c === 'function' ? c(item) : ((item as Record<string, unknown>)[c as string] ?? '');
      return String(valor).toLowerCase().includes(alvo);
    }),
  );
}

/**
 * Aplica filtros de igualdade exata.
 *
 * Um filtro vazio (`''`) e um valor `0` sao ignorados (considerados
 * "Todos") — comportamento identico ao legado.
 */
export function aplicarFiltros<T>(lista: T[], filtros: ValoresFiltro): T[] {
  const chaves = Object.keys(filtros);

  return lista.filter((item) =>
    chaves.every((k) => {
      const v = filtros[k];
      if (!v && v !== '0') return true;
      return String((item as Record<string, unknown>)[k]) === String(v);
    }),
  );
}

/** HTML da barra de busca livre (com botao de limpar). */
export function htmlBarraBusca(placeholder: string, inputId: string): string {
  return (
    '<div class="search-bar"><span class="search-icon"><i class="ph ph-magnifying-glass"></i></span>' +
    `<input type="text" id="${inputId}" class="search-input" placeholder="${esc(placeholder)}" autocomplete="off">` +
    `<button class="search-clear" data-action="limparCampoBusca" data-arg="${inputId}" title="Limpar"><i class="ph ph-x"></i></button>` +
    '</div>'
  );
}

/** HTML de um `<select>` de filtro. */
export function htmlFiltroSelect(id: string, label: string, opcoes: FiltroSelect['opcoes']): string {
  const opts =
    '<option value="">Todos</option>' +
    opcoes
      .map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`)
      .join('');

  return (
    '<div class="filter-item">' +
    `<label class="filter-label">${esc(label)}</label>` +
    `<select id="${id}" class="filter-select">${opts}</select>` +
    '</div>'
  );
}

/**
 * Monta a barra de busca + filtros dentro de `containerId` e liga o callback
 * de atualizacao nos eventos `input`/`change`.
 */
export function montarBarraPesquisaFiltros(
  containerId: string,
  config: ConfigBarraFiltros,
  onUpdate?: () => void,
): void {
  const cont = document.getElementById(containerId);
  if (!cont) return;

  let html = '<div class="search-filter-bar">';

  if (config.busca) {
    html += htmlBarraBusca(config.busca.placeholder || 'Pesquisar…', config.busca.id);
  }

  if (config.filtros && config.filtros.length) {
    html += '<div class="filters-row">';
    config.filtros.forEach((f) => {
      html += htmlFiltroSelect(f.id, f.label, f.opcoes);
    });

    if (config.mostrarBotaoLimpar !== false) {
      html +=
        `<button class="btn btn-ghost btn-sm" style="align-self:flex-end" data-action="limparFiltros" data-arg="${containerId}" data-arg2="${config.busca ? config.busca.id : ''}">Limpar filtros</button>`;
    }

    html += '</div>';
  }

  html += '</div>';
  cont.innerHTML = html;

  const dispararUpdate = (): void => {
    if (typeof onUpdate === 'function') onUpdate();
  };

  if (config.busca) {
    const inp = document.getElementById(config.busca.id);
    if (inp) inp.addEventListener('input', dispararUpdate);
  }

  if (config.filtros) {
    config.filtros.forEach((f) => {
      const sel = document.getElementById(f.id);
      if (sel) sel.addEventListener('change', dispararUpdate);
    });
  }
}

/** Limpa todos os `<select>` da barra e dispara a busca novamente. */
export function limparFiltros(containerId: string, buscaId?: string): void {
  const cont = document.getElementById(containerId);
  if (!cont) return;

  cont.querySelectorAll('select').forEach((s) => {
    (s as HTMLSelectElement).value = '';
  });

  if (buscaId) {
    const inp = document.getElementById(buscaId) as HTMLInputElement | null;
    if (inp) {
      inp.value = '';
      inp.dispatchEvent(new Event('input'));
      return;
    }
  }

  const inp2 = cont.querySelector('input') as HTMLInputElement | null;
  if (inp2) inp2.dispatchEvent(new Event('input'));
}

/**
 * Le os valores atuais da barra.
 *
 * O termo livre vem na chave reservada `_busca`; cada filtro usa `campo`
 * quando informado, senao o proprio `id`.
 */
export function lerFiltros(config: ConfigBarraFiltros): ValoresFiltro {
  const resultado: ValoresFiltro = {};

  if (config.busca) {
    const inp = document.getElementById(config.busca.id) as HTMLInputElement | null;
    resultado._busca = inp ? inp.value : '';
  }

  if (config.filtros) {
    config.filtros.forEach((f) => {
      const sel = document.getElementById(f.id) as HTMLSelectElement | null;
      resultado[f.campo || f.id] = sel ? sel.value : '';
    });
  }

  return resultado;
}