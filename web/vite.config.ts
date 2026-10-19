import { defineConfig } from 'vite';

/**
 * Configuracao de build do frontend web do Conecta-Senac.
 *
 * - `base: './'` gera referencias relativas, de modo que o bundle funcione
 *   servido pela raiz, por um sub-diretorio ou aberto via file://.
 * - `publicDir: 'public'` expoe `public/img/` em `/img/...`.
 * - O build grava em `dist/`, que e o diretorio servido pelo servidor Node
 *   (pasta /server, variavel WEB_ROOT).
 */
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
      input: {
        index: 'index.html',
        login: 'login.html',
        dashboard: 'dashboard.html',
        admin: 'admin.html',
        coordenador: 'coordenador.html',
        instrutor: 'instrutor.html',
        recepcao: 'recepcao.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});