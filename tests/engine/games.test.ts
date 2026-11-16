import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { gameOf, withGame } from '../../src/engine/games';
import { sanitizeFormat } from '../../src/storage';

describe('gioco nel formato', () => {
  it('il gioco blocca il formato su Gen 9 senza meta', () => {
    const f = withGame({ ...DEFAULT_FORMAT, formatId: 'ou', meta: true, genLimit: 7, allowMultipleMegas: true }, 'sv');
    expect(f).toMatchObject({ game: 'sv', formatId: 'gen9ag', meta: false, genLimit: 9, allowMultipleMegas: false, ignoreBans: false });
    expect(gameOf(f)).toBe('sv');
    expect(gameOf(DEFAULT_FORMAT)).toBeNull();
    expect(withGame({ ...f, allPokedex: true, legendaries: true }, null)).toMatchObject({ game: null, allPokedex: false, legendaries: false });
  });

  it('un gioco salvato rimette il suo blocco', () => {
    expect(sanitizeFormat({ formatId: 'ou', meta: true, game: 'sv', allPokedex: true, legendaries: 'x' }))
      .toMatchObject({ game: 'sv', formatId: 'gen9ag', meta: false, allPokedex: true, legendaries: false });
    expect(sanitizeFormat({ formatId: 'ou', game: 'pippo' })).toMatchObject({ game: null, formatId: 'ou', allPokedex: false, legendaries: false });
  });
});
