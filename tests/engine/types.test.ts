import { describe, expect, it } from 'vitest';
import type { TeamSet } from '../../src/engine/sets';
import {
  attackingMoves, bestAttackMultiplier, coverageTable, defensiveMultiplier, effectiveness, superEffectiveMove, TYPES, weaknessTable,
} from '../../src/engine/types';

const set = (species: string, ability: string, moves: string[] = []): TeamSet =>
  ({ species, ability, item: '', moves, nature: 'Serious', evs: {} });

const tusk = set('Great Tusk', 'Protosynthesis', ['Headlong Rush', 'Rapid Spin', 'Close Combat', 'Ice Spinner']);
const gholdengo = set('Gholdengo', 'Good as Gold', ['Make It Rain', 'Shadow Ball', 'Recover', 'Nasty Plot']);

describe('types', () => {
  it('ha 18 tipi', () => expect(TYPES).toHaveLength(18));

  it('efficacia su doppio tipo', () => {
    expect(effectiveness('Water', ['Ground', 'Fighting'])).toBe(2);
    expect(effectiveness('Ice', ['Dragon', 'Ground'])).toBe(4);
    expect(effectiveness('Fighting', ['Steel', 'Ghost'])).toBe(0);
    expect(effectiveness('Bug', ['Steel', 'Ghost'])).toBe(0.25);
  });

  it('immunità e resistenze da abilità', () => {
    expect(defensiveMultiplier('Ground', set('Rotom-Wash', 'Levitate'))).toBe(0);
    expect(defensiveMultiplier('Fire', set('Heatran', 'Flash Fire'))).toBe(0);
    expect(defensiveMultiplier('Ice', set('Mamoswine', 'Thick Fat'))).toBe(0.5);
    expect(defensiveMultiplier('Ground', set('Rotom-Wash', 'Lightning Rod'))).toBe(2);
  });

  it('Pokémon sconosciuto vale x1 ovunque', () => {
    expect(defensiveMultiplier('Fire', set('Fakemon-Xyz', ''))).toBe(1);
  });

  it('tabella debolezze di Great Tusk + Gholdengo', () => {
    const table = weaknessTable([tusk, gholdengo]);
    expect(table.filter(r => r.pressure > 0).map(r => r.type)).toEqual(['Fire', 'Water', 'Ground', 'Ghost']);
    const water = table.find(r => r.type === 'Water')!;
    expect(water.multipliers).toEqual([2, 1]);
    expect(water).toMatchObject({ weak: 1, resist: 0, pressure: 1 });
  });

  it('mosse d\'attacco: ignora status, vuote e sconosciute', () => {
    expect(attackingMoves(set('Great Tusk', '', ['Headlong Rush', 'Stealth Rock', '', 'Notamove'])))
      .toEqual([{ name: 'Headlong Rush', type: 'Ground' }]);
  });

  it('Freeze-Dry è super efficace su Water', () => {
    expect(superEffectiveMove(set('Kyurem', '', ['Freeze-Dry']), 'Water')).toBe('Freeze-Dry');
    expect(superEffectiveMove(set('Kyurem', '', ['Ice Beam']), 'Water')).toBeNull();
  });

  it('coverage del team: 15/18, scoperti Water, Fighting, Bug', () => {
    const table = coverageTable([tusk, gholdengo]);
    expect(table.filter(r => r.hitters.length === 0).map(r => r.type)).toEqual(['Water', 'Fighting', 'Bug']);
    expect(table.find(r => r.type === 'Flying')!.hitters).toContainEqual({ member: 'Great Tusk', move: 'Ice Spinner' });
  });
});

describe('bestAttackMultiplier (etichetta di efficacia delle caselle)', () => {
  it('il moltiplicatore migliore fra le mosse d\'attacco, con le immunità di abilità', () => {
    const tusk = set('Great Tusk', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin']);
    expect(bestAttackMultiplier(tusk, ['Steel'])).toBe(2);
    expect(bestAttackMultiplier(tusk, ['Fire', 'Steel'])).toBe(4);
    // Levitate: il Terra non tocca (Mold Breaker la ignora)
    expect(bestAttackMultiplier(set('Great Tusk', 'Protosynthesis', ['Headlong Rush']), ['Steel'], 'Levitate')).toBe(0);
    expect(bestAttackMultiplier(set('Great Tusk', 'Mold Breaker', ['Headlong Rush']), ['Steel'], 'Levitate')).toBe(2);
  });
  it('Pixilate, Scrappy e Freeze-Dry; null senza mosse d\'attacco', () => {
    expect(bestAttackMultiplier(set('Sylveon', 'Pixilate', ['Hyper Voice']), ['Dragon'])).toBe(2);
    expect(bestAttackMultiplier(set('Kangaskhan', 'Scrappy', ['Return']), ['Ghost'])).toBe(1);
    expect(bestAttackMultiplier(set('Kangaskhan', 'Early Bird', ['Return']), ['Ghost'])).toBe(0);
    expect(bestAttackMultiplier(set('Lapras', 'Water Absorb', ['Freeze-Dry']), ['Water'])).toBe(2);
    expect(bestAttackMultiplier(set('Blissey', 'Natural Cure', ['Soft-Boiled']), ['Water'])).toBeNull();
  });
});
