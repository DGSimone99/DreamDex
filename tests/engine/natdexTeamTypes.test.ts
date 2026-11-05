import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import { DEFAULT_RULES, formatRules, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { ARCHETYPE_WEIGHTS, NATDEX_OU_WEIGHTS, areaWeightTable, rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const mk = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', evs: TeamSet['evs'] = { atk: 252, spe: 252, spd: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const special = { spa: 252, spe: 252, spd: 4 };
const bulky = { hp: 248, def: 252, spd: 8 };

// Sole: un solo recupero (Roost di Corviknight), velocità base media ~98 → Hyper Offense (con la regola dei muri era Bulky Offense)
const sunHO: TeamSet[] = [
  mk('Garchomp', 'Dragonium Z', 'Rough Skin', ['Swords Dance', 'Earthquake', 'Outrage', 'Stealth Rock']),
  mk('Gardevoir', 'Gardevoirite', 'Trace', ['Hyper Voice', 'Psyshock', 'Mystical Fire', 'Taunt'], 'Timid', special),
  mk('Ninetales', 'Heat Rock', 'Drought', ['Fire Blast', 'Solar Beam', 'Nasty Plot', 'Toxic'], 'Timid', special),
  mk('Leafeon', 'Life Orb', 'Chlorophyll', ['Swords Dance', 'Solar Blade', 'Knock Off', 'Double-Edge']),
  mk('Corviknight', 'Rocky Helmet', 'Pressure', ['Brave Bird', 'Defog', 'U-turn', 'Roost'], 'Impish', bulky),
  mk('Greninja', 'Choice Specs', 'Protean', ['Surf', 'Dark Pulse', 'Ice Beam', 'Water Shuriken'], 'Timid', special),
];

// Balance: 4 recuperi, ma quelli di Dragonite (Dragon Dance) e Gholdengo (Nasty Plot) sono di attaccanti
const balance: TeamSet[] = [
  mk('Gholdengo', 'Air Balloon', 'Good as Gold', ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'], 'Timid', special),
  mk('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Toxic', 'Haze', 'Recover'], 'Bold', bulky),
  mk('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Knock Off']),
  mk('Corviknight', 'Leftovers', 'Pressure', ['Roost', 'Brave Bird', 'U-turn', 'Iron Defense'], 'Impish', bulky),
  mk('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Adamant'),
  mk('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant'),
];

// Stall: tutti e 6 passivi, come con la regola dei muri
const stall: TeamSet[] = [
  mk('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'], 'Impish', bulky),
  mk('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish'], 'Bold', bulky),
  mk('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'], 'Careful', bulky),
  mk('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost'], 'Impish', bulky),
  mk('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'], 'Impish', bulky),
  mk('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes'], 'Bold', bulky),
];

describe('tipi di team in National Dex OU (recupero e velocità)', () => {
  it('National Dex OU usa la regola del recupero e della velocità, gli altri formati quella dei muri', () => {
    expect(formatRules('ou').typeRule).toBe('recoverySpeed');
    for (const id of ['ubers', 'uu', 'gen9ou', 'gen9ubers', 'gen9uu', 'gen9ag', 'all'] as const) expect(formatRules(id).typeRule).toBe('walls');
  });

  it('un team offensivo veloce con un solo recupero è Hyper Offense', () => {
    expect(teamArchetype(sunHO, NATDEX_OU_RULES)?.archetype).toBe('hyperOffense');
    expect(teamArchetype(sunHO, DEFAULT_RULES)?.archetype).toBe('bulkyOffense');
  });

  it('il recupero degli attaccanti non fa di un Balance un Semi-stall', () => {
    expect(teamArchetype(balance, NATDEX_OU_RULES)?.archetype).toBe('balance');
  });

  it('lo stall resta stall', () => {
    expect(teamArchetype(stall, NATDEX_OU_RULES)?.archetype).toBe('stall');
  });

  it('Focus Sash spinge verso Hyper Offense', () => {
    const slower = sunHO.map((s, i) => (i === 0 ? { ...s, item: 'Leftovers', moves: ['Swords Dance', 'Earthquake', 'Outrage', 'Roost'] } : s));
    expect(teamArchetype(slower, NATDEX_OU_RULES)?.archetype).toBe('bulkyOffense');
    expect(teamArchetype(slower.map((s, i) => (i === 1 ? { ...s, item: 'Focus Sash' } : s)), NATDEX_OU_RULES)?.archetype).toBe('hyperOffense');
  });

  it('pesi di National Dex OU: somma 100, scala regolare (la Difesa sale, la Velocità scende da HO a stall)', () => {
    const order = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'] as const;
    for (const row of Object.values(NATDEX_OU_WEIGHTS)) expect(row.defense + row.strength + row.speed).toBe(100);
    expect(order.map(t => NATDEX_OU_WEIGHTS[t].defense)).toEqual([20, 30, 45, 55, 65]);
    expect(order.map(t => NATDEX_OU_WEIGHTS[t].speed)).toEqual([30, 25, 15, 10, 10]);
    expect(areaWeightTable(NATDEX_OU_RULES)).toBe(NATDEX_OU_WEIGHTS);
    expect(areaWeightTable(DEFAULT_RULES)).toBe(ARCHETYPE_WEIGHTS);
  });

  it('il voto usa i pesi del formato', () => {
    const ou = rateTeam(sunHO, { ...fixtureData, formatId: 'ou' })!;
    expect(ou.teamType).toBe('hyperOffense');
    expect(ou.weightTable).toBe(NATDEX_OU_WEIGHTS);
    expect(ou.weights.defense!).toBeCloseTo(0.2);
    expect(ou.weights.speed!).toBeCloseTo(0.3);
    const other = rateTeam(sunHO, { ...fixtureData, formatId: 'gen9ou' })!;
    expect(other.weightTable).toBe(ARCHETYPE_WEIGHTS);
  });
});
