import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { bestSwaps, rankByTeamGain, withCandidate } from '../../src/engine/teamGain';
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
