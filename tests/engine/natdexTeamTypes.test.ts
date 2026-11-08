import { describe, expect, it } from 'vitest';
import { teamArchetype, typeMix, TYPE_BLEND_ZONE } from '../../src/engine/archetype';
import { DEFAULT_RULES, formatRules, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { ARCHETYPE_WEIGHTS, NATDEX_OU_WEIGHTS, areaWeightTable, rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { rolesTypeOf } from '../../src/engine/roleLevels';
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

  it('la Focus Sash su un muro non sposta il tipo', () => {
    const slower = sunHO.map((s, i) => (i === 0 ? { ...s, item: 'Leftovers', moves: ['Swords Dance', 'Earthquake', 'Outrage', 'Roost'] } : s));
    const wallSash = slower.map((s, i) => (i === 4 ? { ...s, item: 'Focus Sash', moves: ['Roost', 'Defog', 'Iron Defense', 'Brave Bird'] } : s));
    const wall = slower.map((s, i) => (i === 4 ? { ...s, moves: ['Roost', 'Defog', 'Iron Defense', 'Brave Bird'] } : s));
    expect(teamArchetype(wallSash, NATDEX_OU_RULES)?.archetype).toBe(teamArchetype(wall, NATDEX_OU_RULES)?.archetype);
    expect(typeMix(wallSash, NATDEX_OU_RULES)).toEqual(typeMix(wall, NATDEX_OU_RULES));
  });

  it('vicino a una soglia il tipo accanto ha una quota (fino a metà), lontano niente; stall e altri formati niente', () => {
    const slower = sunHO.map((s, i) => (i === 0 ? { ...s, item: 'Leftovers', moves: ['Swords Dance', 'Earthquake', 'Outrage', 'Roost'] } : s));
    // Una Sash in più lo porta oltre la soglia di Hyper Offense: senza è vicino
    const mix = typeMix(slower, NATDEX_OU_RULES)!;
    expect(mix.archetype).toBe('bulkyOffense');
    expect(mix.near).toBe('hyperOffense');
    expect(mix.share).toBeGreaterThan(0);
    expect(mix.share).toBeLessThanOrEqual(0.5);
    expect(TYPE_BLEND_ZONE).toBe(1.5);
    // Con la Sash è HO, e Bulky Offense è il vicino: le due quote si specchiano attorno alla soglia
    const sash = typeMix(slower.map((s, i) => (i === 1 ? { ...s, item: 'Focus Sash' } : s)), NATDEX_OU_RULES)!;
    expect(sash.near).toBe('bulkyOffense');
    expect(typeMix(stall, NATDEX_OU_RULES)).toBeNull();
    expect(typeMix(slower, DEFAULT_RULES)).toBeNull();
    expect(typeMix(slower.slice(0, 5), NATDEX_OU_RULES)).toBeNull();
  });

  it('il voto miscelato: riga "Vicino a…" fra bonus o malus, i conti tornano, col tipo scelto a mano niente miscela', () => {
    const slower = sunHO.map((s, i) => (i === 0 ? { ...s, item: 'Leftovers', moves: ['Swords Dance', 'Earthquake', 'Outrage', 'Roost'] } : s));
    const data = { ...fixtureData, formatId: 'ou' as const };
    const r = rateTeam(slower, data)!;
    const own = rateTeam(slower, data, 'it', { archetype: 'bulkyOffense' })!;
    const near = rateTeam(slower, data, 'it', { archetype: 'hyperOffense' })!;
    expect(r.typeMix?.near).toBe('hyperOffense');
    expect(own.typeMix).toBeNull();
    expect(r.overall).toBe(Math.round((1 - r.typeMix!.share) * own.overall + r.typeMix!.share * near.overall));
    const item = [...r.penalty.items, ...r.bonus.items].find(i => i.catalog === 'typeBlend');
    if (r.overall === own.overall) expect(item).toBeUndefined();
    else expect(item!.text).toMatch(/^Vicino a Hyper Offense: il voto è per il \d+% quello da Hyper Offense/);
    expect(r.overall).toBe(Math.min(100, Math.max(0, r.base - r.penalty.total + r.bonus.total + r.memberPoints)));
  });

  it('in National Dex OU lo Stall chiede i ruoli del Semi-stall; negli altri formati i suoi', () => {
    const ou = rateTeam(stall, { ...fixtureData, formatId: 'ou' })!;
    const asSemi = rateTeam(stall, { ...fixtureData, formatId: 'ou' }, 'it', { archetype: 'semiStall' })!;
    expect(ou.teamType).toBe('stall');
    expect(ou.needs.levels).toEqual(asSemi.needs.levels);
    expect(ou.overall).toBe(asSemi.overall);
    expect(rolesTypeOf('stall', 'recoverySpeed')).toBe('semiStall');
    expect(rolesTypeOf('stall', 'walls')).toBe('stall');
    expect(rolesTypeOf('balance', 'recoverySpeed')).toBe('balance');
  });

  it('pesi di National Dex OU: somma 100, scala regolare (la Difesa sale, la Velocità scende da HO a stall)', () => {
    const order = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'] as const;
    for (const row of Object.values(NATDEX_OU_WEIGHTS)) expect(row.defense + row.strength + row.speed).toBe(100);
    expect(order.map(t => NATDEX_OU_WEIGHTS[t].defense)).toEqual([20, 30, 45, 65, 65]);
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
