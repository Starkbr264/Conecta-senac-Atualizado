/**
 * Resolucao centralizada do endereco-base da API mobile.
 *
 * Modulo PURO (sem dependencias do Expo/React Native) para ser testavel
 * com o test runner nativo do Node (node:test) e reutilizavel.
 * A leitura das fontes reais (process.env e Constants.expoConfig.extra)
 * fica em services/api.ts.
 *
 * Identidade do build:
 *   - buildProfile (Constants.expoConfig.extra.buildProfile) e a fonte
 *     AUTORITATIVA: vem de app.config.js, que le EAS_BUILD_PROFILE no
 *     servidor de build do EAS. Nao e uma variavel EXPO_PUBLIC_.
 *   - EXPO_PUBLIC_APP_ENV e apenas verificacao de coerencia.
 *   - isDev (__DEV__) e fallback para execucao local (Expo Go).
 *
 * Regras:
 *  - Sem descoberta automatica de host.
 *  - 'development': aceita HTTP (incl. IP local e localhost).
 *  - 'preview': exige HTTPS e host de teste (conecta-senac-test.onrender.com).
 *  - 'production': exige HTTPS e host oficial (conecta-senac.onrender.com).
 *  - URLs malformadas, com credenciais, vazias ou com espacos sao rejeitadas.
 */

export type AmbienteApi = 'development' | 'preview' | 'production';

export type FonteApi = 'env' | 'extra';

export type ResolverInput = {
  envUrl?: string;
  extraUrl?: string;
  appEnv?: string;       // EXPO_PUBLIC_APP_ENV (verificacao de coerencia)
  envAppEnv?: string;    // EXPO_PUBLIC_APP_ENV
  buildProfile?: string; // extra.buildProfile (autoritativo, do app.config.js/EAS)
  isDev: boolean;
};

export type ResolverResult = {
  url: string;
  ambiente: AmbienteApi;
  fonte: FonteApi;
};

/** Hosts que NUNCA devem ser usados em build de producao. */
export const HOSTS_TESTE: readonly string[] = [
  'conecta-senac-test.onrender.com',
];

/** Hostname oficial do backend em producao (comprovado em web/src/core/api.ts). */
export const HOST_PRODUCAO_OFICIAL = 'conecta-senac.onrender.com';

/** Hostname esperado em preview. */
export const HOST_PREVIEW_OFICIAL = 'conecta-senac-test.onrender.com';

export function detectarAmbiente(
  isDev: boolean,
  appEnv?: string,
  envAppEnv?: string,
  buildProfile?: string,
): AmbienteApi {
  // 1. buildProfile (autoritativo, do EAS/app.config.js) tem prioridade.
  const bp = (buildProfile || '').trim().toLowerCase();
  if (bp === 'production') return 'production';
  if (bp === 'preview') return 'preview';
  if (bp === 'development') return 'development';

  // 2. EXPO_PUBLIC_APP_ENV como verificacao de coerencia.
  const env = (envAppEnv || appEnv || '').trim().toLowerCase();
  if (env === 'preview') return 'preview';
  if (env === 'production') return 'production';
  if (env === 'development') return 'development';

  // 3. Fallback local (Expo Go).
  if (isDev) return 'development';

  // 4. Default conservador.
  return 'production';
}

export function ehHostTeste(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return HOSTS_TESTE.some((h) => host === h || host.endsWith('.' + h));
}

export type ValidacaoResult = { ok: true } | { ok: false; motivo: string };

export function validarUrl(url: string, ambiente: AmbienteApi): ValidacaoResult {
  const trimmed = (url || '').trim();
  if (trimmed === '') return { ok: false, motivo: 'URL vazia' };
  if (trimmed !== url) return { ok: false, motivo: 'URL contem espacos nas extremidades' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, motivo: 'URL malformada' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, motivo: 'Protocolo invalido (apenas http/https)' };
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, motivo: 'Credenciais embutidas na URL nao sao permitidas' };
  }
  if (parsed.hostname === '') {
    return { ok: false, motivo: 'Hostname ausente' };
  }

  if (ambiente === 'preview' || ambiente === 'production') {
    if (parsed.protocol !== 'https:') {
      return { ok: false, motivo: 'HTTPS obrigatorio em ' + ambiente };
    }
  }

  if (ambiente === 'production') {
    if (parsed.hostname.toLowerCase() !== HOST_PRODUCAO_OFICIAL) {
      return { ok: false, motivo: 'Hostname nao autorizado em producao: ' + parsed.hostname };
    }
  }

  if (ambiente === 'preview') {
    if (parsed.hostname.toLowerCase() !== HOST_PREVIEW_OFICIAL) {
      return { ok: false, motivo: 'Hostname nao autorizado em preview: ' + parsed.hostname };
    }
  }

  return { ok: true };
}

export function resolverApiUrl(input: ResolverInput): ResolverResult {
  const ambiente = detectarAmbiente(input.isDev, input.appEnv, input.envAppEnv, input.buildProfile);

  // Coerencia: buildProfile autoritativo prevalece sobre EXPO_PUBLIC_APP_ENV.
  const bp = (input.buildProfile || '').trim().toLowerCase();
  const declaredEnv = (input.envAppEnv || input.appEnv || '').trim().toLowerCase();
  if (bp === 'production' && declaredEnv === 'preview') {
    throw new Error('Configuracao contraditoria: build production com EXPO_PUBLIC_APP_ENV=preview.');
  }
  if (bp === 'preview' && declaredEnv === 'production') {
    throw new Error('Configuracao contraditoria: build preview com EXPO_PUBLIC_APP_ENV=production.');
  }

  const envUrl = input.envUrl?.trim();
  const extraUrl = input.extraUrl?.trim();

  if (envUrl) {
    const v = validarUrl(envUrl, ambiente);
    if (!v.ok) throw new Error('EXPO_PUBLIC_API_URL invalida: ' + v.motivo);
    return { url: envUrl, ambiente, fonte: 'env' };
  }

  if (extraUrl) {
    const v = validarUrl(extraUrl, ambiente);
    if (!v.ok) throw new Error('extra.apiUrl invalida: ' + v.motivo);
    return { url: extraUrl, ambiente, fonte: 'extra' };
  }

  // Sem configuracao explicita: erro claro em todos os ambientes.
  throw new Error(
    'EXPO_PUBLIC_API_URL (ou extra.apiUrl no app.json) e obrigatorio em ambiente ' +
      ambiente +
      '. Defina-o explicitamente antes de gerar o build.',
  );
}