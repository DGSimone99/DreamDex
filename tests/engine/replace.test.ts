import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { diffContribution, improveReplacements } from '../../src/engine/replace';
import { mostCommonSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

const corviknight = mostCommonSet(fixtureStats, 'Corviknight')!;

describe('diffContribution', () => {
  it('Great Tusk → Corviknight accanto a Gholdengo', () => {
    const diff = diffContribution(tusk, corviknight, analyzeTeam([gholdengo], fixtureData), [gholdengo]);
    // I ruoli del diff sono solo le voci essenziali o importanti che mancano: il Pivot è minore, quindi non compare
    expect(diff.gains).toEqual({ roles: [], covers: ['Fighting', 'Bug'], resists: ['Ground'] });
    expect(diff.losses.covers).toContain('Fire');
    // Dopo il cambio nessuno resiste più a Buio: sta fra le resistenze uniche perse, non si ripete
    expect(diff.lostResists).toContain('Dark');
    expect(diff.losses.resists).not.toContain('Dark');
    expect(diff.losses.roles).not.toContain('removal');
  });
});

describe('improveReplacements', () => {
  const list = improveReplacements([tusk, gholdengo], 0, DEFAULT_FORMAT, fixtureData);

  it('esclude l\'originale e gli altri membri', () => {
    const names = list.map(r => r.species);
    expect(names).not.toContain('Great Tusk');
    expect(names).not.toContain('Gholdengo');
    expect(names).toContain('Corviknight');
  });

  it('ogni candidato ha un diff', () => {
    const corv = list.find(r => r.species === 'Corviknight')!.diff;
    expect(corv.gains.covers).toContain('Fighting');
    // Il Pivot è una voce minore: non è fra i ruoli guadagnati
    expect(corv.gains.roles).toEqual([]);
  });
});
