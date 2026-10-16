import { describe, expect, it } from 'vitest';
import { classifySwap, coachTeam, describeSwap, type CoachSwap } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

describe('livello delle sostituzioni', () => {
  it('consigliata da +10 punti di voto, possibile da +5, sotto nulla', () => {
    expect(classifySwap(10)).toBe('recommended');
    expect(classifySwap(9)).toBe('optional');
    expect(classifySwap(5)).toBe('optional');
    expect(classifySwap(4)).toBeNull();
  });

  it('un membro illegale ha sempre una sostituzione consigliata', () => {
    expect(classifySwap(0, true)).toBe('recommended');
    expect(classifySwap(-3, true)).toBe('recommended');
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

  it('vantaggi di una possibile raccomandazione', () => {
    const swap: CoachSwap = { index: 0, member: 'Great Tusk', fit: 50, replacement: 'Corviknight', set: emptySet('Corviknight'), score: 62, similar: false, ratingGain: 6,
      level: 'optional', diff: { gains: { roles: ['pivot' as const], covers: [], resists: [] }, losses: { roles: [], covers: [], resists: [] } } };
    expect(describeSwap(swap)).toEqual({ gain: 12, pros: ['Pivot'], cons: [] });
  });
});
