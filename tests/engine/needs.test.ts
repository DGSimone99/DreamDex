import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { needCoverage, NEEDS_BY_ARCHETYPE, needLabel, teamNeeds } from '../../src/engine/needs';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });

// "TLOH IV" dai team campione Smogon: stall
const stall = [
  set('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk']),
  set('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish']),
  set('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes']),
  set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost']),
  set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic']),
  set('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes']),
];
const hyperOffense = [
  set('Glimmora', 'Focus Sash', 'Toxic Debris', ['Mortal Spin', 'Power Gem', 'Stealth Rock', 'Earth Power']),
  set('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head']),
  set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore']),
  set('Tapu Lele', 'Choice Specs', 'Psychic Surge', ['Psychic', 'Moonblast', 'Focus Blast', 'Psyshock']),
  set('Great Tusk', 'Booster Energy', 'Protosynthesis', ['Bulk Up', 'Headlong Rush', 'Ice Spinner', 'Rapid Spin']),
  set('Lopunny', 'Lopunnite', 'Limber', ['Fake Out', 'Return', 'High Jump Kick', 'Ice Punch']),
];

describe('ruoli richiesti in base all\'archetipo', () => {
  it('la tabella: lo stall non richiede minacce offensive né velocità, l\'hyper offense non richiede wall', () => {
    expect(NEEDS_BY_ARCHETYPE.stall.offense).toBe(0);
    expect(NEEDS_BY_ARCHETYPE.stall.speed).toBe(0);
    expect(NEEDS_BY_ARCHETYPE.hyperOffense.physicalWall).toBe(0);
    expect(NEEDS_BY_ARCHETYPE.hyperOffense.offense).toBe(1);
    expect(NEEDS_BY_ARCHETYPE.balance.physicalWall).toBe(1);
    for (const table of Object.values(NEEDS_BY_ARCHETYPE)) expect(table.hazards).toBe(1);
  });

  it('lo stall ha tutto ciò che gli serve, senza sweeper né velocità', () => {
    const needs = teamNeeds(stall, DEFAULT_RULES);
    expect(needs.archetype).toBe('stall');
    expect(needs.missing.filter(m => m.weight === 1)).toEqual([]);
    expect(needs.missing.map(m => m.need)).not.toContain('offense');
  });

  it('copertura pesata: essenziali 1, utili 0,75, non richiesti 0', () => {
    // Stall: manca solo il Pivot (utile) → 4 su 4,75
    expect(needCoverage(teamNeeds(stall, DEFAULT_RULES))).toBeCloseTo(4 / 4.75);
    // Hyper offense: mancano Pivot e Controllo velocità (utili) → 4,5 su 6
    expect(teamNeeds(hyperOffense, DEFAULT_RULES).missing.map(m => m.need)).toEqual(['pivot', 'speedControl']);
    expect(needCoverage(teamNeeds(hyperOffense, DEFAULT_RULES))).toBeCloseTo(4.5 / 6);
  });

  it('la minaccia offensiva è coperta da uno sweeper o da un wallbreaker', () => {
    const needs = teamNeeds(hyperOffense, DEFAULT_RULES);
    expect(needs.missing.map(m => m.need)).not.toContain('offense');
  });

  it('un team incompleto si giudica come balance', () => {
    expect(teamNeeds(hyperOffense.slice(0, 3), DEFAULT_RULES).archetype).toBe('balance');
  });

  it('etichette: minaccia offensiva e velocità', () => {
    expect(needLabel('offense', 'it')).toBe('Minaccia offensiva');
    expect(needLabel('speed', 'it')).toBe('Velocità');
    expect(needLabel('speedControl', 'it')).toBe('Controllo velocità');
    expect(needLabel('hazards', 'it')).toBe('Hazard');
  });
});

describe('voto e coach seguono i ruoli dell\'archetipo', () => {
  it('lo stall non riceve "Ruoli mancanti"', () => {
    const texts = coachTeam(stall, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).not.toMatch(/Ruoli mancanti/);
  });

  it('un team senza minacce offensive né hazard le riceve come ruoli mancanti', () => {
    const walls = stall.map(s => ({ ...s, moves: s.moves.filter(m => !['Spikes', 'Stealth Rock', 'Toxic Spikes'].includes(m)) }));
    const texts = coachTeam(walls, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).toMatch(/Ruoli mancanti:.*Hazard/);
  });

  it("l'area Ruoli del voto è la copertura dei ruoli dell'archetipo", () => {
    const rating = rateTeam(hyperOffense, fixtureData)!;
    expect(rating.areas.find(a => a.key === 'roles')!.value).toBe(Math.round(100 * needCoverage(teamNeeds(hyperOffense, DEFAULT_RULES))));
  });
});

describe('priorità e sweeper', () => {
  it('la priorità non è mai essenziale', () => {
    for (const table of Object.values(NEEDS_BY_ARCHETYPE)) expect(table.priority).toBeLessThan(1);
  });

  it('il coaching non chiede la priorità', () => {
    const team = [set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Toxic Spikes']), set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Defog', 'U-turn', 'Roost'])];
    const texts = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).toMatch(/Ruoli mancanti/);
    expect(texts).not.toMatch(/Priorità/);
  });

  it('uno sweeper fisico basta come minaccia offensiva', () => {
    const needs = teamNeeds([set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Outrage', 'Earthquake'])], DEFAULT_RULES);
    expect(needs.missing.map(m => m.need)).not.toContain('offense');
  });
});
