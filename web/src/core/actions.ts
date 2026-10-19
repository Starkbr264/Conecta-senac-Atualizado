/**
 * Registro de acoes + delegacao de eventos — substitui `core/globals.ts`.
 *
 * ## O que mudou em relacao a `globals.ts`
 *
 * Antes: cada entry fazia `Object.assign(window, modulo)` e o HTML resolvia
 * os handlers por atributo inline (`onclick="salvarSala()"`). Isso criava uma
 * superficie publica implicita: qualquer nome errado virava `undefined` em
 * runtime, e o TypeScript nao conseguia checar nada.
 *
 * Agora: os handlers sao registrados **explicitamente** por nome e acionados por
 * **delegacao de evento** a partir de atributos `data-*`. O HTML declara a
 * intencao (`data-action="salvarSala" data-arg="42"`) e o entry declara o
 * binding (`registrarAcao('editarSala', ...)`). Se um `data-action` nao tiver
 * contraparte registrada, o erro aparece no console em vez de sumir.
 *
 * ## Por que `data-action` e nao um listener por elemento
 *
 * Quase todos os elementos com handler sao gerados em runtime (linhas de
 * tabela, cards de sala, dias do calendario, chips de turno). Com listeners
 * por elemento seria necessario religar tudo apos cada render. A delegacao
 * resolve no documento e cobre o conteudo dinamico de graca, sem se preocupar
 * com quando o elemento nasce.
 *
 * ## Mapeamento 1:1 com o legado
 *
 * ```text
 * onclick="X()"            -> data-action="X"
 * onclick="X(7)"           -> data-action="X" data-arg="7"
 * onclick="X('abc')"       -> data-action="X" data-arg="abc"
 * onclick="f('rdY', this)" -> data-action="f" data-arg="rdY"
 *                             (o `this` vira `ContextoAcao.alvo`)
 * onclick="X(a,b)"         -> data-action="X" data-arg="a" data-arg2="b"
 * onchange="X()"           -> data-change="X"
 * oninput="X()"            -> data-input="X"
 * ```
 */

import { asButton, asInput, asSelect, delegar, dadoDe } from './dom';

/** Atributos lidos por TODAS as acoes delegadas, em ordem. */
export const ATRIBUTOS_DE_ARGUMENTO = ['arg', 'arg2', 'arg3'] as const;

/** Os tres eventos aos quais uma acao pode estar amarrada. */
const EVENTOS_DELEGADOS = ['click', 'change', 'input'] as const;

/** Nome do atributo de dados que carrega o nome da acao, por evento. */
const ATRIBUTO_POR_EVENTO: Readonly<Record<(typeof EVENTOS_DELEGADOS)[number], string>> = {
  click: 'action',
  change: 'change',
  input: 'input',
};

/**
 * Tudo que uma acao precisa saber sobre o disparo.
 *
 * E narrowing progressivo: `arg` para texto, `num` para identificadores
 * numericos, `botao`/`campo`/`seletor` para os tipos de elemento mais usados.
 * Nenhum campo e `any`.
 */
export interface ContextoAcao {
  /** Nome da acao, igual ao valor de `data-action` / `data-change` / `data-input`. */
  readonly nome: string;
  /** Elemento que disparou o evento (o `this` do handler inline legado). */
  readonly alvo: HTMLElement;
  /** Argumentos textuais, na ordem de `data-arg`, `data-arg2`, `data-arg3`. */
  readonly args: readonly string[];
  /** Primeiro argumento, ou `null`. */
  readonly arg: string | null;
  /** Primeiro argumento convertido para `number`, ou `null` se nao numerico. */
  readonly num: number | null;
  /** Segundo argumento, ou `null`. */
  readonly arg2: string | null;
  /** `alvo` como `<button>`; substitui o `this` legado. */
  readonly botao: HTMLButtonElement | null;
  /** `alvo` como `<input>`. */
  readonly campo: HTMLInputElement | null;
  /** `alvo` como `<select>`. */
  readonly seletor: HTMLSelectElement | null;
  /** Evento original, para quem precisar de `preventDefault` etc. */
  readonly evento: Event;
}

/**
 * Implementacao de uma acao.
 *
 * Pode devolver `Promise` porque `core/refresh.ts` precisa distinguir render
 * sincrono de render assincrono — comportamento esse que o legado mantinha
 * porque `atualizarSecao` inspecionava o valor de retorno da funcao.
 */
export type Acao = (ctx: ContextoAcao) => void | Promise<void>;

/** Registro unico por pagina: o bundle de cada pagina so carrega os seus. */
const REGISTRO = new Map<string, Acao>();

/** Delegacoes ja instaladas — evita instalar duas vezes o mesmo evento. */
const INSTALADAS = new Set<string>();

/** Registra (ou substitui) a acao de um `data-action`. */
export function registrarAcao(nome: string, acao: Acao): void {
  REGISTRO.set(nome, acao);
}

/** Registra varias acoes de uma vez. */
export function registrarAcoes(mapa: Readonly<Record<string, Acao>>): void {
  for (const [nome, acao] of Object.entries(mapa)) REGISTRO.set(nome, acao);
}

/** `true` quando existe uma acao registrada com esse nome. */
export function temAcao(nome: string): boolean {
  return REGISTRO.has(nome);
}

/** Devolve a acao ou `null`. */
export function obterAcao(nome: string): Acao | null {
  return REGISTRO.get(nome) ?? null;
}

/** Quantas acoes estao registradas (sanidade). */
export function totalDeAcoes(): number {
  return REGISTRO.size;
}

/** Nomes registrados, em ordem alfabetica (diagnostico). */
export function nomesDasAcoes(): string[] {
  return [...REGISTRO.keys()].sort();
}

function montarContexto(
  nome: string,
  alvo: HTMLElement,
  argumentos: readonly (string | null)[],
  evento: Event,
): ContextoAcao {
  const [arg = null, arg2 = null] = argumentos;
  const num =
    arg === null || arg.trim() === '' || !Number.isFinite(Number(arg)) ? null : Number(arg);

  return {
    nome,
    alvo,
    args: argumentos.filter((v): v is string => v !== null),
    arg,
    num,
    arg2,
    botao: asButton(alvo),
    campo: asInput(alvo),
    seletor: asSelect(alvo),
    evento,
  };
}

/**
 * Contexto sem elemento de origem, para acoes de render (`rdSalas`, `rdMapa`,
 * ...) chamadas por `core/refresh.ts` diretamente.
 */
export function contextoSemAlvo(nome: string): ContextoAcao {
  return montarContexto(nome, document.body, [null, null, null], new Event(nome));
}

/**
 * Executa uma acao pelo nome.
 *
 * Devolve `null` quando o nome nao existe, para que quem chama decida se isso e
 * erro (no ciclo de uma interacao) ou esperado (render condicional).
 */
export function executarAcao(
  nome: string,
  ctx: ContextoAcao,
): void | Promise<void> | null {
  const acao = REGISTRO.get(nome);
  if (!acao) return null;
  return acao(ctx);
}

/**
 * Instala os tres listeners delegadores.
 *
 * Idempotente: chamar duas vezes nao duplica os listeners.
 *
 * O `console.warn` existe de proposito: um `data-action` orfao no HTML nao
 * quebra a pagina (o legado tambem nao quebrava, apenas nao fazia nada), mas
 * agora deixa rastro em vez de sumir.
 */
export function instalarDelegacao(raiz: HTMLElement | Document = document): void {
  for (const evento of EVENTOS_DELEGADOS) {
    const atributo = ATRIBUTO_POR_EVENTO[evento];
    const chave = `${evento}:${raiz === document ? 'document' : 'raiz'}`;
    if (INSTALADAS.has(chave)) continue;
    INSTALADAS.add(chave);

    delegar<HTMLElement>(
      raiz,
      evento,
      `[data-${atributo}]`,
      ATRIBUTOS_DE_ARGUMENTO,
      (alvo, dados, ev) => {
        const nome = dadoDe(alvo, atributo);
        if (nome === null) return;

        const acao = REGISTRO.get(nome);
        if (!acao) {
          console.warn(
            `[acoes] data-${atributo}="${nome}" sem acao registrada em ` +
              `<${alvo.tagName.toLowerCase()}>. Verifique o entry da pagina.`,
          );
          return;
        }

        acao(
          montarContexto(
            nome,
            alvo,
            [dados['arg'] ?? null, dados['arg2'] ?? null, dados['arg3'] ?? null],
            ev,
          ),
        );
      },
    );
  }
}

/** Limpa o registro e o marcador de instalacao — usado apenas em teste. */
export function limparRegistro(): void {
  REGISTRO.clear();
  INSTALADAS.clear();
}