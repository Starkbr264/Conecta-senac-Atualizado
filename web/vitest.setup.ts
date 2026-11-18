/**
 * Ambiente mínimo para testes unitários em Node (sem DOM real).
 *
 * `core/api.ts` resolve `API_BASE` no topo do módulo lendo
 * `window.__CONECTA_API_BASE__`, então o global `window` precisa existir
 * antes do primeiro import. O `location` cobre o sentinela `same-origin`.
 */
const janela = globalThis as typeof globalThis & { location?: { origin: string } };

if (!janela.location) {
  Object.defineProperty(janela, 'location', {
    configurable: true,
    value: { origin: 'http://localhost:5173' },
  });
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: globalThis,
});
