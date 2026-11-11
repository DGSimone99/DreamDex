import { describe, expect, it } from 'vitest';
import { teamArchetype, typeMix, TYPE_BLEND_ZONE } from '../../src/engine/archetype';
import { DEFAULT_RULES, formatRules, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { ARCHETYPE_WEIGHTS, NATDEX_OU_WEIGHTS, areaWeightTable, rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { rolesTypeOf } from '../../src/engine/roleLevels';
import { FAMILIES } from '../../src/engine/subRoles';
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

  it('la Focus Sash non sposta il tipo, né su un attaccante né su un muro', () => {
    const slower = sunHO.map((s, i) => (i === 0 ? { ...s, item: 'Leftovers', moves: ['Swords Dance', 'Earthquake', 'Outrage', 'Roost'] } : s));
    const wallSash = slower.map((s, i) => (i === 4 ? { ...s, item: 'Focus Sash', moves: ['Roost', 'Defog', 'Iron Defense', 'Brave Bird'] } : s));
    const wall = slower.map((s, i) => (i === 4 ? { ...s, moves: ['Roost', 'Defog', 'Iron Defense', 'Brave Bird'] } : s));
    expect(teamArchetype(wallSash, NATDEX_OU_RULES)?.archetype).toBe(teamArchetype(wall, NATDEX_OU_RULES)?.archetype);
    expect(typeMix(wallSash, NATDEX_OU_RULES)).toEqual(typeMix(wall, NATDEX_OU_RULES));
    const attackerSash = slower.map((s, i) => (i === 3 ? { ...s, item: 'Focus Sash' } : s));
    expect(typeMix(attackerSash, NATDEX_OU_RULES)).toEqual(typeMix(slower, NATDEX_OU_RULES));
  });

  it('vicino a una soglia il tipo accanto ha una quota (fino a metà), lontano niente; stall e altri formati niente', () => {
    const slower = sunHO.map((s, i) => (i === 0 ? { ...s, item: 'Leftovers', moves: ['Swords Dance', 'Earthquake', 'Outrage', 'Roost'] } : s));
    // Un recupero in meno lo porta oltre la soglia di Hyper Offense: così è vicino
    const mix = typeMix(slower, NATDEX_OU_RULES)!;
    expect(mix.archetype).toBe('bulkyOffense');
    expect(mix.near).toBe('hyperOffense');
    expect(mix.share).toBeGreaterThan(0);
    expect(mix.share).toBeLessThanOrEqual(0.5);
    expect(TYPE_BLEND_ZONE).toBe(1.5);
    // Senza il Roost è HO, e Bulky Offense è il vicino
    const noRoost = typeMix(slower.map((s, i) => (i === 0 ? { ...s, moves: ['Swords Dance', 'Earthquake', 'Outrage', 'Dragon Claw'] } : s)), NATDEX_OU_RULES)!;
    expect(noRoost.archetype).toBe('hyperOffense');
    expect(noRoost.near).toBe('bulkyOffense');
    expect(typeMix(stall, NATDEX_OU_RULES)).toBeNull();
    // La fascia Bulky Offense è più stretta di due zone: col recupero a metà fascia contano tutti e due i vicini
    // (prima solo il più vicino, e un Roost tolto faceva saltare il voto); nella riga si mostra il più vicino
    // Punteggio −4,51 (2 recuperi − velocità media 97,7 / 15): 0,60 dalla soglia HO, 0,82 da quella Balance
    expect(mix.blends.map(b => b.near)).toEqual(['hyperOffense', 'balance']);
    expect(mix.blends[0].share).toBeGreaterThan(mix.blends[1].share);
    expect(mix.blends[1].share).toBeGreaterThan(0);
    expect(mix.shown).toEqual(['hyperOffense']);
    expect(typeMix(slower, DEFAULT_RULES)).toBeNull();
    expect(typeMix(slower.slice(0, 5), NATDEX_OU_RULES)).toBeNull();
  });

  it('il voto miscelato: niente riga "Vicino a…" fra bonus e malus, col tipo scelto a mano niente miscela', () => {
    const slower = sunHO.map((s, i) => (i === 0 ? { ...s, item: 'Leftovers', moves: ['Swords Dance', 'Earthquake', 'Outrage', 'Roost'] } : s));
    const data = { ...fixtureData, formatId: 'ou' as const };
    const r = rateTeam(slower, data)!;
    const own = rateTeam(slower, data, 'it', { archetype: 'bulkyOffense' })!;
    const near = rateTeam(slower, data, 'it', { archetype: 'hyperOffense' })!;
    expect(r.typeMix?.near).toBe('hyperOffense');
    expect(own.typeMix).toBeNull();
    // Ogni vicino a portata pesa per la sua quota (nella fascia Bulky Offense anche tutti e due)
    const votes = r.typeMix!.blends.map(b => ({ share: b.share, vote: rateTeam(slower, data, 'it', { archetype: b.near })!.overall }));
    const rest = 1 - votes.reduce((a, v) => a + v.share, 0);
    expect(r.overall).toBe(Math.round(rest * own.overall + votes.reduce((a, v) => a + v.share * v.vote, 0)));
    expect(near.overall).toBe(votes[0].vote);
    // Bonus e malus sono quelli del tipo riconosciuto: la miscela non aggiunge righe
    expect(r.penalty).toEqual(own.penalty);
    expect(r.bonus).toEqual(own.bonus);
    expect([...r.penalty.items, ...r.bonus.items].some(i => i.text.startsWith('Vicino a'))).toBe(false);
  });

  it('in National Dex OU lo Stall chiede i ruoli del Semi-stall tranne gli attaccanti (tutti minori); negli altri formati i suoi', () => {
    const ou = rateTeam(stall, { ...fixtureData, formatId: 'ou' })!;
    const asSemi = rateTeam(stall, { ...fixtureData, formatId: 'ou' }, 'it', { archetype: 'semiStall' })!;
    expect(ou.teamType).toBe('stall');
    const attack = new Set(['anySweeper', 'anyBreaker', 'anyPhysical', 'anySpecial', 'anyAttacker', 'secondAttacker', ...FAMILIES.attack]);
    for (const [key, level] of Object.entries(ou.needs.levels)) {
      if (attack.has(key)) expect(level === 'minor' || level === 'ignored').toBe(true);
      else expect(level).toBe((asSemi.needs.levels as Record<string, string>)[key]);
    }
    expect(ou.needs.levels.anyAttacker).toBe('minor');
    expect(asSemi.needs.levels.anyAttacker).toBe('important');
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

describe('freno dei tank (controllo 2 punto 3.5b)', () => {
  // Nessuna mossa di recupero, velocità media 77: senza freno era Hyper Offense; Slowking-Galar e Alomomola sono tank
  const tanks: TeamSet[] = [
    mk('Zamazenta', 'Fightinium Z', 'Dauntless Shield', ['Close Combat', 'Stone Edge', 'Crunch', 'Ice Fang']),
    mk('Kingambit', 'Leftovers', 'Supreme Overlord', ['Swords Dance', 'Knock Off', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 240, atk: 252, spe: 16 }),
    mk('Zapdos', 'Choice Specs', 'Static', ['Hurricane', 'Thunderbolt', 'Volt Switch', 'Heat Wave'], 'Timid', special),
    mk('Slowking-Galar', 'Heavy-Duty Boots', 'Regenerator', ['Future Sight', 'Sludge Bomb', 'Ice Beam', 'Chilly Reception'], 'Relaxed', { hp: 252, def: 252, spd: 4 }),
    mk('Alomomola', 'Assault Vest', 'Regenerator', ['Flip Turn', 'Knock Off', 'Mirror Coat', 'Aqua Jet'], 'Sassy', { hp: 20, def: 236, spd: 252 }),
    mk('Great Tusk', 'Rocky Helmet', 'Protosynthesis', ['Stealth Rock', 'Headlong Rush', 'Ice Spinner', 'Rapid Spin'], 'Jolly', { hp: 252, atk: 4, spe: 252 }),
  ];

  it('con 2 tank il team non è Hyper Offense ma Bulky Offense', () => {
    expect(teamArchetype(tanks, NATDEX_OU_RULES)?.archetype).toBe('bulkyOffense');
  });

  it('con un solo tank (Alomomola da attaccante) torna Hyper Offense', () => {
    const one = tanks.map(set => set.species === 'Alomomola' ? { ...set, evs: { atk: 252, spe: 252, spd: 4 } } : set);
    expect(teamArchetype(one, NATDEX_OU_RULES)?.archetype).toBe('hyperOffense');
  });

  it('a metà fascia Bulky Offense il voto è in parte HO e in parte Balance, alla pari', () => {
    const mix = typeMix(tanks, NATDEX_OU_RULES)!;
    expect(mix.archetype).toBe('bulkyOffense');
    expect(mix.shown.sort()).toEqual(['balance', 'hyperOffense']);
  });
});

describe('il tank deve essere robusto di suo', () => {
  it('Ditto con 350+ EV difensivi non conta come tank', () => {
    const base: TeamSet[] = [
      mk('Zamazenta', 'Fightinium Z', 'Dauntless Shield', ['Close Combat', 'Stone Edge', 'Crunch', 'Ice Fang']),
      mk('Kingambit', 'Leftovers', 'Supreme Overlord', ['Swords Dance', 'Knock Off', 'Sucker Punch', 'Iron Head'], 'Adamant'),
      mk('Zapdos', 'Choice Specs', 'Static', ['Hurricane', 'Thunderbolt', 'Volt Switch', 'Heat Wave'], 'Timid', special),
      mk('Alomomola', 'Assault Vest', 'Regenerator', ['Flip Turn', 'Knock Off', 'Mirror Coat', 'Aqua Jet'], 'Sassy', { hp: 20, def: 236, spd: 252 }),
      mk('Great Tusk', 'Rocky Helmet', 'Protosynthesis', ['Stealth Rock', 'Headlong Rush', 'Ice Spinner', 'Rapid Spin']),
    ];
    const ditto = mk('Ditto', 'Choice Scarf', 'Imposter', ['Transform'], 'Relaxed', { hp: 252, def: 252, spd: 4 });
    const slowking = mk('Slowking-Galar', 'Heavy-Duty Boots', 'Regenerator', ['Future Sight', 'Sludge Bomb', 'Ice Beam', 'Chilly Reception'], 'Relaxed', { hp: 252, def: 252, spd: 4 });
    expect(teamArchetype([...base, slowking], NATDEX_OU_RULES)?.archetype).toBe('bulkyOffense');
    expect(teamArchetype([...base, ditto], NATDEX_OU_RULES)?.archetype).toBe('hyperOffense');
  });
});
