import { afterEach, describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { needLabel, teamNeeds } from '../../src/engine/needs';
import { levelOf, LEVEL_KEYS, ROLE_LEVELS, setRolesCountMeasured } from '../../src/engine/roleLevels';
import { rateTeam } from '../../src/engine/rating';
import { rolesScore, teamRolesArea } from '../../src/engine/rolesArea';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { FAMILIES, rolesList, type SubRole } from '../../src/engine/subRoles';
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

afterEach(() => setRolesCountMeasured(true));

describe('tabella dei livelli per archetipo', () => {
  it('la bozza della specifica: attaccanti essenziali tranne nello stall, muri minori nell\'HO, hazard sempre importanti', () => {
    expect(levelOf('stall', 'attacker')).toBe('ignored');
    for (const a of ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall'] as const) expect(levelOf(a, 'attacker')).toBe('essential');
    expect(levelOf('hyperOffense', 'physicalWall')).toBe('minor');
    expect(levelOf('balance', 'physicalWall')).toBe('essential');
    expect(levelOf('hyperOffense', 'recovery')).toBe('ignored');
    expect(levelOf('semiStall', 'pivot')).toBe('minor');
    for (const a of Object.keys(ROLE_LEVELS) as (keyof typeof ROLE_LEVELS)[]) expect(levelOf(a, 'hazards')).toBe('important');
  });

  it('HO: hazard importante, schermi minori', () => {
    expect(levelOf('hyperOffense', 'hazards')).toBe('important');
    expect(levelOf('hyperOffense', 'screens')).toBe('minor');
    // Calibrazione: il pivot in HO è minore (i team HO da torneo spesso non ne hanno)
    expect(levelOf('hyperOffense', 'pivot')).toBe('minor');
    // Nel team HO i livelli sono quelli della colonna HO
    const needs = teamNeeds(hyperOffense, fixtureData);
    expect(needs.archetype).toBe('hyperOffense');
    expect(needs.levels.hazards).toBe('important');
    expect(needs.levels.screens).toBe('minor');
  });

  it('HO senza hazard: Ruoli bassi per scelta (importante), ma nessuna mancanza essenziale per gli hazard', () => {
    const noHazards = [set('Glimmora', 'Focus Sash', 'Toxic Debris', ['Mortal Spin', 'Power Gem', 'Sludge Wave', 'Earth Power']), ...hyperOffense.slice(1)];
    const needs = teamNeeds(noHazards, fixtureData);
    expect(needs.archetype).toBe('hyperOffense');
    expect(needs.values.hazards).toBe(0);
    expect(needs.importantMissing).toContain('hazards');
    expect(needs.essentialMissing).not.toContain('hazards');
    const area = teamRolesArea(noHazards, fixtureData, 'it', needs);
    // Unica voce importante a 0: base 0, restano solo le minori (calibrazione 2026-10-24)
    expect(area.base).toBe(0);
    expect(area.failures.some(f => /hazard/i.test(f.text))).toBe(false);
    expect(area.value).toBeLessThan(teamRolesArea(hyperOffense, fixtureData, 'it').value);
  });

  it('interruttore spento: i muri minori diventano ignorati, Recovery essenziale in stall', () => {
    setRolesCountMeasured(false);
    expect(levelOf('hyperOffense', 'physicalWall')).toBe('ignored');
    expect(levelOf('bulkyOffense', 'specialWall')).toBe('ignored');
    expect(levelOf('hyperOffense', 'physicalSweeper')).toBe('ignored');
    expect(levelOf('stall', 'physicalBreaker')).toBe('ignored');
    // Le voci essenziali non cambiano, il gruppo degli attaccanti nemmeno
    expect(levelOf('balance', 'physicalWall')).toBe('essential');
    expect(levelOf('hyperOffense', 'attacker')).toBe('essential');
    expect(levelOf('stall', 'recovery')).toBe('essential');
    expect(levelOf('semiStall', 'recovery')).toBe('essential');
    expect(levelOf('balance', 'recovery')).toBe('ignored');
    expect(levelOf('bulkyOffense', 'recovery')).toBe('ignored');
    // Le altre famiglie restano com'erano
    expect(levelOf('hyperOffense', 'screens')).toBe('minor');
  });

  it("le voci: il gruppo degli attaccanti e poi i sotto-ruoli nell'ordine delle famiglie", () => {
    expect(LEVEL_KEYS).toEqual(['attacker', ...Object.values(FAMILIES).flat()]);
  });

  it('priorità e controllo velocità non sono più voci dei Ruoli', () => {
    expect(LEVEL_KEYS as string[]).not.toContain('priority');
    expect(LEVEL_KEYS as string[]).not.toContain('speed');
    expect(LEVEL_KEYS as string[]).not.toContain('speedControl');
  });
});

describe('bisogni del team dai sotto-ruoli', () => {
  it('Balance senza muro fisico: essenziale mancante', () => {
    // Team incompleto: si giudica come balance; valori dei membri passati a mano
    const team = [stall[1], hyperOffense[3]];
    const members = [{ specialWall: 1, recovery: 1, dot: 1 }, { specialBreaker: 1, specialSweeper: 1 }];
    const needs = teamNeeds(team, fixtureData, members);
    expect(needs.archetype).toBe('balance');
    expect(needs.essentialMissing).toEqual(['physicalWall']);
    expect(needs.values.specialWall).toBe(1);
    expect(needs.values.attacker).toBe(1);
    expect(needs.importantMissing).toEqual(['hazards', 'removal', 'pivot', 'phazer', 'itemRemoval']);
    expect(needs.missingRoles).toEqual(['physicalWall', 'hazards', 'removal', 'pivot', 'phazer', 'itemRemoval']);
  });

  it('il valore del team è il migliore dei membri; senza attaccanti manca il gruppo', () => {
    const team = [stall[1], stall[3]];
    const needs = teamNeeds(team, fixtureData, [{ specialWall: 1, recovery: 0.5 }, { physicalWall: 1, recovery: 1, taunt: 0.3 }]);
    expect(needs.values.recovery).toBe(1);
    expect(needs.values.taunt).toBe(0.3);
    expect(needs.essentialMissing).toEqual(['attacker']);
    expect(needs.missingRoles.slice(0, 4)).toEqual(FAMILIES.attack);
  });

  it('senza valori dei membri li misura (come nel voto)', () => {
    const needs = teamNeeds(stall, fixtureData);
    expect(needs.archetype).toBe('stall');
    expect(needs.essentialMissing).toEqual([]);
    expect(needs.levels.attacker).toBe('ignored');
  });

  it('un team incompleto si giudica come balance', () => {
    expect(teamNeeds(hyperOffense.slice(0, 3), fixtureData).archetype).toBe('balance');
  });

  it('etichette: il gruppo degli attaccanti e i sotto-ruoli', () => {
    expect(needLabel('attacker', 'it')).toBe('Minaccia offensiva');
    expect(needLabel('hazards', 'it')).toBe('Hazard');
    expect(needLabel('physicalWall', 'en')).toBe('Physical wall');
  });

  it('squilibrio: almeno 4 attaccanti tutti dello stesso tipo, non nello stall', () => {
    const physical = ['Great Tusk', 'Kingambit', 'Dragonite', 'Garchomp'].map(n => set(n, '', '', ['Earthquake', 'Close Combat']));
    expect(teamNeeds(physical, fixtureData).needStyle).toBe('special');
    expect(teamNeeds(physical.slice(0, 2), fixtureData).needStyle).toBeNull();
  });
});

describe('voto e coach seguono i livelli dell\'archetipo', () => {
  it('lo stall non riceve "Ruoli mancanti"', () => {
    const texts = coachTeam(stall, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).not.toMatch(/Ruoli mancanti/);
  });

  it('un team senza attaccanti né muro speciale li riceve come ruoli mancanti', () => {
    // Incompleto (balance): attaccanti e muri sono essenziali
    const team = [stall[3], stall[2]];
    const texts = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).toMatch(/Ruoli mancanti:.*Minaccia offensiva/);
  });

  it("l'area Ruoli del voto: base delle voci importanti ed extra delle minori dell'archetipo", () => {
    const rating = rateTeam(hyperOffense, fixtureData)!;
    const needs = teamNeeds(hyperOffense, fixtureData);
    const of = (level: string) => LEVEL_KEYS.filter(k => needs.levels[k] === level).map(k => needs.values[k]);
    expect(rating.areas.find(a => a.key === 'roles')!.value).toBe(rolesScore(of('important'), of('minor')).value);
  });

  it('il coaching non chiede la priorità né la velocità', () => {
    const team = [set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Toxic Spikes']), set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Defog', 'U-turn', 'Roost'])];
    const texts = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).toMatch(/Ruoli mancanti/);
    expect(texts).not.toMatch(/Priorità|Velocità|Controllo velocità/);
  });
});
