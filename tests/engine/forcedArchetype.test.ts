import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { teamNeeds } from '../../src/engine/needs';
import { ARCHETYPE_WEIGHTS, rateTeam } from '../../src/engine/rating';
import { LEVEL_KEYS, levelOf } from '../../src/engine/roleLevels';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const bulky = { hp: 252, def: 252, spd: 4 };
const fast = { atk: 252, spe: 252, hp: 4 };

// Stall e balance completi, dai test dello stall e delle mancanze dei Ruoli
const stall: TeamSet[] = [
  set('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'], 'Impish', bulky),
  set('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish'], 'Bold', { hp: 4, def: 252, spd: 252 }),
  set('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'], 'Careful', { hp: 252, def: 4, spd: 252 }),
  set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 168, spd: 88 }),
  set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'], 'Impish', { hp: 244, def: 248, spe: 16 }),
  set('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes'], 'Bold', bulky),
];
const balance: TeamSet[] = [
  set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Knock Off'], 'Jolly', fast),
  set('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant', fast),
  set('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang'], 'Jolly', fast),
  set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up'], 'Impish', bulky),
  set('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover', 'Haze', 'Toxic'], 'Calm', { hp: 252, spd: 252, def: 4 }),
];

describe('archetipo forzato nel voto', () => {
  it('senza opzione il voto non cambia', () => {
    for (const team of [stall, balance, [tusk, gholdengo]]) {
      expect(rateTeam(team, fixtureData, 'it', {})).toEqual(rateTeam(team, fixtureData));
    }
  });

  it('archetipo forzato: pesi, tipo e Velocità', () => {
    const rating = rateTeam(balance, fixtureData, 'it', { archetype: 'stall' })!;
    expect(rating.teamType).toBe('stall');
    expect(rating.archetype).toBe('stall');
    const w = ARCHETYPE_WEIGHTS.stall;
    const total = w.defense + w.strength + w.roles;
    expect(rating.weights.defense).toBeCloseTo(w.defense / total);
    expect(rating.weights.roles).toBeCloseTo(w.roles / total);
    expect(rating.weights.speed).toBeUndefined();
    expect(rating.areas.find(a => a.key === 'speed')?.inactive).toBe(true);
  });

  it('archetipo forzato non stall su uno stall: niente modalità stall', () => {
    const rating = rateTeam(stall, fixtureData, 'it', { archetype: 'hyperOffense' })!;
    expect(rating.teamType).toBe('hyperOffense');
    expect(rating.archetype).toBeNull();
  });

  it('archetipo forzato: livelli dei ruoli', () => {
    const needs = teamNeeds(balance, fixtureData, undefined, 'hyperOffense');
    expect(needs.archetype).toBe('hyperOffense');
    for (const key of LEVEL_KEYS) expect(needs.levels[key]).toBe(levelOf('hyperOffense', key));
  });

  it('forzare l\'archetipo riconosciuto dà lo stesso voto', () => {
    const recognised = teamArchetype(stall, DEFAULT_RULES)!.archetype;
    expect(rateTeam(stall, fixtureData, 'it', { archetype: recognised })!.overall).toBe(rateTeam(stall, fixtureData)!.overall);
  });
});
