import { describe, expect, it } from 'vitest';
import { bestHit, orbStatus } from '../../src/engine/damage';
import { sustainParts } from '../../src/engine/defense';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });

const clefable = set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast'], 'Bold', { hp: 252, def: 252 });
const conk = (item: string, ability = 'Guts') => set('Conkeldurr', item, ability, ['Facade', 'Mach Punch'], 'Adamant', { hp: 252, atk: 252 });
const gliscor = (item: string) => set('Gliscor', item, 'Poison Heal', ['Earthquake', 'Protect'], 'Impish', { hp: 252, def: 252 });

describe('Flame Orb e Toxic Orb: lo stato che il membro si dà da solo', () => {
  it('chi ne è immune per tipo o abilità non prende lo stato', () => {
    expect(orbStatus(conk('Flame Orb'))).toBe('brn');
    expect(orbStatus(gliscor('Toxic Orb'))).toBe('tox');
    expect(orbStatus(set('Heatran', 'Flame Orb', 'Flash Fire', [], 'Calm', {}))).toBeNull();
    expect(orbStatus(set('Toxapex', 'Toxic Orb', 'Regenerator', [], 'Bold', {}))).toBeNull();
    expect(orbStatus(set('Corviknight', 'Toxic Orb', 'Pressure', [], 'Impish', {}))).toBeNull();
    expect(orbStatus(set('Dewgong', 'Flame Orb', 'Water Veil', [], 'Bold', {}))).toBeNull();
    expect(orbStatus(set('Garganacl', 'Toxic Orb', 'Purifying Salt', [], 'Careful', {}))).toBeNull();
    expect(orbStatus(conk('Leftovers'))).toBeNull();
  });

  it('Guts + Flame Orb: Facade raddoppia e il bruciore non dimezza l\'Attacco', () => {
    const orb = bestHit(conk('Flame Orb'), clefable)!.expected;
    const plain = bestHit(conk('Leftovers'), clefable)!.expected;
    // Facade ×2 e Guts ×1,5 = ×3
    expect(orb / plain).toBeGreaterThan(2.7);
  });

  it('senza Guts il bruciore dimezza l\'Attacco fisico (Facade raddoppia: pari)', () => {
    const noGuts = (item: string) => ({ ...conk(item, 'Iron Fist'), moves: ['Drain Punch'] });
    expect(bestHit(noGuts('Flame Orb'), clefable)!.expected).toBeLessThan(0.6 * bestHit(noGuts('Leftovers'), clefable)!.expected);
  });

  it('Sostenibilità: Poison Heal + Toxic Orb cura, il bruciore toglie 1/16, Heatproof la metà, gli immuni niente', () => {
    const glis = sustainParts(gliscor('Toxic Orb'), 1);
    expect(glis.recovery).toBe(0.125);
    expect(glis.itemLoss).toBe(0);
    // Senza Toxic Orb Poison Heal non cura
    expect(sustainParts(gliscor('Leftovers'), 1).sources).not.toContain('Poison Heal');
    expect(sustainParts(conk('Flame Orb'), 1).itemLoss).toBe(0.0625);
    expect(sustainParts(set('Bronzong', 'Flame Orb', 'Heatproof', [], 'Relaxed', {}), 1).itemLoss).toBe(0.03125);
    expect(sustainParts(set('Dewgong', 'Flame Orb', 'Water Veil', [], 'Bold', {}), 1).itemLoss).toBe(0);
    expect(sustainParts(set('Garganacl', 'Toxic Orb', 'Purifying Salt', [], 'Careful', {}), 1).itemLoss).toBe(0);
  });
});
