/**
 * Camada de acesso ao DOM tipada.
 *
 * O web legado escrevia `document.getElementById('x').value` diretamente.
 * Sob `strictNullChecks` isso gera milhares de erros porque
 * `getElementById` devolve `HTMLElement | null`.
 *
 * `byId` centraliza essa operacao e **preserva a semântica original**: o
 * codigo legado tambem nao verificava `null` — ele simplesmente lancava
 * `TypeError` ao acessar `.value` de `null`. Aqui o lancamento acontece com
 * uma mensagem explicita, o que e estritamente melhor para depuracao e nao
 * altera o fluxo normal de execucao.
 */

/** Erro lancado quando um elemento obrigatorio nao existe no documento. */
export class ElementoNaoEncontradoError extends Error {
  constructor(seletor: string) {
    super(`Elemento "#${seletor}" nao encontrado no documento.`);
    this.name = 'ElementoNaoEncontradoError';
  }
}

/**
 * Retorna o elemento pelo id, tipado como `T`.
 *
 * @param id id do elemento
 * @throws {ElementoNaoEncontradoError} quando o elemento nao existe
 */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) {
    throw new ElementoNaoEncontradoError(id);
  }
  return el as T;
}

/** Variante segura: devolve `null` em vez de lancar. */
export function tryById<T extends HTMLElement = HTMLElement>(
  id: string,
): T | null {
  return document.getElementById(id) as T | null;
}

/** `true` se o elemento existe. */
export function has(id: string): boolean {
  return document.getElementById(id) !== null;
}

/** Escreve `.textContent` (ignora elemento ausente). */
export function setText(id: string, valor: string): void {
  const el = tryById(id);
  if (el !== null) el.textContent = valor;
}

/** Esvazia um container (ignora elemento ausente). */
export function clear(id: string): void {
  const el = tryById(id);
  if (el !== null) el.innerHTML = '';
}

/**
 * `querySelectorAll` convertido em array tipado.
 *
 * Substitui o padrao legado `[].slice.call(document.querySelectorAll(sel))`.
 */
export function qsa<T extends Element = HTMLElement>(
  seletor: string,
  raiz: ParentNode = document,
): T[] {
  return Array.from(raiz.querySelectorAll(seletor)) as T[];
}

/** Anexa um listener a um elemento por id. */
export function on<K extends keyof HTMLElementEventMap>(
  id: string,
  tipo: K,
  handler: (ev: HTMLElementEventMap[K]) => void,
  opcoes?: AddEventListenerOptions,
): void {
  byId(id).addEventListener(tipo, handler as EventListener, opcoes);
}

/** `<div class="chip">` usado nos seletores de turno/dia. */
export function chip(valor: string, texto: string, ativo: boolean): HTMLDivElement {
  const c = document.createElement('div');
  c.className = 'chip' + (ativo ? ' ativo' : '');
  c.dataset.v = valor;
  c.textContent = texto;
  return c;
}

/** `<span class="bdg bdg-primary">` — usado em listagens de turno. */
export function badge(texto: string, variante = 'primary'): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `bdg bdg-${variante}`;
  s.textContent = texto;
  return s;
}

// ===========================================================================
//  Delegacao de eventos
// ===========================================================================

/**
 * Dados extraidos de um elemento pela delegacao.
 *
 * A chave e o nome do atributo; `null` significa que o elemento nao tem o
 * atributo (ou ele esta vazio). Os argumentos chegam como texto porque a
 * delegacao acontece no DOM e nao conhece os tipos das regras de negocio — quem
 * converte (`ContextoAcao.num`, por exemplo) e o registro de acoes.
 */
export type DadosDelegados = Readonly<Record<string, string | null>>;

/** Le `data-<nome>` de um elemento; devolve `null` quando ausente ou vazio. */
export function dadoDe(el: Element, nome: string): string | null {
  const bruto = el.getAttribute(`data-${nome}`);
  return bruto === null || bruto === '' ? null : bruto;
}

/**
 * Instala UM listener na raiz que atende todos os descendentes casando com
 * `seletor` — o padrao de *event delegation*.
 *
 * Substitui os N listeners que o codigo legado registrava por elemento e o
 * `onclick=` inline do HTML: elementos criados depois da carga (linhas de
 * tabela, cards, dias do calendario) passam a funcionar sem nenhum registro
 * adicional, porque a raiz nunca muda.
 *
 * `preventDefault` NAO e chamado: os handlers inline legados tambem nao o
 * faziam, e o comportamento padrao do botao (submit vs. button) precisa
 * continuar exatamente igual para nao alterar comportamento.
 *
 * @returns funcao que remove o listener instalado.
 */
export function delegar<T extends HTMLElement = HTMLElement>(
  raiz: HTMLElement | Document,
  evento: string,
  seletor: string,
  atributos: readonly string[],
  handler: (alvo: T, dados: DadosDelegados, ev: Event) => void,
): () => void {
  const ouvinte = (ev: Event): void => {
    const inicio = ev.target;
    if (!(inicio instanceof Element)) return;

    const encontrado = inicio.closest(seletor);
    if (!(encontrado instanceof HTMLElement)) return;
    // `closest` pode subir alem da raiz delegadora: nesse caso o elemento
    // pertence a outra arvore e nao e nosso alvo.
    if (raiz instanceof Element && !raiz.contains(encontrado)) return;

    const dados: Record<string, string | null> = {};
    for (const nome of atributos) dados[nome] = dadoDe(encontrado, nome);

    handler(encontrado as T, dados, ev);
  };

  raiz.addEventListener(evento, ouvinte);
  return () => raiz.removeEventListener(evento, ouvinte);
}

// ===========================================================================
//  Estreitamento seguro de tipos do DOM
// ===========================================================================

/** `el` como `<button>`, ou `null` quando o elemento nao e um botao. */
export function asButton(el: Element | null): HTMLButtonElement | null {
  return el instanceof HTMLButtonElement ? el : null;
}

/** `el` como `<input>` de qualquer tipo, ou `null`. */
export function asInput(el: Element | null): HTMLInputElement | null {
  return el instanceof HTMLInputElement ? el : null;
}

/** `el` como `<select>`, ou `null`. */
export function asSelect(el: Element | null): HTMLSelectElement | null {
  return el instanceof HTMLSelectElement ? el : null;
}