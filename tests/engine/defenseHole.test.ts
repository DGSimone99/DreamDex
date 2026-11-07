import { describe, expect, it } from 'vitest';
import { DEFENSE_HOLE_POINTS, rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly'): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 } });
// Sei attaccanti fragili: qualche tipo che nessuno regge c'è di sicuro
const glass = [
  set('Regieleki', 'Choice Specs', 'Transistor', ['Thunderbolt']), set('Dragapult', 'Choice Band', 'Infiltrator', ['Dragon Darts']),
  set('Iron Bundle', 'Booster Energy', 'Quark Drive', ['Hydro Pump']), set('Electrode-Hisui', 'Life Orb', 'Static', ['Leaf Storm']),
  set('Meowscarada', 'Choice Scarf', 'Protean', ['Flower Trick']), set('Weavile', 'Life Orb', 'Pressure', ['Ice Shard']),
];

describe('Buco in Difesa', () => {
  it('−2 per ogni tipo che nessuno regge, un malus per tipo', () => {
    const r = rateTeam(glass, fixtureData)!;
    const holes = r.penalty.items.filter(i => i.catalog === 'defenseHole');
    expect(r.defense.coverageTypes.weak.length).toBeGreaterThan(0);
    expect(holes).toHaveLength(r.defense.coverageTypes.weak.length);
    expect(holes.every(i => i.points === DEFENSE_HOLE_POINTS)).toBe(true);
    expect(new Set(holes.map(i => i.key)).size).toBe(holes.length);
  });

  it('solo nei team di 6: con meno membri non conta', () => {
    const r = rateTeam(glass.slice(0, 5), fixtureData)!;
    expect(r.defense.coverageTypes.weak.length).toBeGreaterThan(0);
    expect(r.penalty.items.some(i => i.catalog === 'defenseHole')).toBe(false);
  });
});
