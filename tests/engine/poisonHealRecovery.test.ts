import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import { rulesOf } from '../../src/engine/formatRules';
import { setSubRoles } from '../../src/engine/subRoles';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet =>
  ({ species, item, ability, moves, nature: 'Impish', evs: { hp: 252, def: 252 } });
const rules = rulesOf({ stats: null, sets: null, formatId: 'ou' });

describe('Poison Heal con Toxic Orb è un recupero', () => {
  const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Knock Off', 'Protect', 'Stealth Rock']);

  it('nei Ruoli: Recupero', () => {
    expect(setSubRoles(gliscor, rules).recovery ?? 0).toBe(1);
    expect(setSubRoles({ ...gliscor, item: 'Leftovers' }, rules).recovery ?? 0).toBe(0);
  });

  it('nel tipo di team di National Dex OU: il team difensivo con Gliscor non è Hyper Offense', () => {
    const team = [
      gliscor,
      set('Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm', 'Earth Power', 'Taunt', 'Protect']),
      set('Ferrothorn', 'Leftovers', 'Iron Barbs', ['Leech Seed', 'Power Whip', 'Spikes', 'Knock Off']),
      set('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Dragon Tail', 'Spikes', 'Fire Blast']),
      set('Tapu Fini', 'Leftovers', 'Misty Surge', ['Scald', 'Moonblast', 'Taunt', 'Knock Off']),
      set('Zapdos', 'Heavy-Duty Boots', 'Static', ['Discharge', 'Hurricane', 'U-turn', 'Heat Wave']),
    ];
    expect(teamArchetype(team, rules)?.archetype).not.toBe('hyperOffense');
  });
});
