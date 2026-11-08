import { describe, expect, it } from 'vitest';
import { conditionUsedBonus } from '../../src/engine/rating';
import { unusedEnablers, usesCondition } from '../../src/engine/synergy';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ species, item, ability, moves, nature: 'Serious', evs: {} });

describe('chi sfrutta una condizione: lo stesso per bonus e malus', () => {
  it('Weather Ball non sfrutta il sole: niente bonus, resta il malus', () => {
    const team = [
      set('Ninetales', 'Heat Rock', 'Drought', ['Nasty Plot', 'Solar Beam', 'Will-O-Wisp', 'Encore']),
      set('Castform', 'Leftovers', 'Forecast', ['Weather Ball', 'Thunderbolt']),
      set('Politoed', 'Leftovers', 'Damp', ['Weather Ball', 'Scald']),
    ];
    // Solar Beam di Ninetales sfrutta il sole da sé: il malus non scatta. Il bonus vuole due compagni veri: nessuno
    expect(conditionUsedBonus(team)).toEqual([]);
    const noSelf = [{ ...team[0], moves: ['Nasty Plot', 'Will-O-Wisp', 'Encore', 'Psyshock'] }, team[1], team[2]];
    expect(unusedEnablers(noSelf).map(e => e.condition)).toContain('sun');
    expect(conditionUsedBonus(noSelf)).toEqual([]);
  });

  it('Chilly Reception non porta la neve per il team; un Paradox con Booster non ha bisogno del sole', () => {
    const team = [
      set('Slowking-Galar', 'Heavy-Duty Boots', 'Regenerator', ['Chilly Reception', 'Sludge Bomb']),
      set('Abomasnow', 'Leftovers', 'Soundproof', ['Blizzard', 'Wood Hammer']),
      set('Ninetales-Alola', 'Light Clay', 'Snow Cloak', ['Aurora Veil', 'Blizzard']),
    ];
    expect(conditionUsedBonus(team)).toEqual([]);
    expect(usesCondition(set('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Headlong Rush']), 'sun')).toBe(false);
    expect(usesCondition(set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush']), 'sun')).toBe(true);
    expect(usesCondition(set('Walking Wake', 'Booster Energy', 'Protosynthesis', ['Hydro Steam']), 'sun')).toBe(true);
  });

  it('due compagni veri: il bonus c\'è e il malus no', () => {
    const team = [
      set('Torkoal', 'Heat Rock', 'Drought', ['Stealth Rock', 'Rapid Spin']),
      set('Venusaur', 'Life Orb', 'Chlorophyll', ['Growth', 'Giga Drain']),
      set('Walking Wake', 'Choice Specs', 'Protosynthesis', ['Hydro Steam', 'Draco Meteor']),
    ];
    expect(conditionUsedBonus(team)).toHaveLength(1);
    expect(unusedEnablers(team)).toEqual([]);
  });
});
