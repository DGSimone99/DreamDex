import { describe, expect, it } from 'vitest';
import { rateTeam } from '../../src/engine/rating';
import { MISSING_BELOW, teamNeeds } from '../../src/engine/needs';
import { ESSENTIAL_POINTS, IMPORTANT_POINTS, MINOR_POINTS, teamRolesArea } from '../../src/engine/rolesArea';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const s = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', evs: TeamSet['evs'] = { atk: 252, spe: 252, hp: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const bulky = { hp: 252, def: 252, spd: 4 };

// Balance tutto fisico senza muro speciale (Skarmory è un muro fisico)
const physical: TeamSet[] = [
  s('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Knock Off']),
  s('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant'),
  s('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang']),
  s('Dragapult', 'Choice Band', 'Clear Body', ['Dragon Darts', 'U-turn', 'Phantom Force', 'Sucker Punch']),
  s('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up'], 'Impish', bulky),
  s('Skarmory', 'Rocky Helmet', 'Sturdy', ['Brave Bird', 'Roost', 'Whirlwind', 'Spikes'], 'Impish', bulky),
];

// "TLOH IV" dai team campione Smogon di National Dex OU (come in stallRating.test.tsx)
const stall: TeamSet[] = [
  s('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'], 'Impish', { hp: 252, def: 252, spd: 4 }),
  s('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish'], 'Bold', { hp: 4, def: 252, spd: 252 }),
  s('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'], 'Careful', { hp: 252, def: 4, spd: 252 }),
  s('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 168, spd: 88 }),
  s('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'], 'Impish', { hp: 244, def: 248, spe: 16 }),
  s('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252, spd: 4 }),
];

describe('Ruoli come lista: coperti, malus e bonus', () => {
  it('coperti/totale: le voci dell\'archetipo col valore del team almeno MISSING_BELOW', () => {
    const roles = teamRolesArea(physical, fixtureData, 'it');
    expect(roles.total).toBe(roles.rows.length);
    expect(roles.total).toBeGreaterThan(0);
    expect(roles.covered).toBe(roles.rows.filter(r => r.value >= MISSING_BELOW).length);
    expect(roles.covered).toBeLessThanOrEqual(roles.total);
    // I Ruoli non sono più un'area del voto
    expect(rateTeam(physical, fixtureData)!.areas.map(a => a.key)).not.toContain('roles');
  });

  it('team di 6: −4 per ogni essenziale mancante, −2 per ogni importante mancante, nel malus del voto', () => {
    for (const team of [physical, stall]) {
      const needs = teamNeeds(team, fixtureData);
      const roles = teamRolesArea(team, fixtureData, 'it');
      const essential = roles.failures.filter(f => f.catalog === 'essentialRole');
      const important = roles.failures.filter(f => f.catalog === 'importantRole');
      expect(essential).toHaveLength(needs.essentialMissing.length);
      expect(important).toHaveLength(needs.importantMissing.length);
      expect(essential.every(f => f.points === ESSENTIAL_POINTS)).toBe(true);
      expect(important.every(f => f.points === IMPORTANT_POINTS)).toBe(true);
      const rating = rateTeam(team, fixtureData)!;
      for (const f of roles.failures) expect(rating.penalty.items).toContainEqual(f);
    }
    // Il team fisico manca almeno di una voce (il muro speciale): il malus c'è davvero
    expect(teamRolesArea(physical, fixtureData, 'it').failures.length).toBeGreaterThan(0);
  });

  it('+1 per ogni minore coperta, senza tetto, anche con meno di 6 membri', () => {
    for (const team of [physical, stall, physical.slice(0, 4)]) {
      const roles = teamRolesArea(team, fixtureData, 'it');
      const minors = roles.rows.filter(r => r.level === 'minor' && r.value >= MISSING_BELOW);
      expect(roles.bonuses).toHaveLength(minors.length);
      expect(roles.bonuses.every(b => b.points === MINOR_POINTS && b.catalog === 'minorRole')).toBe(true);
      const rating = rateTeam(team, fixtureData)!;
      for (const b of roles.bonuses) expect(rating.bonus.items).toContainEqual(b);
    }
  });

  it('righe: le voci dell\'archetipo col valore del team e chi le porta', () => {
    const roles = teamRolesArea(physical, fixtureData, 'it');
    const hazards = roles.rows.find(r => r.key === 'hazards')!;
    // Nel Balance gli hazard sono essenziali (99% dei team da torneo)
    expect(hazards.level).toBe('essential');
    expect(hazards.value).toBe(1);
    expect(hazards.by.map(b => b.species)).toEqual(expect.arrayContaining(['Garchomp', 'Skarmory']));
    // Le voci ignorate dall'archetipo (gli schermi nel Balance) non hanno una riga
    expect(roles.rows.find(r => r.key === 'screens')).toBeUndefined();
    expect(roles.rows.every(r => r.level !== 'ignored')).toBe(true);
    expect(roles.members.map(m => m.species)).toEqual(physical.map(m => m.species));
  });

  it('team incompleto: niente malus delle mancanze (RF3)', () => {
    // Solo attaccanti fisici: da balance mancano i muri, ma il team non è finito
    const team = physical.slice(0, 4);
    const roles = teamRolesArea(team, fixtureData, 'it');
    expect(roles.failures).toEqual([]);
    expect(roles.covered).toBeLessThan(roles.total);
    const rating = rateTeam(team, fixtureData)!;
    expect(rating.penalty.items.map(i => i.text).join(' | ')).not.toMatch(/Balance senza/);
  });

  it('team vuoto: lista vuota (RF3)', () => {
    expect(teamRolesArea([], fixtureData, 'it')).toMatchObject({ covered: 0, total: 0, members: [], failures: [], bonuses: [] });
    expect(rateTeam([], fixtureData)).toBeNull();
  });
});
