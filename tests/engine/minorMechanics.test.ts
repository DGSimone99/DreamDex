import { describe, expect, it } from 'vitest';
import { isWebImmune } from '../../src/engine/speed';
import { hazardRemover, sustainParts } from '../../src/engine/defense';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet =>
  ({ species, item, ability, moves, nature: 'Serious', evs: {} });

describe('piccolezze di meccanica (1.28)', () => {
  it('Sticky Web: Clear Body e Mirror Armor immuni, Defiant e Competitive non rallentati', () => {
    expect(isWebImmune('Metagross', 'Clear Body', '')).toBe(true);
    expect(isWebImmune('Kingambit', 'Defiant', '')).toBe(true);
    expect(isWebImmune('Kingambit', 'Supreme Overlord', '')).toBe(false);
  });

  it('Magic Bounce conta come chi toglie gli hazard (dimezza lo Stealth Rock)', () => {
    expect(hazardRemover([set('Hatterene', 'Leftovers', 'Magic Bounce', ['Psyshock'])])).toBe('Magic Bounce (Hatterene)');
    expect(hazardRemover([set('Hatterene', 'Leftovers', 'Healer', ['Psyshock'])])).toBeNull();
  });

  it('Life Orb con Sheer Force: perdita solo per gli attacchi senza effetti secondari', () => {
    const nido = (moves: string[]) => set('Nidoking', 'Life Orb', 'Sheer Force', moves);
    expect(sustainParts(nido(['Earth Power', 'Sludge Wave']), 1).itemLoss).toBe(0);
    expect(sustainParts(nido(['Earth Power', 'Earthquake']), 1).itemLoss).toBeCloseTo(0.05, 5);
  });

  it('Grassy Terrain cura chi tocca terra, la sabbia logora chi non la evita', () => {
    const clef = set('Clefable', 'Leftovers', 'Unaware', ['Moonblast']);
    expect(sustainParts(clef, 1, null, ['grassyterrain']).recovery).toBeCloseTo(0.125, 5);
    expect(sustainParts(set('Corviknight', 'Leftovers', 'Pressure', ['Roost']), 1, null, ['grassyterrain']).sources).not.toContain('Grassy Terrain');
    expect(sustainParts(clef, 1, null, ['sand']).itemLoss).toBeCloseTo(0.0625, 5);
    expect(sustainParts(set('Tyranitar', 'Leftovers', 'Sand Stream', ['Stone Edge']), 1, null, ['sand']).itemLoss).toBe(0);
  });
});
