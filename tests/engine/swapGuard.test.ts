import { describe, expect, it } from 'vitest';
import { teamNeeds } from '../../src/engine/needs';
import { levelOf } from '../../src/engine/roleLevels';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { lostResistances, lostRoles, rolePenalty, ROLE_PENALTY } from '../../src/engine/swapGuard';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const bulky = { hp: 252, def: 252, spd: 4 };
const fast = { atk: 252, spe: 252, hp: 4 };

// Balance con un solo setter del campo (Garchomp con Stealth Rock, nessuno schermo)
const balance: TeamSet[] = [
  set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Knock Off'], 'Jolly', fast),
  set('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant', fast),
  set('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang'], 'Jolly', fast),
  set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up'], 'Impish', bulky),
  set('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover', 'Haze', 'Toxic'], 'Calm', { hp: 252, spd: 252, def: 4 }),
];
const attacker = set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Close Combat', 'Knock Off', 'Spirit Break', 'Swords Dance'], 'Jolly', fast);
const swapped = balance.map((m, i) => (i === 2 ? attacker : m));
const needs = (team: TeamSet[]) => teamNeeds(team, fixtureData, undefined, 'balance');

describe('swapGuard', () => {
  it('perde l\'unico hazard setter: voce persa col livello del tipo scelto', () => {
    // Nel balance gli hazard sono una voce a sé (il setup del campo raggruppato vale in HO e Bulky Offense)
    const level = levelOf('balance', 'hazards');
    expect(level).toBe('important');
    const lost = lostRoles(needs(balance), needs(swapped));
    expect(lost).toEqual([{ key: 'hazards', level }]);
    expect(rolePenalty(lost)).toBe(ROLE_PENALTY.important);
  });

  it('nel bulky offense la stessa perdita è il setup del campo', () => {
    const bo = (team: TeamSet[]) => teamNeeds(team, fixtureData, undefined, 'bulkyOffense');
    expect(lostRoles(bo(balance), bo(swapped)).map(r => r.key)).toContain('fieldSetup');
  });

  it('una voce che mancava già non conta, una riempita neppure', () => {
    // Al contrario: il setup del campo si riempie, niente di perso
    expect(lostRoles(needs(swapped), needs(balance))).toEqual([]);
  });

  it('penalità: 3 per essenziale, 2 per importante', () => {
    expect(rolePenalty([{ key: 'fieldSetup', level: 'important' }, { key: 'specialWall', level: 'essential' }])).toBe(5);
    expect(rolePenalty([])).toBe(0);
  });

  it('resistenze uniche perse: Clodsire era l\'unico immune a Elettro', () => {
    const before = [
      set('Clodsire', 'Leftovers', 'Unaware', ['Spikes', 'Recover', 'Earthquake', 'Toxic'], 'Careful', bulky),
      set('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover', 'Haze', 'Toxic'], 'Calm', bulky),
      set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Defog'], 'Impish', bulky),
    ];
    const after = [set('Zamazenta', 'Leftovers', 'Dauntless Shield', ['Body Press', 'Iron Defense', 'Crunch', 'Roar'], 'Impish', bulky), before[1], before[2]];
    expect(lostResistances(before, after)).toContain('Electric');
    expect(lostResistances(before, before)).toEqual([]);
  });
});
