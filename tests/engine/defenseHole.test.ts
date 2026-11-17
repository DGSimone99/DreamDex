import { describe, expect, it } from 'vitest';
import { DEFENSE_HOLE_POINTS, UNANSWERED_META_POINTS, UNANSWERED_POINTS, rateTeam, unanswered } from '../../src/engine/rating';
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
  it('−2 per ogni tipo che nessuno regge ma qualcuno batte, un malus per tipo', () => {
    const r = rateTeam(glass, fixtureData)!;
    const holes = r.penalty.items.filter(i => i.catalog === 'defenseHole');
    const open = unanswered(glass, r.offense, r.defense).types;
    expect(r.defense.coverageTypes.weak.length).toBeGreaterThan(0);
    expect(holes).toHaveLength(r.defense.coverageTypes.weak.length - open.length);
    expect(holes.every(i => i.points === DEFENSE_HOLE_POINTS)).toBe(true);
    expect(new Set(holes.map(i => i.key)).size).toBe(holes.length);
  });

  it('sullo stesso tipo conta solo il buco, non anche la debolezza condivisa', () => {
    const r = rateTeam(glass, fixtureData)!;
    const holeTypes = r.defense.coverageTypes.weak;
    const shared = r.penalty.items.filter(i => i.catalog === 'sharedWeak').map(i => i.key!.split(':')[1]);
    expect(holeTypes.length).toBeGreaterThan(0);
    expect(shared.filter(type => holeTypes.includes(type))).toEqual([]);
    expect(r.penalty.total).toBe(r.penalty.items.reduce((a, i) => a + i.points, 0));
  });
  it('solo nei team di 6: con meno membri non conta', () => {
    const r = rateTeam(glass.slice(0, 5), fixtureData)!;
    expect(r.defense.coverageTypes.weak.length).toBeGreaterThan(0);
    expect(r.penalty.items.some(i => i.catalog === 'defenseHole' || i.catalog === 'unanswered')).toBe(false);
  });
});

describe('Senza risposta', () => {
  it('−4 per ogni tipo né retto né battuto, al posto del Buco in Difesa su quel tipo', () => {
    const r = rateTeam(glass, fixtureData)!;
    const open = unanswered(glass, r.offense, r.defense);
    expect(open.types.length).toBeGreaterThan(0);
    for (const type of open.types) {
      expect(r.defense.coverageTypes.weak).toContain(type);
      expect(r.offense.types.holes).toContain(type);
      expect(r.penalty.items.find(i => i.key === `unanswered:type:${type}`)!.points).toBe(UNANSWERED_POINTS);
      expect(r.penalty.items.some(i => i.key === `defenseHole:${type}`)).toBe(false);
    }
  });

  it('un Pokémon del meta conta quando nessuno lo regge e nessuno lo batte prima nel duello: −2, −1 a pari velocità', () => {
    const r = rateTeam(glass, fixtureData)!;
    const { threats } = unanswered(glass, r.offense, r.defense);
    const items = r.penalty.items.filter(i => i.key?.startsWith('unanswered:meta:'));
    expect(items.map(i => i.key!.slice('unanswered:meta:'.length))).toEqual(threats.map(t => t.species));
    for (const [k, row] of threats.entries()) {
      expect(row.best).toBeLessThan(1);
      expect(r.defense.coverageMeta!.rows.find(x => x.species === row.species)!.heldBy.some(h => !h.partial)).toBe(false);
      expect(items[k].points).toBe(row.best ? UNANSWERED_META_POINTS / 2 : UNANSWERED_META_POINTS);
    }
  });
});
