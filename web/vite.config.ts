import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Configuracao de build do frontend web do Conecta-Senac.
 *
 * Este projeto e uma **MPA** (multi-page application): 7 paginas HTML na raiz
 * de `web/`, cada uma com o seu proprio entry em `src/entry/`. O Vite nao
 * "descobre" paginas — elas precisam ser declaradas em `rollupOptions.input`,
 * e cada uma gera o seu proprio bundle em `dist/assets/`.
 *
 * - `base: './'` gera referencias relativas, de modo que o bundle funcione
 *   servido pela raiz, por um sub-diretorio ou dentro do jar do backend
 *   (`BOOT-INF/classes/static/`), em qualquer mount point.
 * - `publicDir: 'public'` expoe `public/css/` e `public/img/` copiados
 *   verbatim para `dist/`.
 * - O build grava em `dist/`, consumido pelo `Dockerfile` (injetado no jar do
 *   Spring Boot) e pelo servidor Node em modo mock.
 */

/**
 * Paginas do site. A ordem e a mesma dos `<script>` de bootstrap: cada HTML
 * carrega exatamente um entry.
 */
const PAGINAS = [
  'index',
  'login',
  'dashboard',
  'admin',
  'coordenador',
  'instrutor',
  'recepcao',
] as const;

type Pagina = (typeof PAGINAS)[number];

/**
 * Resolve um caminho relativo a raiz do projeto `web/`.
 *
 * `vite.config.ts` e um modulo ESM: `__dirname` nao existe. `import.meta.url`
 * aponta para o proprio arquivo — quando o Vite empacota o config, ele grava
 * o bundle temporario ao lado do original, entao o diretorio continua sendo a
 * raiz do projeto.
 */
function caminhoDaRaiz(...partes: string[]): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), ...partes);
}

/**
 * Falha cedo e com mensagem clara quando uma pagina (ou o seu entry) some.
 *
 * Sem esta checagem, a falha so apareceria no meio do `vite build`, com uma
 * mensagem generica do Rollup, difficultando o diagnostico.
 */
function validarPaginas(): void {
  const faltando: string[] = [];

  for (const pagina of PAGINAS) {
    const html = caminhoDaRaiz(`${pagina}.html`);
    if (!existsSync(html)) faltando.push(`${pagina}.html`);
  }

  for (const pagina of PAGINAS) {
    // `home.ts` inicializa a landing (`index.html`).
    const entry = pagina === 'index' ? 'home' : pagina;
    const ts = caminhoDaRaiz('src', 'entry', `${entry}.ts`);
    if (!existsSync(ts)) faltando.push(`src/entry/${entry}.ts`);
  }

  if (faltando.length > 0) {
    throw new Error(
      `web: arquivos obrigatorios ausentes no projeto:\n  - ${faltando.join(
        '\n  - ',
      )}\nVerifique a raiz do projeto (web/) e as paginas declaradas em vite.config.ts.`,
    );
  }
}

validarPaginas();

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    // 7 paginas estaticas + CSS + JS
    rollupOptions: {
      input: Object.fromEntries(
        PAGINAS.map((pagina: Pagina) => [pagina, caminhoDaRaiz(`${pagina}.html`)]),
      ) as Record<Pagina, string>,
    },
  },
  server: {
    port: 5173,
    // `host: true` expoe o dev server na rede local — necessario para
    // testar no celular do laboratorio sem republicar a porta.
    host: true,
    strictPort: false,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
