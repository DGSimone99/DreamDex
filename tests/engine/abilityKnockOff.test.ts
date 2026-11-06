import { describe, expect, it } from 'vitest';
import { memberOffense } from '../../src/engine/offense';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noStats = { stats: null, sets: null, formatId: 'ou' as const };

describe('gli strumenti dei bersagli dei tipi', () => {
  it('Knock Off contro i bersagli dei tipi conta ×1,5 (hanno uno strumento)', () => {
    const weavile = set('Weavile', 'Choice Band', 'Pressure', ['Knock Off'], 'Jolly', { atk: 252, spe: 252 });
    const crunch = { ...weavile, moves: ['Crunch'] };
    const pct = (s: TeamSet) => memberOffense(s, [s], noStats)!.hits.find(h => h.label === 'Psychic')!.pct;
    // Knock Off 65 × 1,5 = 97,5 contro Crunch 80
    expect(pct(weavile)).toBeGreaterThan(pct(crunch));
  });
});
