import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { teamOffense } from '../../src/engine/offense';
import { describe, expect, it } from 'vitest';
import { ARCHETYPE_WEIGHTS, rateTeam, ROLE_COMPRESSION } from '../../src/engine/rating';
import { meetsNeed, needCoverage, NEEDS, teamNeeds } from '../../src/engine/needs';

import { memberPower, teamPower } from '../../src/engine/power';
import { detectRoles, isPassive } from '../../src/engine/roles';
import { UNIFORM_TYPE_WEIGHTS } from '../../src/engine/analysis';
import { superEffectiveMove, TYPES } from '../../src/engine/types';

import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });

// "TLOH IV" dai team campione Smogon di National Dex OU
const stall: TeamSet[] = [
  set('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'], 'Impish', { hp: 252, def: 252, spd: 4 }),
  set('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish'], 'Bold', { hp: 4, def: 252, spd: 252 }),
  set('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'], 'Careful', { hp: 252, def: 4, spd: 252 }),
  set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 168, spd: 88 }),
  set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'], 'Impish', { hp: 244, def: 248, spe: 16 }),
  set('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252, spd: 4 }),
];

describe('team stall', () => {
  it('riconosciuto: ruoli giudicati come stall (niente sweeper né velocità richiesti)', () => {
    const rating = rateTeam(stall, fixtureData)!;
    expect(rating.archetype).toBe('stall');
    // da stall: Hazard, Rimozione e i due Wall (1 + 1 + 1 + 1); mancano Pivot e Controllo velocità (utili, 0,4)
    const needs = teamNeeds(stall, DEFAULT_RULES);
    expect(needs.missing.map(m => m.need)).toEqual(['pivot', 'speedControl']);
    const jobs = stall.reduce((acc, s) => acc + NEEDS.filter(need => meetsNeed(need, s, DEFAULT_RULES)).length, 0) / stall.length;
    const roles = (1 - ROLE_COMPRESSION) * needCoverage(needs) + ROLE_COMPRESSION * Math.min(1, jobs / 3);
    expect(rating.areas.find(a => a.key === 'roles')!.value).toBe(Math.round(100 * Math.min(1, roles)));
    // Nello stall la velocità non conta
    expect(rating.areas.map(a => a.key)).not.toContain('speed');
  });

  it('un team normale non è stall e non cambia', () => {
    const rating = rateTeam([tusk, gholdengo], fixtureData)!;
    expect(rating.archetype).toBeNull();
  });
});

// "eternatus full stall" dai team campione Smogon di National Dex Ubers: muri che hanno anche statistiche offensive
const ubersStall: TeamSet[] = [
  set('Dondozo', 'Leftovers', 'Unaware', ['Avalanche', 'Body Press', 'Curse', 'Rest'], 'Impish', { hp: 252, def: 252, spd: 4 }),
  set('Arceus-Dark', 'Dread Plate', 'Multitype', ['Foul Play', 'Recover', 'Refresh', 'Stealth Rock'], 'Timid', { hp: 248, def: 172, spe: 88 }),
  set('Chansey', 'Eviolite', 'Natural Cure', ['Confide', 'Heal Bell', 'Seismic Toss', 'Soft-Boiled'], 'Calm', { hp: 8, def: 252, spd: 248 }),
  set('Eternatus', 'Leftovers', 'Pressure', ['Dynamax Cannon', 'Recover', 'Sludge Bomb', 'Toxic Spikes'], 'Timid', { hp: 248, spd: 40, spe: 220 }),
  set('Giratina-Origin', 'Griseous Core', 'Levitate', ['Defog', 'Hex', 'Rest', 'Toxic'], 'Bold', { hp: 248, def: 252, spd: 8 }),
  set('Ho-Oh', 'Heavy-Duty Boots', 'Regenerator', ['Defog', 'Sacred Fire', 'Toxic', 'Whirlwind'], 'Impish', { hp: 248, def: 204, spd: 56 }),
];

describe('stall con muri dalle statistiche offensive', () => {
  it('riconosciuto: chi è un muro o ha un solo attacco non conta come attaccante', () => {
    expect(rateTeam(ubersStall, fixtureData)!.archetype).toBe('stall');
  });
});

describe('pannello del voto', () => {
  it('dice che il team è valutato come stall', async () => {
    const { screen } = await import('@testing-library/react');
    const { RatingPanel } = await import('../../src/ui/RatingPanel');
    const { renderIt } = await import('../helpers/italian');
    renderIt(<RatingPanel rating={rateTeam(stall, fixtureData)!} />);
    expect(screen.getByText(/Valutato come stall/)).toBeInTheDocument();
  });
});

describe('coaching di uno stall', () => {
  it('non chiede pivot, priorità o velocità', async () => {
    const { coachTeam } = await import('../../src/engine/coach');
    const { DEFAULT_FORMAT } = await import('../../src/engine/format');
    const texts = coachTeam(stall, DEFAULT_FORMAT, fixtureData, 'it').problems.map(p => p.text).join(' | ');
    expect(texts).not.toMatch(/Pivot|Priorità|Controllo velocità/);
  });

  it('chiede invece i ruoli da stall che mancano', async () => {
    const { coachTeam } = await import('../../src/engine/coach');
    const { DEFAULT_FORMAT } = await import('../../src/engine/format');
    const noRemoval = stall.map(s => (s.species === 'Corviknight' ? { ...s, moves: ['Body Press', 'Iron Defense', 'Roost', 'Brave Bird'] } : s));
    const texts = coachTeam(noRemoval, DEFAULT_FORMAT, fixtureData, 'it').problems.map(p => p.text);
    expect(texts).toContainEqual(expect.stringMatching(/Ruoli mancanti: Rimozione hazard$/));
  });
});

describe('membro passivo e riconoscimento dello stall', () => {
  // Stall con Mega Sableye: Sableye-Mega e Quagsire non sono "muri" per statistiche, ma recuperano e attaccano poco
  const sableyeStall: TeamSet[] = [
    set('Sableye', 'Sablenite', 'Prankster', ['Knock Off', 'Recover', 'Will-O-Wisp', 'Calm Mind'], 'Careful', { hp: 252, def: 4, spd: 252 }),
    set('Chansey', 'Eviolite', 'Natural Cure', ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Heal Bell'], 'Bold', { hp: 4, def: 252, spd: 252 }),
    set('Skarmory', 'Rocky Helmet', 'Sturdy', ['Spikes', 'Roost', 'Brave Bird', 'Whirlwind'], 'Impish', { hp: 252, def: 252, spd: 4 }),
    set('Quagsire', 'Leftovers', 'Unaware', ['Earthquake', 'Recover', 'Toxic', 'Scald'], 'Relaxed', { hp: 252, def: 252, spd: 4 }),
    set('Mandibuzz', 'Heavy-Duty Boots', 'Overcoat', ['Foul Play', 'Roost', 'Defog', 'Toxic'], 'Impish', { hp: 252, def: 252, spd: 4 }),
    set('Hippowdon', 'Leftovers', 'Sand Stream', ['Stealth Rock', 'Slack Off', 'Earthquake', 'Whirlwind'], 'Impish', { hp: 252, def: 252, spd: 4 }),
  ];
  // Muri e setup: Volcarona e Garchomp sono sweeper, non passivi
  const setupBalance: TeamSet[] = [
    set('Ferrothorn', 'Leftovers', 'Iron Barbs', ['Spikes', 'Leech Seed', 'Power Whip', 'Knock Off'], 'Relaxed', { hp: 252, def: 88, spd: 168 }),
    set('Garchomp', 'Life Orb', 'Rough Skin', ['Swords Dance', 'Earthquake', 'Stone Edge', 'Fire Fang'], 'Jolly', { atk: 252, spd: 4, spe: 252 }),
    set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast', 'Soft-Boiled', 'Calm Mind', 'Flamethrower'], 'Bold', { hp: 252, def: 252, spd: 4 }),
    set('Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm', 'Earth Power', 'Stealth Rock', 'Taunt'], 'Calm', { hp: 252, spd: 216, spe: 40 }),
    set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Toxic', 'Recover', 'Haze'], 'Bold', { hp: 252, def: 252, spd: 4 }),
    set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Fiery Dance', 'Giga Drain', 'Roost'], 'Timid', { hp: 252, def: 4, spe: 252 }),
  ];

  it('passivo: al massimo 2 attacchi, non sweeper veloce con setup, muro o con recupero', () => {
    expect(isPassive(sableyeStall[0], detectRoles(sableyeStall[0], DEFAULT_RULES))).toBe(true);
    expect(isPassive(sableyeStall[3], detectRoles(sableyeStall[3], DEFAULT_RULES))).toBe(true);
    expect(isPassive(setupBalance[1], detectRoles(setupBalance[1], DEFAULT_RULES))).toBe(false);
    expect(isPassive(setupBalance[5], detectRoles(setupBalance[5], DEFAULT_RULES))).toBe(false);
    expect(isPassive(set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Close Combat', 'Rapid Spin'], 'Jolly', {}), detectRoles(set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Ice Spinner', 'Close Combat', 'Rapid Spin'], 'Jolly', {}), DEFAULT_RULES))).toBe(false);
  });

  it('lo stall con Mega Sableye è riconosciuto', () => {
    expect(rateTeam(sableyeStall, fixtureData)!.archetype).toBe('stall');
  });

  it('muri con due sweeper in setup non sono stall', () => {
    expect(rateTeam(setupBalance, fixtureData)!.archetype).toBeNull();
  });
});

describe('voto dello stall', () => {
  // Le aree coi pesi effettivi del voto (la difesa divisa tra Coverage difensiva e Robustezza); il Meta non pesa
  const weighted = (rating: NonNullable<ReturnType<typeof rateTeam>>) =>
    Math.round(rating.areas.filter(a => a.key !== 'meta').reduce((acc, a) => acc + rating.weights[a.key]! * a.value!, 0));
  it('anche nello stall l\'Offesa è la media dei membri, ma pesa poco', () => {
    const rating = rateTeam(stall, fixtureData)!;
    // L'Offesa è quella del danno vero (offense.ts), anche per uno stall
    expect(rating.areas.find(a => a.key === 'strength')!.value).toBe(teamOffense(stall, fixtureData).value);
    expect(rating.areas.find(a => a.key === 'strength')!.label).toBe('Offesa');
    expect(rating.weights.strength!).toBeCloseTo(ARCHETYPE_WEIGHTS.stall.strength / 100);
  });

  it('pesi da stall: la Difesa pesa più di tutto, la Velocità non conta', () => {
    const rating = rateTeam(stall, fixtureData)!;
    expect(Math.abs(rating.base - weighted(rating))).toBeLessThanOrEqual(1);
    expect(rating.weights.defense!).toBeCloseTo(ARCHETYPE_WEIGHTS.stall.defense / 100);
    expect(rating.areas.map(a => a.key)).not.toContain('speed');
  });

  it('un team incompleto usa i pesi del balance e l\'Offesa media dei membri', () => {
    const team = [tusk, gholdengo];
    const rating = rateTeam(team, fixtureData)!;
    expect(Math.abs(rating.base - weighted(rating))).toBeLessThanOrEqual(1);
    expect(rating.areas.find(a => a.key === 'strength')!.value).toBe(teamOffense(team, fixtureData).value);
    expect(rating.areas.find(a => a.key === 'strength')!.label).toBe('Offesa');
  });
});

