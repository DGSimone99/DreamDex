import { describe, expect, it } from 'vitest';
import { paletteFor } from '../../src/ui/theme';

describe('paletteFor', () => {
  it('segue il gioco: il Pokédex Gen 9 usa Scarlatto e Violetto', () => {
    for (const id of ['gen9ou', 'gen9ubers', 'gen9uu', 'gen9ag'] as const) expect(paletteFor('auto', id)).toBe('sv');
  });
  it('segue il gioco: National Dex e Senza limiti usano Spada e Scudo', () => {
    for (const id of ['ou', 'ubers', 'uu', 'all'] as const) expect(paletteFor('auto', id)).toBe('swsh');
  });
  it('una palette fissa vale per ogni formato', () => {
    expect(paletteFor('sv', 'ou')).toBe('sv');
    expect(paletteFor('swsh', 'gen9ou')).toBe('swsh');
  });
});
