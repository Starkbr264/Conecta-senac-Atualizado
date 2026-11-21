import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  new URL('../public/css/phosphor.css', import.meta.url),
  'utf8',
);

describe('sistema de ícones da interface web', () => {
  it('não depende de emojis ou do quadrado de fallback', () => {
    expect(stylesheet).toContain('.ph::before { content: none; }');
    expect(stylesheet).not.toContain('\\25A1');
    expect(stylesheet).not.toMatch(/content:\s*"\\1F[0-9A-F]+"/i);
  });

  it('define ícones profissionais para os estados e ações das solicitações', () => {
    for (const icon of [
      'chat-circle-dots',
      'chat-text',
      'warning-circle',
      'check-circle',
      'wrench',
      'prohibit',
    ]) {
      expect(stylesheet).toMatch(new RegExp(`\\.ph-${icon}(?:[ ,{])`));
      expect(stylesheet).toContain(`--ph-icon-${icon}`);
    }
  });
});
