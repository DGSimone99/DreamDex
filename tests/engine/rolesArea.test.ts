import { describe, expect, it } from 'vitest';
import { rateTeam } from '../../src/engine/rating';
import { teamNeeds } from '../../src/engine/needs';
import { LEVEL_KEYS } from '../../src/engine/roleLevels';
import { IMPORTANT_WEIGHT, importantWeight, MINOR_CAP, MINOR_STEP, rolesScore, teamRolesArea } from '../../src/engine/rolesArea';
import { softScore } from '../../src/engine/scale';
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

describe('area Ruoli: base degli importanti, extra dei minori', () => {
  it('base = media degli importanti, extra dei minori fino a 0.12', () => {
    const score = rolesScore([1, 0.5], [1, 1, 1, 1, 1]);
    expect(score.base).toBeCloseTo(0.75);
    // 5 × 0,03 = 0,15 → fermato a 0,12
    expect(score.extra).toBeCloseTo(MINOR_CAP);
    expect(score.value).toBe(softScore(0.75 + 0.12));
    expect(rolesScore([1], [1]).extra).toBeCloseTo(MINOR_STEP);

    // Sul team: le voci importanti e minori dell'archetipo coi valori del team
    const needs = teamNeeds(physical, fixtureData);
    const of = (level: string) => LEVEL_KEYS.filter(k => needs.levels[k] === level).map(k => needs.values[k]);
    const important = of('important');
    const base = important.reduce((a, b) => a + b, 0) / important.length;
    const extra = Math.min(MINOR_CAP, MINOR_STEP * of('minor').reduce((a, b) => a + b, 0));
    const roles = teamRolesArea(physical, fixtureData, 'it');
    expect(roles.base).toBeCloseTo(base);
    expect(roles.extra).toBeCloseTo(extra);
    expect(roles.value).toBe(softScore(base + extra));
    expect(rateTeam(physical, fixtureData)!.areas.find(a => a.key === 'roles')!.value).toBe(roles.value);
  });

  it('nessun importante: base 1 (RF4)', () => {
    const score = rolesScore([], [0.5]);
    expect(score.base).toBe(1);
    expect(score.extra).toBeCloseTo(0.015);
    expect(Number.isNaN(score.value)).toBe(false);
    expect(score.value).toBe(softScore(1.015));
    expect(rolesScore([], []).value).toBe(softScore(1));
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

  it('team incompleto: niente malus degli essenziali, area calcolata (RF3)', () => {
    // Solo attaccanti fisici: da balance mancano i muri, ma il team non è finito
    const team = physical.slice(0, 4);
    const roles = teamRolesArea(team, fixtureData, 'it');
    expect(roles.failures).toEqual([]);
    const rating = rateTeam(team, fixtureData)!;
    expect(rating.areas.find(a => a.key === 'roles')!.value).toBe(roles.value);
    expect(rating.penalty.items.map(i => i.text).join(' | ')).not.toMatch(/Balance senza/);
  });

  it('team vuoto: nessuna area (RF3)', () => {
    expect(teamRolesArea([], fixtureData, 'it').members).toEqual([]);
    expect(rateTeam([], fixtureData)).toBeNull();
  });

  it('stall: Ruoli non sotto il valore di master', () => {
    // Su master (a72aceb) l'area Ruoli di questo stall valeva 72
    expect(teamRolesArea(stall, fixtureData, 'it').value).toBeGreaterThanOrEqual(72);
  });
});

describe('peso degli importanti', () => {
  it('nessuna voce pesa di più: gli hazard sono una voce come le altre (IMPORTANT_WEIGHT vuoto)', () => {
    expect(IMPORTANT_WEIGHT).toEqual({});
    expect(importantWeight('hazards')).toBe(1);
    expect(importantWeight('removal')).toBe(1);
    // La base sa ancora pesare: una voce a 0 con peso 2 e una a 1 con peso 1 danno 1/3, non 1/2
    expect(rolesScore([0, 1], [], [2, 1]).base).toBeCloseTo(1 / 3);
    // Senza pesi: media semplice
    expect(rolesScore([0, 1], []).base).toBeCloseTo(0.5);
  });
});
