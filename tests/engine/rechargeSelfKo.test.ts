import { describe, expect, it } from 'vitest';
import { bestHit, RECHARGE_SHARE, SELF_KO_SHARE } from '../../src/engine/damage';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const clefable = set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast'], 'Bold', { hp: 252, def: 252 });

describe('mosse con ricarica e che mandano KO chi le usa', () => {
  it('Hyper Beam vale metà, Explosion un quarto', () => {
    const pz = (moves: string[]) => set('Porygon-Z', 'Choice Specs', 'Adaptability', moves, 'Modest', { spa: 252, spe: 252 });
    const beam = bestHit(pz(['Hyper Beam']), clefable)!;
    expect(beam.move).toBe('Hyper Beam');
    const gross = (m: string) => bestHit(set('Metagross', 'Choice Band', 'Clear Body', [m], 'Adamant', { atk: 252, spe: 252 }), clefable)!.expected;
    // Explosion 250 contro Double-Edge 120: senza la quota sarebbe circa il doppio
    expect(gross('Explosion')).toBeLessThan(gross('Double-Edge'));
    expect(RECHARGE_SHARE).toBe(0.5);
    expect(SELF_KO_SHARE).toBe(0.25);
    // Hyper Beam (150) a metà sta sotto Tri Attack (80) a pieno? 75 contro 80: sì
    expect(bestHit(pz(['Hyper Beam', 'Tri Attack']), clefable)!.move).toBe('Tri Attack');
  });
});
