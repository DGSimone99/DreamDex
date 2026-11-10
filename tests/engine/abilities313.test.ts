import { describe, expect, it } from 'vitest';
import { bestHit, OVERLORD_SHARE, PROTEAN_STAB } from '../../src/engine/damage';
import { hasPriorityAttack } from '../../src/engine/dex';
import { slowFactor } from '../../src/engine/speedArea';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, ability: string, moves: string[]): TeamSet =>
  ({ species, item: '', ability, moves, nature: 'Adamant', evs: { atk: 252, spe: 252, hp: 4 } });
const target = { species: 'Corviknight', item: '', ability: 'Pressure', moves: [], nature: 'Impish', evs: { hp: 252, def: 252 } } as TeamSet;

describe('controllo 2 punto 3.13', () => {
  it('Supreme Overlord: il danno di mezzo, ×1,25', () => {
    const on = bestHit(set('Kingambit', 'Supreme Overlord', ['Iron Head']), target)!;
    const off = bestHit(set('Kingambit', 'Defiant', ['Iron Head']), target)!;
    expect(on.expected / off.expected).toBeCloseTo(OVERLORD_SHARE, 2);
  });

  it('Libero: lo STAB in più delle mosse non del proprio tipo vale a metà', () => {
    const on = bestHit(set('Cinderace', 'Libero', ['High Jump Kick']), target)!;
    const off = bestHit(set('Cinderace', 'Blaze', ['High Jump Kick']), target)!;
    expect(on.expected / off.expected).toBeCloseTo(PROTEAN_STAB, 1);
    // Le mosse del proprio tipo non cambiano
    const fireOn = bestHit(set('Cinderace', 'Libero', ['Pyro Ball']), target)!;
    const fireOff = bestHit(set('Cinderace', 'Blaze', ['Pyro Ball']), target)!;
    expect(fireOn.expected).toBeCloseTo(fireOff.expected, 5);
  });

  it('Upper Hand non conta come priorità né come colpo', () => {
    const s = set('Kingambit', 'Defiant', ['Upper Hand']);
    expect(hasPriorityAttack(s)).toBe(false);
    expect(bestHit(s, target)).toBeNull();
    expect(hasPriorityAttack(set('Kingambit', 'Defiant', ['Sucker Punch']))).toBe(true);
  });

  it('Mud Shot, Pounce, Scary Face, Cotton Spore rallentano', () => {
    expect(slowFactor('Mud Shot', 'Garchomp')).toBeCloseTo(2 / 3);
    expect(slowFactor('Mud Shot', 'Corviknight')).toBe(1);
    expect(slowFactor('Pounce', 'Garchomp')).toBeCloseTo(2 / 3);
    expect(slowFactor('Scary Face', 'Garchomp')).toBe(0.5);
    expect(slowFactor('Scary Face', 'Hatterene', 'Magic Bounce')).toBe(1);
    expect(slowFactor('Cotton Spore', 'Garchomp')).toBe(0.5);
    expect(slowFactor('Cotton Spore', 'Rillaboom')).toBe(1);
  });
});
