/// <reference types="vite/client" />

/**
 * Tipos das variaveis de ambiente injetadas pelo Vite.
 *
 * `VITE_API_BASE` permite apontar o frontend web para um servidor local sem
 * alterar o codigo (ver `src/core/api.ts`). Aceita o token `same-origin`.
 *
 * `VITE_MODO_API` declara explicitamente qual camada de persistencia esta em
 * uso: `mock` (servidor Node em `server/`) ou `producao` (Spring Boot em
 * `backend/`). Opcional — sem ela o modo e inferido a partir da base.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_MODO_API?: 'mock' | 'producao';
  /**
   * Tempo maximo de espera da API em ms antes de cair no modo offline.
   * Valores <= 0 (ou ausente) usam o padrao de 12 s.
   */
  readonly VITE_API_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    /**
     * Modo de API injetado antes do bundle: `mock` (server/ em
     * `server/data/db.json`) ou `producao` (backend/ Spring Boot + Supabase).
     * Tem precedencia sobre `VITE_MODO_API` do build.
     */
    __CONECTA_MODO_API__?: 'mock' | 'producao';
  }
}