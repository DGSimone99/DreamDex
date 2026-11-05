import { describe, expect, it } from 'vitest';
import { bestHit } from '../../src/engine/damage';
import { memberOffense } from '../../src/engine/offense';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });

const noStats = { stats: null, sets: null, formatId: 'ou' as const };
const clefable = set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast', 'Soft-Boiled'], 'Bold', { hp: 252, def: 252 });
const tusk = (item: string) => set('Great Tusk', item, 'Protosynthesis', ['Headlong Rush', 'Close Combat'], 'Jolly', { atk: 252, spe: 252 });
const valiant = (item: string) => set('Iron Valiant', item, 'Quark Drive', ['Moonblast', 'Psyshock'], 'Modest', { spa: 252, spe: 252 });
const treads = (item: string) => set('Iron Treads', item, 'Quark Drive', ['Earthquake'], 'Impish', { hp: 252, def: 252 });
const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume', 'Rapid Spin'], 'Bold', { hp: 252, def: 252 });
const pincurchin = set('Pincurchin', 'Terrain Extender', 'Electric Surge', ['Spikes', 'Discharge'], 'Bold', { hp: 252, def: 252 });

describe('Protosynthesis e Quark Drive alzano la statistica più alta (×1,3, la Velocità a parte)', () => {
  it('con la Booster Energy il colpo di Great Tusk fa ~30% in più', () => {
    const boosted = bestHit(tusk('Booster Energy'), clefable)!.expected;
    const plain = bestHit(tusk('Leftovers'), clefable)!.expected;
    expect(boosted / plain).toBeGreaterThan(1.25);
    expect(boosted / plain).toBeLessThan(1.35);
  });

  it('Quark Drive con la Booster alza l\'Attacco Speciale di Iron Valiant', () => {
    expect(bestHit(valiant('Booster Energy'), clefable)!.expected).toBeGreaterThan(1.25 * bestHit(valiant('Leftovers'), clefable)!.expected);
  });

  it('senza Booster: il sole accende Protosynthesis, il campo elettrico Quark Drive', () => {
    expect(bestHit(tusk('Leftovers'), clefable, { conditions: ['sun'] })!.expected).toBeGreaterThan(1.25 * bestHit(tusk('Leftovers'), clefable)!.expected);
    expect(bestHit(valiant('Leftovers'), clefable, { conditions: ['electricterrain'] })!.expected).toBeGreaterThan(1.25 * bestHit(valiant('Leftovers'), clefable)!.expected);
    // Il campo sbagliato non conta
    expect(bestHit(tusk('Leftovers'), clefable, { conditions: ['electricterrain'] })!.expected).toBe(bestHit(tusk('Leftovers'), clefable)!.expected);
  });

  it('anche in difesa: Iron Treads con la Booster (Difesa più alta) prende meno danni', () => {
    const attacker = set('Garchomp', 'Life Orb', 'Rough Skin', ['Stone Edge'], 'Adamant', { atk: 252, spe: 252 });
    expect(bestHit(attacker, treads('Booster Energy'))!.expected).toBeLessThan(0.8 * bestHit(attacker, treads('Leftovers'))!.expected);
  });

  it('nel team: Booster pieno, sole di un compagno a metà, niente senza nessuno dei due', () => {
    const team = (member: TeamSet, mate: TeamSet) => [member, mate];
    const damage = (member: TeamSet, mate: TeamSet) =>
      memberOffense(member, team(member, mate), noStats)!.hits.reduce((a, h) => a + h.pct, 0);
    const none = damage(tusk('Leftovers'), pincurchin);
    const half = damage(tusk('Leftovers'), torkoal);
    const full = damage(tusk('Booster Energy'), pincurchin);
    expect(half).toBeGreaterThan(none);
    expect(full).toBeGreaterThan(half);
    // Il sole del compagno vale circa metà della Booster (il 50% dei casi col sole)
    expect((half - none) / (full - none)).toBeGreaterThan(0.35);
    expect((half - none) / (full - none)).toBeLessThan(0.65);
  });
});
