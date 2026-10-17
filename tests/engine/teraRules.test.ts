import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { teraAllowed } from '../../src/engine/formats';
import { emptySet, exportShowdown } from '../../src/engine/sets';

describe('Tera per formato', () => {
  it('ammesso in Ubers e Tutti; vietato in OU e UU', () => {
    expect(teraAllowed({ ...DEFAULT_FORMAT, formatId: 'ubers' })).toBe(true);
    expect(teraAllowed({ ...DEFAULT_FORMAT, formatId: 'all' })).toBe(true);
    expect(teraAllowed({ ...DEFAULT_FORMAT, formatId: 'ou' })).toBe(false);
    expect(teraAllowed({ ...DEFAULT_FORMAT, formatId: 'uu' })).toBe(false);
  });

  it('export senza Tera dove è vietato; di default resta (salvataggi)', () => {
    const team = [{ ...emptySet('Garchomp'), ability: 'Rough Skin', moves: ['Earthquake'], teraType: 'Steel' }];
    expect(exportShowdown(team)).toContain('Tera Type: Steel');
    expect(exportShowdown(team, { tera: false })).not.toContain('Tera Type');
  });
});
