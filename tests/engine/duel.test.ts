import { describe, expect, it } from 'vitest';
import { bestHit } from '../../src/engine/damage';
import { duel, fieldSpeed, hitsToKO } from '../../src/engine/duel';
import { emptySet, type TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: Partial<TeamSet['evs']>): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...evs } });

const regieleki = set('Regieleki', 'Choice Specs', 'Transistor', ['Thunderbolt'], 'Timid', { spa: 252, spe: 252 });
const gyarados = set('Gyarados', 'Leftovers', 'Intimidate', ['Waterfall'], 'Jolly', { atk: 252, spe: 252 });
const tyranitar = set('Tyranitar', 'Choice Band', 'Sand Stream', ['Stone Edge'], 'Adamant', { hp: 252, atk: 252 });
const volcarona = set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Fiery Dance'], 'Timid', { spa: 252, spe: 252 });
const garchomp = set('Garchomp', 'Life Orb', 'Rough Skin', ['Outrage', 'Earthquake'], 'Jolly', { atk: 252, spe: 252 });

describe('duello con una minaccia', () => {
  it('colpi per il KO dal danno medio', () => {
    expect(hitsToKO(1)).toBe(1);
    expect(hitsToKO(0.5)).toBe(2);
    expect(hitsToKO(0.34)).toBe(3);
    expect(hitsToKO(0)).toBe(Infinity);
  });

  it('più veloce: gli bastano tanti colpi quanti ne servono alla minaccia', () => {
    expect(fieldSpeed(regieleki, [regieleki])).toBeGreaterThan(fieldSpeed(gyarados, [gyarados]));
    // Anche se Gyarados lo manderebbe KO in un colpo, Regieleki colpisce prima
    expect(duel(regieleki, [regieleki], gyarados, 1)).toBe(1);
  });

  it('più lento: gli serve un colpo in meno della minaccia', () => {
    expect(fieldSpeed(tyranitar, [tyranitar])).toBeLessThan(fieldSpeed(volcarona, [volcarona]));
    expect(duel(tyranitar, [tyranitar], volcarona, 1)).toBe(0);
    expect(duel(tyranitar, [tyranitar], volcarona, 0.2)).toBe(1);
  });

  it('stessa velocità e stessi colpi: metà', () => {
    const out = bestHit(garchomp, garchomp)!.expected;
    expect(duel(garchomp, [garchomp], garchomp, out)).toBe(0.5);
  });

  it('senza danni non vince mai', () => {
    const passive = set('Toxapex', 'Black Sludge', 'Regenerator', ['Recover', 'Haze'], 'Bold', { hp: 252, def: 252 });
    expect(duel(passive, [passive], garchomp, 0.6)).toBe(0);
  });
});
