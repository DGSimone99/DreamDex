import { describe, expect, it } from 'vitest';
import { fitsTeamType, teamArchetype } from '../../src/engine/archetype';
import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { bestSwaps, rankByTeamGain, rankKey, withCandidate } from '../../src/engine/teamGain';
import { improveReplacements } from '../../src/engine/replace';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const bulky = { hp: 252, def: 252, spd: 4 };
const spdef = { hp: 252, spd: 252, def: 4 };
const fast = { atk: 252, spe: 252, hp: 4 };

// Stall sintetico coi due membri degli esempi dell'utente (Pecharunt e Clodsire)
const stall: TeamSet[] = [
  set('Pecharunt', 'Heavy-Duty Boots', 'Poison Puppeteer', ['Malignant Chain', 'Recover', 'Parting Shot', 'Nasty Plot'], 'Bold', bulky),
  set('Clodsire', 'Leftovers', 'Unaware', ['Earthquake', 'Spikes', 'Recover', 'Toxic'], 'Careful', spdef),
  set('Blissey', 'Leftovers', 'Natural Cure', ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Protect'], 'Bold', bulky),
  set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost'], 'Impish', bulky),
  set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'], 'Impish', bulky),
  set('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes'], 'Bold', bulky),
];
const balance: TeamSet[] = [
  set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Knock Off'], 'Jolly', fast),
  set('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant', fast),
  set('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang'], 'Jolly', fast),
  set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up'], 'Impish', bulky),
  set('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover', 'Haze', 'Toxic'], 'Calm', spdef),
];
const candidates: TeamSet[] = [
  set('Kyurem', 'Heavy-Duty Boots', 'Pressure', ['Freeze-Dry', 'Earth Power', 'Ice Beam', 'Draco Meteor'], 'Timid', { spa: 252, spe: 252, hp: 4 }),
  set('Zamazenta', 'Leftovers', 'Dauntless Shield', ['Close Combat', 'Crunch', 'Iron Defense', 'Body Press'], 'Jolly', fast),
  set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Close Combat', 'Knock Off', 'Spirit Break', 'Swords Dance'], 'Jolly', fast),
  set('Ting-Lu', 'Leftovers', 'Vessel of Ruin', ['Earthquake', 'Spikes', 'Whirlwind', 'Ruination'], 'Careful', spdef),
  set('Garganacl', 'Leftovers', 'Purifying Salt', ['Salt Cure', 'Recover', 'Protect', 'Stealth Rock'], 'Careful', spdef),
  set('Skarmory', 'Rocky Helmet', 'Sturdy', ['Spikes', 'Roost', 'Whirlwind', 'Brave Bird'], 'Impish', bulky),
];
const pool = () => candidates.map(c => ({ species: c.species, set: c, score: 50 }));

describe('scambi con l\'archetipo scelto', () => {
  it('lo stall sintetico è riconosciuto come stall', () => {
    expect(teamArchetype(stall, DEFAULT_RULES)?.archetype).toBe('stall');
  });

  it('esempi dell\'utente: Pecharunt → Kyurem e Clodsire → Zamazenta non sono nei primi 5 con Stall', () => {
    const top = bestSwaps(stall, fixtureData, 'it', pool, { archetype: 'stall' }).slice(0, 5);
    const bad = top.filter(s => (s.species === 'Kyurem' && s.replaces === 0) || (s.species === 'Zamazenta' && s.replaces === 1));
    expect(bad).toEqual([]);
    expect(bestSwaps(stall, fixtureData, 'it', pool).length).toBeGreaterThan(0);
  });

  it('con un archetipo, l\'ordine è per voto meno penalità, e la penalità segue le voci perse', () => {
    const swaps = bestSwaps(balance, fixtureData, 'it', pool, { archetype: 'balance' });
    const key = (s: typeof swaps[number]) => s.teamGain.overall - (s.teamGain.penalty ?? 0);
    for (let i = 1; i < swaps.length; i++) expect(key(swaps[i - 1])).toBeGreaterThanOrEqual(key(swaps[i]));
    for (const s of swaps) expect(s.teamGain.penalty).toBe((s.teamGain.lost ?? []).reduce((n, r) => n + (r.level === 'essential' ? 3 : 2), 0));
    // Chi sostituisce Garchomp (unico hazard setter) con un attaccante perde gli hazard
    const valiant = bestSwaps(balance, fixtureData, 'it', () => pool().filter(c => c.species === 'Iron Valiant'), { archetype: 'balance' })
      .find(s => s.replaces === 2) ?? null;
    if (valiant) expect(valiant.teamGain.lost?.map(r => r.key)).toContain('hazards');
  });

  it('senza archetipo l\'ordine resta per voto', () => {
    const swaps = bestSwaps(balance, fixtureData, 'it', pool);
    for (let i = 1; i < swaps.length; i++) expect(swaps[i - 1].teamGain.overall).toBeGreaterThanOrEqual(swaps[i].teamGain.overall);
    expect(swaps.every(s => !s.teamGain.penalty)).toBe(true);
  });

  it('team non di quel tipo: niente esclusi, si spinge verso il tipo scelto', () => {
    const free = bestSwaps(balance, fixtureData, 'it', pool).length;
    expect(bestSwaps(balance, fixtureData, 'it', pool, { archetype: 'stall' })).toHaveLength(free);
  });

  it('team già di quel tipo: esclusi i cambi che lo fanno uscire', () => {
    const swaps = bestSwaps(stall, fixtureData, 'it', pool, { archetype: 'stall' });
    for (const s of swaps) expect(teamArchetype(withCandidate(stall, s.set, s.replaces), DEFAULT_RULES)?.archetype).toBe('stall');
  });

  it('team già stall con Stall scelto: entra solo un muro (niente Kyurem al posto di Blissey), i muri restano', () => {
    // Lo stall degli screenshot: Blissey → Kyurem lo lasciava riconosciuto come stall
    const tloh: TeamSet[] = [
      set('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'], 'Impish', bulky),
      set('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish'], 'Bold', { hp: 4, def: 252, spd: 252 }),
      set('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'], 'Careful', spdef),
      set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 168, spd: 88 }),
      set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'], 'Impish', { hp: 244, def: 248, spe: 16 }),
      set('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes'], 'Bold', bulky),
    ];
    const kyurem = set('Kyurem', 'Heavy-Duty Boots', 'Pressure', ['Freeze-Dry', 'Earth Power', 'Substitute', 'Roost'], 'Timid', { hp: 56, spa: 200, spe: 252 });
    // Senza la regola il cambio passerebbe: il team resta stall
    expect(teamArchetype(withCandidate(tloh, kyurem, 1), DEFAULT_RULES)?.archetype).toBe('stall');
    const tlohPool = () => [{ species: 'Kyurem', set: kyurem, score: 50 }, ...pool().filter(c => c.species !== 'Kyurem')];
    const swaps = bestSwaps(tloh, fixtureData, 'it', tlohPool, { archetype: 'stall' });
    expect(swaps.map(s => s.species)).not.toContain('Kyurem');
    expect(swaps.map(s => s.species)).not.toContain('Iron Valiant');
    expect(swaps.some(s => ['Skarmory', 'Garganacl', 'Ting-Lu'].includes(s.species))).toBe(true);
  });

  it('team non stall con Stall scelto: nessun vincolo sul singolo membro', () => {
    const species = bestSwaps(balance, fixtureData, 'it', pool, { archetype: 'stall' }).map(s => s.species);
    expect(species).toEqual(expect.arrayContaining(bestSwaps(balance, fixtureData, 'it', pool).map(s => s.species)));
  });

  it('i preferiti non si sostituiscono mai, anche con un archetipo', () => {
    const team = stall.map((m, i) => (i === 0 ? { ...m, favorite: true } : m));
    expect(bestSwaps(team, fixtureData, 'it', pool, { archetype: 'stall' }).some(s => s.replaces === 0)).toBe(false);
  });

  it('team incompleto: voto con l\'archetipo scelto, nessuna esclusione', () => {
    const team = balance.slice(0, 5);
    const ranked = rankByTeamGain(pool(), team, 1, fixtureData, 'it', true, 'stall');
    expect(ranked).toHaveLength(candidates.length);
    for (const item of ranked) {
      expect(item.teamGain!.overall).toBe(rateTeam(withCandidate(team, item.set, 1), fixtureData, 'it', { archetype: 'stall' })!.overall);
    }
  });

  it('Sostituto simile: nessuna penalità', () => {
    const sims = pool().map(c => ({ ...c, similarity: 1 }));
    const swaps = bestSwaps(balance, fixtureData, 'it', () => sims, { similar: true, threshold: 0, archetype: 'balance' });
    expect(swaps.every(s => (s.teamGain.penalty ?? 0) === 0)).toBe(true);
  });
});

describe('rifiniture del tipo scelto', () => {
  it('la chiave d\'ordine (anche per i preferiti) è il voto meno la penalità', () => {
    expect(rankKey({ grade: 'B', overall: 80, gain: 3, penalty: 2 })).toBe(78);
    expect(rankKey({ grade: 'B', overall: 80, gain: 3 })).toBe(80);
    expect(rankKey(undefined)).toBe(-1);
  });

  it('i ruoli guadagnati nel dettaglio seguono il tipo scelto', () => {
    const team = [stall[3], stall[5], stall[2]];
    const valiant = candidates.find(c => c.species === 'Iron Valiant')!;
    const roles = (archetype?: 'stall' | 'hyperOffense') =>
      improveReplacements(team, 2, DEFAULT_FORMAT, fixtureData, 5, [valiant], 'it', archetype)[0].diff.gains.roles;
    // In un HO gli attaccanti sono una voce che manca; in uno stall non contano
    expect(roles('hyperOffense').length).toBeGreaterThan(0);
    expect(roles('stall')).toEqual([]);
  });
});

describe('il tipo di team guida Aggiungi e Migliora', () => {
  const three = balance.slice(0, 3);
  it('Aggiungi + Stall: solo candidati da stall', () => {
    const report = { excluded: 0 };
    const list = rankByTeamGain(pool(), three, null, fixtureData, 'it', true, 'stall', report);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every(item => fitsTeamType(item.set, 'stall', DEFAULT_RULES))).toBe(true);
    expect(report.excluded).toBeGreaterThan(0);
  });

  it('Aggiungi + Balance non esclude nessuno', () => {
    expect(rankByTeamGain(pool(), three, null, fixtureData, 'it', true, 'balance')).toHaveLength(candidates.length);
  });

  it('Aggiungi + Stall con pochi muri disponibili', () => {
    const attackers = pool().filter(c => !fitsTeamType(c.set, 'stall', DEFAULT_RULES));
    const report = { excluded: 0 };
    expect(rankByTeamGain(attackers, three, null, fixtureData, 'it', true, 'stall', report)).toEqual([]);
    expect(report.excluded).toBe(attackers.length);
  });

  it('Migliora: i cambi che portano al tipo scelto vengono prima', () => {
    const swaps = bestSwaps(stall, fixtureData, 'it', pool, { archetype: 'semiStall' });
    const reaching = swaps.filter(s => s.teamGain.reaches);
    expect(reaching.length).toBeGreaterThan(0);
    const firstOther = swaps.findIndex(s => !s.teamGain.reaches);
    if (firstOther >= 0) expect(swaps.slice(firstOther).some(s => s.teamGain.reaches)).toBe(false);
    for (const s of reaching) expect(teamArchetype(withCandidate(stall, s.set, s.replaces), DEFAULT_RULES)?.archetype).toBe('semiStall');
  });

  it('Migliora: team già del tipo, i cambi che lo fanno uscire restano esclusi', () => {
    for (const s of bestSwaps(stall, fixtureData, 'it', pool, { archetype: 'stall' })) {
      expect(teamArchetype(withCandidate(stall, s.set, s.replaces), DEFAULT_RULES)?.archetype).toBe('stall');
    }
  });
});
