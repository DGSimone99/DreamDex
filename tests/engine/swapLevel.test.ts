import { describe, expect, it } from 'vitest';
import { classifySwap, coachTeam, describeSwap, type CoachSwap } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

describe('livello delle sostituzioni', () => {
  it('consigliata se più di metà delle alternative si adatta meglio', () => {
    expect(classifySwap(0.51, 5)).toBe('recommended');
    expect(classifySwap(0.5, 5)).toBe('optional');
    expect(classifySwap(0.1, 5)).toBe('optional');
  });

  it('consigliata anche se la differenza è di almeno +25', () => {
    expect(classifySwap(0.1, 25)).toBe('recommended');
    expect(classifySwap(0.1, 24)).toBe('optional');
  });

  it('un membro inutile riceve una sostituzione consigliata', () => {
    const team: TeamSet[] = [tusk, gholdengo, { ...emptySet('Magikarp'), moves: ['Splash'] }];
    const swap = coachTeam(team, DEFAULT_FORMAT, fixtureData).swaps.find(s => s.member === 'Magikarp');
    expect(swap?.level).toBe('recommended');
  });

  it('le consigliate vengono prima delle possibili', () => {
    const swaps = coachTeam([tusk, gholdengo, { ...emptySet('Magikarp'), moves: ['Splash'] }], DEFAULT_FORMAT, fixtureData).swaps;
    const levels = swaps.map(s => s.level);
    expect(levels).toEqual([...levels].sort((a, b) => (a === b ? 0 : a === 'recommended' ? -1 : 1)));
  });

  it('testo di una possibile raccomandazione', () => {
    const swap: CoachSwap = { index: 0, member: 'Great Tusk', fit: 50, replacement: 'Corviknight', score: 62, similar: false,
      level: 'optional', diff: { gains: ['+ Pivot'], losses: [] } };
    expect(describeSwap(swap)).toBe('Great Tusk va già bene · in alternativa Corviknight si adatta meglio (+12): porta Pivot');
  });
});
