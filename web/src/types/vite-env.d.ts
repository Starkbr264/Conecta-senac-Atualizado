/// <reference types="vite/client" />

/**
 * Tipos das variaveis de ambiente injetadas pelo Vite.
 *
 * `VITE_API_BASE` permite apontar o frontend web para um servidor local sem
 * alterar o codigo (ver `src/core/api.ts`). Aceita o token `same-origin`.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  /**
   * Tempo maximo de espera da API em ms antes de cair no modo offline.
   * Valores <= 0 (ou ausente) usam o padrao de 25 s.
   */
  readonly VITE_API_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}