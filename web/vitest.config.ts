import { defineConfig } from 'vitest/config';

/**
 * Configuração dos testes unitários do frontend.
 *
 * Separa do `vite.config.ts` para não tocar na configuração de build.
 */
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
