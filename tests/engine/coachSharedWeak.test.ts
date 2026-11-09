import { describe, expect, it } from 'vitest';
import { rateTeam } from '../../src/engine/rating';
import { findProblems } from '../../src/engine/coach';
import { analyzeTeam } from '../../src/engine/analysis';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature: 'Jolly', evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 } });
// Tre deboli al Ghiaccio (Garchomp 4×, Landorus-T 4×, Dragapult) e nessuno che lo resiste
const team = [
  set('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake']), set('Landorus-Therian', 'Choice Band', 'Intimidate', ['Earthquake']),
  set('Dragapult', 'Choice Band', 'Infiltrator', ['Dragon Darts']), set('Tyranitar', 'Leftovers', 'Sand Stream', ['Stone Edge']),
  set('Rotom-Wash', 'Leftovers', 'Levitate', ['Hydro Pump']), set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast']),
];

describe('Coaching: debolezza comune', () => {
  it('la riga del Coaching ha lo stesso testo e gli stessi punti del malus del voto', () => {
    const rating = rateTeam(team, fixtureData)!;
    const malus = rating.penalty.items.filter(i => i.catalog === 'sharedWeak');
    expect(malus.length).toBeGreaterThan(0);
    const problems = findProblems(team, DEFAULT_FORMAT, fixtureData, analyzeTeam(team, fixtureData), [], 'it', rating);
    for (const item of malus) {
      const line = problems.find(p => p.key === `redundancy:${item.key}`);
      expect(line?.text).toBe(item.text);
      expect(line?.size).toBe(item.points);
    }
  });
});
