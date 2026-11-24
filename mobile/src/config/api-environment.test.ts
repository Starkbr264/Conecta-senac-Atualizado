import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectarAmbiente,
  ehHostTeste,
  resolverApiUrl,
  validarUrl,
  HOSTS_TESTE,
  HOST_PRODUCAO_OFICIAL,
  HOST_PREVIEW_OFICIAL,
} from './api-environment.ts';

const PROD_URL = 'https://conecta-senac.onrender.com';
const TEST_URL = 'https://conecta-senac-test.onrender.com';
const LOCAL_URL = 'http://192.168.0.10:8081';

describe('detectarAmbiente', () => {
  test('buildProfile production e autoritativo', () => {
    assert.equal(detectarAmbiente(false, 'preview', 'preview', 'production'), 'production');
  });
  test('buildProfile preview e autoritativo', () => {
    assert.equal(detectarAmbiente(false, 'production', 'production', 'preview'), 'preview');
  });
  test('buildProfile development e autoritativo', () => {
    assert.equal(detectarAmbiente(false, 'production', 'production', 'development'), 'development');
  });
  test('sem buildProfile usa EXPO_PUBLIC_APP_ENV', () => {
    assert.equal(detectarAmbiente(false, undefined, 'preview'), 'preview');
  });
  test('sem buildProfile nem appEnv e isDev true -> development', () => {
    assert.equal(detectarAmbiente(true), 'development');
  });
  test('sem buildProfile nem appEnv e isDev false -> production (conservador)', () => {
    assert.equal(detectarAmbiente(false), 'production');
  });
});

describe('validarUrl', () => {
  test('aceita URL valida em development', () => {
    assert.deepEqual(validarUrl('http://192.168.0.10:8081', 'development'), { ok: true });
  });
  test('rejeita URL vazia', () => {
    assert.equal(validarUrl('', 'development').ok, false);
  });
  test('rejeita URL com espacos nas extremidades', () => {
    assert.equal(validarUrl(' ' + PROD_URL, 'development').ok, false);
  });
  test('rejeita URL malformada', () => {
    assert.equal(validarUrl('nao-e-url', 'development').ok, false);
  });
  test('rejeita protocolo invalido', () => {
    assert.equal(validarUrl('ftp://example.com', 'development').ok, false);
  });
  test('rejeita credenciais embutidas', () => {
    assert.equal(validarUrl('https://u:p@conecta-senac.onrender.com', 'production').ok, false);
  });
  test('rejeita hostname vazio', () => {
    assert.equal(validarUrl('https://', 'development').ok, false);
  });
  test('exige HTTPS em production', () => {
    assert.equal(validarUrl('http://conecta-senac.onrender.com', 'production').ok, false);
  });
  test('exige HTTPS em preview', () => {
    assert.equal(validarUrl('http://conecta-senac-test.onrender.com', 'preview').ok, false);
  });
  test('aceita HTTP em development', () => {
    assert.equal(validarUrl('http://localhost:8081', 'development').ok, true);
  });
  test('rejeita hostname desconhecido em production', () => {
    assert.equal(validarUrl('https://example.com', 'production').ok, false);
  });
  test('rejeita host de teste em production', () => {
    assert.equal(validarUrl(TEST_URL, 'production').ok, false);
  });
  test('aceita host oficial em production', () => {
    assert.equal(validarUrl(PROD_URL, 'production').ok, true);
  });
  test('rejeita host oficial em preview', () => {
    assert.equal(validarUrl(PROD_URL, 'preview').ok, false);
  });
  test('aceita host de teste em preview', () => {
    assert.equal(validarUrl(TEST_URL, 'preview').ok, true);
  });
});

describe('resolverApiUrl - casos obrigatorios', () => {
  // 1. Perfil production + variavel production + host oficial.
  test('1. production + production + host oficial', () => {
    const r = resolverApiUrl({ envUrl: PROD_URL, isDev: false, buildProfile: 'production', envAppEnv: 'production' });
    assert.equal(r.url, PROD_URL);
    assert.equal(r.ambiente, 'production');
  });

  // 2. Perfil production + variavel preview + host de teste -> deve rejeitar (contraditorio).
  test('2. production + preview + host de teste -> rejeita', () => {
    assert.throws(() => resolverApiUrl({ envUrl: TEST_URL, isDev: false, buildProfile: 'production', envAppEnv: 'preview' }), /contraditoria|invalida/i);
  });

  // 3. Perfil production + variavel preview + host oficial -> contraditorio (appEnv preview) rejeita.
  test('3. production + preview + host oficial -> rejeita contradicao', () => {
    assert.throws(() => resolverApiUrl({ envUrl: PROD_URL, isDev: false, buildProfile: 'production', envAppEnv: 'preview' }), /contraditoria/i);
  });

  // 4. Perfil preview + variavel production + host oficial -> contraditorio rejeita.
  test('4. preview + production + host oficial -> rejeita contradicao', () => {
    assert.throws(() => resolverApiUrl({ envUrl: PROD_URL, isDev: false, buildProfile: 'preview', envAppEnv: 'production' }), /contraditoria/i);
  });

  // 5. Perfil preview + variavel preview + host de teste.
  test('5. preview + preview + host de teste', () => {
    const r = resolverApiUrl({ envUrl: TEST_URL, isDev: false, buildProfile: 'preview', envAppEnv: 'preview' });
    assert.equal(r.url, TEST_URL);
    assert.equal(r.ambiente, 'preview');
  });

  // 6. Perfil preview + host desconhecido -> rejeita.
  test('6. preview + host desconhecido -> rejeita', () => {
    assert.throws(() => resolverApiUrl({ envUrl: 'https://example.com', isDev: false, buildProfile: 'preview', envAppEnv: 'preview' }), /invalida/i);
  });

  // 7. Perfil development + HTTP local explicito.
  test('7. development + HTTP local explicito', () => {
    const r = resolverApiUrl({ envUrl: 'http://192.168.0.10:8081', isDev: true, buildProfile: 'development' });
    assert.equal(r.url, 'http://192.168.0.10:8081');
    assert.equal(r.ambiente, 'development');
  });

  // 8. Perfil desconhecido/ausente em build que exige identidade EAS -> production conservador, sem config lanca.
  test('8. perfil ausente em build (nao dev) sem config -> erro', () => {
    assert.throws(() => resolverApiUrl({ isDev: false }), /obrigatorio/);
  });

  // 9. Expo Go local sem perfil EAS -> development, sem config lanca (sem descoberta).
  test('9. Expo Go local sem perfil sem config -> erro claro', () => {
    assert.throws(() => resolverApiUrl({ isDev: true }), /obrigatorio/);
  });

  // 10. Ausencia de variavel de URL (com extra ausente) -> erro.
  test('10. ausencia de URL -> erro', () => {
    assert.throws(() => resolverApiUrl({ isDev: false, buildProfile: 'production' }), /obrigatorio/);
  });

  // 11. URL malformada.
  test('11. URL malformada -> erro', () => {
    assert.throws(() => resolverApiUrl({ envUrl: 'nao-e-url', isDev: false, buildProfile: 'production' }), /invalida/);
  });

  // 12. Host de teste em production.
  test('12. host de teste em production -> erro', () => {
    assert.throws(() => resolverApiUrl({ envUrl: TEST_URL, isDev: false, buildProfile: 'production' }), /invalida/);
  });

  // 13. Host de producao em preview.
  test('13. host de producao em preview -> erro', () => {
    assert.throws(() => resolverApiUrl({ envUrl: PROD_URL, isDev: false, buildProfile: 'preview' }), /invalida/);
  });

  // 14. Preservacao dos contratos do cliente HTTP: resolver retorna apenas url/ambiente/fonte.
  test('14. resolver retorna apenas url/ambiente/fonte', () => {
    const r = resolverApiUrl({ envUrl: PROD_URL, isDev: false, buildProfile: 'production' });
    assert.deepEqual(Object.keys(r).sort(), ['ambiente', 'fonte', 'url']);
  });

  test('precedencia: env tem prioridade sobre extra', () => {
    const r = resolverApiUrl({ envUrl: PROD_URL, extraUrl: TEST_URL, isDev: false, buildProfile: 'production' });
    assert.equal(r.url, PROD_URL);
    assert.equal(r.fonte, 'env');
  });

  test('extra.apiUrl usado quando env ausente', () => {
    const r = resolverApiUrl({ extraUrl: PROD_URL, isDev: false, buildProfile: 'production' });
    assert.equal(r.url, PROD_URL);
    assert.equal(r.fonte, 'extra');
  });

  test('credenciais embutidas rejeitadas', () => {
    assert.throws(() => resolverApiUrl({ envUrl: 'https://u:p@conecta-senac.onrender.com', isDev: false, buildProfile: 'production' }), /invalida/);
  });

  test('HTTP em production rejeitado', () => {
    assert.throws(() => resolverApiUrl({ envUrl: 'http://conecta-senac.onrender.com', isDev: false, buildProfile: 'production' }), /invalida/);
  });
});

describe('HOSTS_TESTE', () => {
  test('contem o host de teste do Render', () => {
    assert.ok(HOSTS_TESTE.includes('conecta-senac-test.onrender.com'));
  });
});

describe('HOST_PRODUCAO_OFICIAL', () => {
  test('e o host comprovado do web em producao', () => {
    assert.equal(HOST_PRODUCAO_OFICIAL, 'conecta-senac.onrender.com');
  });
});