import { afterEach, describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { needLabel, teamNeeds } from '../../src/engine/needs';
import { levelOf, LEVEL_KEYS, ROLE_LEVELS, setRolesCountMeasured } from '../../src/engine/roleLevels';
import { rateTeam } from '../../src/engine/rating';
import { importantWeight, rolesScore, teamRolesArea } from '../../src/engine/rolesArea';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { FAMILIES, rolesList, subRoleReasons, type SubRole } from '../../src/engine/subRoles';
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

afterEach(() => setRolesCountMeasured(false));

describe('tabella dei livelli per archetipo', () => {
  it('la tabella dai team da torneo (2026-11-01): attaccanti essenziali tranne negli stall, muri essenziali da balance in giù', () => {
    // La tabella com'è scritta, con l'interruttore acceso (spento di default: vedi "interruttore del doppio conteggio")
    setRolesCountMeasured(true);
    for (const key of ['anySweeper', 'anyBreaker'] as const) {
      expect(levelOf('stall', key)).toBe('ignored');
      for (const a of ['hyperOffense', 'bulkyOffense', 'balance'] as const) expect(levelOf(a, key)).toBe('essential');
      expect(levelOf('semiStall', key)).toBe('ignored');
    }
    // HO (2026-11-01, dai 39 HO da torneo di Natdex OU): anche "almeno un fisico / uno speciale" essenziali, Hazard,
    // Controllo Hazard e Pivot importanti, muri, Recupero e Rimozione Strumenti minori, Taunt ed Encore ignorati
    expect(levelOf('hyperOffense', 'anyPhysical')).toBe('essential');
    expect(levelOf('hyperOffense', 'anySpecial')).toBe('essential');
    expect(levelOf('bulkyOffense', 'anyPhysical')).toBe('essential');
    expect(levelOf('bulkyOffense', 'anySpecial')).toBe('essential');
    expect(levelOf('balance', 'anyPhysical')).toBe('ignored');
    // BO (201 BO da torneo di Natdex OU, 95 / 70 / 30): sotto il 30% Taunt, Anti-setup, Cleric, Debuff ed Encore sono ignorati
    expect(levelOf('bulkyOffense', 'taunt')).toBe('ignored');
    expect(levelOf('bulkyOffense', 'phazer')).toBe('ignored');
    expect(levelOf('bulkyOffense', 'dot')).toBe('minor');
    expect(levelOf('hyperOffense', 'physicalWall')).toBe('minor');
    expect(levelOf('balance', 'physicalWall')).toBe('essential');
    expect(levelOf('hyperOffense', 'recovery')).toBe('minor');
    expect(levelOf('hyperOffense', 'itemRemoval')).toBe('minor');
    expect(levelOf('hyperOffense', 'taunt')).toBe('ignored');
    expect(levelOf('hyperOffense', 'encore')).toBe('ignored');
    expect(levelOf('semiStall', 'pivot')).toBe('minor');
    // Gli hazard sono la voce di campo col loro livello (tabella provvisoria); schermi e Speed Control sono ignorati ovunque
    for (const a of Object.keys(ROLE_LEVELS) as (keyof typeof ROLE_LEVELS)[]) {
      expect(levelOf(a, 'screens')).toBe('ignored');
      expect(levelOf(a, 'speedControl')).toBe('ignored');
    }
    expect(levelOf('hyperOffense', 'hazards')).toBe('important');
    expect(levelOf('bulkyOffense', 'hazards')).toBe('important');
    expect(levelOf('balance', 'hazards')).toBe('important');
    expect(levelOf('semiStall', 'hazards')).toBe('essential');
    expect(levelOf('stall', 'hazards')).toBe('important');
    // Balance: phazer e rimozione strumenti scendono a minori; BO: rimozione strumenti sale a importante
    expect(levelOf('balance', 'phazer')).toBe('minor');
    expect(levelOf('balance', 'itemRemoval')).toBe('minor');
    expect(levelOf('bulkyOffense', 'itemRemoval')).toBe('important');
    expect(levelOf('semiStall', 'itemRemoval')).toBe('important');
    // Cleric (Wish, Healing Wish, Heal Bell): minore da balance in giù, non conta negli offensivi
    expect(levelOf('balance', 'support')).toBe('minor');
    expect(levelOf('semiStall', 'support')).toBe('minor');
    expect(levelOf('stall', 'support')).toBe('minor');
    expect(levelOf('hyperOffense', 'support')).toBe('ignored');
    expect(levelOf('bulkyOffense', 'support')).toBe('ignored');
    expect(LEVEL_KEYS.indexOf('support')).toBe(LEVEL_KEYS.indexOf('recovery') + 1);
  });

  it('HO: le voci importanti sono Controllo Hazard, Hazard e Pivot (nell\'ordine delle voci)', () => {
    expect(levelOf('hyperOffense', 'hazards')).toBe('important');
    expect(LEVEL_KEYS.filter(k => levelOf('hyperOffense', k) === 'important')).toEqual(['removal', 'hazards', 'pivot']);
    // Il pivot in HO è importante: il 74% degli HO da torneo di Natdex OU ne ha uno (2026-11-01)
    expect(levelOf('hyperOffense', 'pivot')).toBe('important');
    const needs = teamNeeds(hyperOffense, fixtureData);
    expect(needs.archetype).toBe('hyperOffense');
    expect(needs.levels.hazards).toBe('important');
    expect(needs.levels.screens).toBe('ignored');
    expect(needs.values.hazards).toBe(1);
    expect(needs.importantMissing).not.toContain('hazards');
  });

  it('HO con Sticky Web e senza hazard: Sticky Web è Speed Control (ignorato), gli hazard mancano', () => {
    const web = [set('Galvantula', 'Focus Sash', 'Compound Eyes', ['Sticky Web', 'Bug Buzz', 'Thunder', 'Giga Drain']), ...hyperOffense.slice(1)];
    const needs = teamNeeds(web, fixtureData);
    expect(needs.archetype).toBe('hyperOffense');
    expect(needs.values.hazards).toBe(0);
    expect(needs.values.speedControl).toBe(1);
    expect(needs.levels.speedControl).toBe('ignored');
    expect(needs.importantMissing).toContain('hazards');
  });

  it('HO con Aurora Veil e neve: Screen Setter 1, ma gli schermi non valgono come hazard', () => {
    const veil = [set('Ninetales-Alola', 'Light Clay', 'Snow Warning', ['Aurora Veil', 'Blizzard', 'Moonblast', 'Encore']), ...hyperOffense.slice(1)];
    const needs = teamNeeds(veil, fixtureData);
    expect(needs.values.hazards).toBe(0);
    expect(needs.values.screens).toBe(1);
    expect(needs.levels.screens).toBe('ignored');
    expect(needs.importantMissing).toContain('hazards');
  });

  it('HO senza hazard: la voce manca (importante), base più bassa, nessun malus essenziale', () => {
    const none = [set('Glimmora', 'Focus Sash', 'Toxic Debris', ['Mortal Spin', 'Power Gem', 'Sludge Wave', 'Earth Power']), ...hyperOffense.slice(1)];
    const needs = teamNeeds(none, fixtureData);
    expect(needs.archetype).toBe('hyperOffense');
    expect(needs.values.hazards).toBe(0);
    expect(needs.importantMissing).toContain('hazards');
    expect(needs.essentialMissing).not.toContain('hazards');
    expect(needs.missingRoles).toContain('hazards');
    expect(needs.missingRoles).not.toContain('screens');
    const area = teamRolesArea(none, fixtureData, 'it', needs);
    // Hazard a 0 fra tre voci importanti: la base è la media delle altre due, non zero
    const full = teamRolesArea(hyperOffense, fixtureData, 'it');
    expect(area.base).toBeLessThan(full.base);
    expect(area.base).toBeGreaterThan(0);
    expect(area.failures.some(f => /hazard/i.test(f.text))).toBe(false);
    expect(area.value).toBeLessThan(full.value);
    // I gruppi degli attaccanti hanno un'etichetta propria, nelle due lingue
    expect(needLabel('anySweeper', 'it')).toBe('Almeno uno Sweeper');
    expect(needLabel('anySweeper', 'en')).toBe('At least one Sweeper');
    expect(needLabel('anyBreaker', 'it')).toBe('Almeno un Wallbreaker');
    expect(needLabel('anyBreaker', 'en')).toBe('At least one Wallbreaker');
    expect(needLabel('anyPhysical', 'it')).toBe('Almeno un attaccante fisico');
    expect(needLabel('anySpecial', 'en')).toBe('At least one special attacker');
  });

  it('"Chi la porta" degli hazard nomina la mossa; Sticky Web è Speed Control e Aurora Veil Screen Setter, non hazard', () => {
    const by = (team: TeamSet[]) => teamRolesArea(team, fixtureData, 'it').rows.find(r => r.key === 'hazards')!.by;
    expect(by(hyperOffense)[0]).toMatchObject({ species: 'Glimmora', source: 'Stealth Rock' });
    const web = [set('Galvantula', 'Focus Sash', 'Compound Eyes', ['Sticky Web', 'Bug Buzz', 'Thunder', 'Giga Drain']), ...hyperOffense.slice(1)];
    expect(by(web)).toEqual([]);
    expect(subRoleReasons(web[0], web, fixtureData).find(r => r.role === 'speedControl')).toMatchObject({ value: 1, source: 'Sticky Web' });
    const veil = [set('Ninetales-Alola', 'Light Clay', 'Snow Warning', ['Aurora Veil', 'Blizzard', 'Moonblast', 'Encore']), ...hyperOffense.slice(1)];
    expect(by(veil)).toEqual([]);
    expect(subRoleReasons(veil[0], veil, fixtureData).find(r => r.role === 'screens')).toMatchObject({ value: 1, source: 'Aurora Veil' });
  });

  it('interruttore spento: i muri minori diventano ignorati, Recovery essenziale in stall', () => {
    setRolesCountMeasured(false);
    expect(levelOf('hyperOffense', 'physicalWall')).toBe('ignored');
    expect(levelOf('bulkyOffense', 'specialWall')).toBe('ignored');
    expect(levelOf('hyperOffense', 'physicalSweeper')).toBe('ignored');
    expect(levelOf('stall', 'physicalBreaker')).toBe('ignored');
    // Le voci essenziali non cambiano, i gruppi degli attaccanti nemmeno
    expect(levelOf('balance', 'physicalWall')).toBe('essential');
    expect(levelOf('hyperOffense', 'anySweeper')).toBe('essential');
    expect(levelOf('hyperOffense', 'anyBreaker')).toBe('essential');
    expect(levelOf('stall', 'recovery')).toBe('essential');
    expect(levelOf('semiStall', 'recovery')).toBe('essential');
    expect(levelOf('balance', 'recovery')).toBe('ignored');
    expect(levelOf('bulkyOffense', 'recovery')).toBe('ignored');
    // Le altre famiglie restano com'erano
    expect(levelOf('hyperOffense', 'pivot')).toBe('important');
    expect(levelOf('balance', 'taunt')).toBe('minor');
  });

  it("le voci: i gruppi degli attaccanti e poi i sotto-ruoli nell'ordine delle famiglie", () => {
    const { attack, defense, support, utility } = FAMILIES;
    // I quattro gruppi degli attaccanti (Sweeper, Wallbreaker, fisico, speciale) stanno davanti all'Attacco
    expect(LEVEL_KEYS).toEqual(['anySweeper', 'anyBreaker', 'anyPhysical', 'anySpecial', ...attack, ...defense, ...support, ...utility]);
  });

  it('HO tutto fisico: mancano "almeno uno speciale" (essenziale) e il malus "un solo stile" non si somma', () => {
    // Tutti attaccanti fisici (giudicati come HO), nessuno speciale
    const physical = [
      set('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Scale Shot', 'Swords Dance']),
      hyperOffense[1], hyperOffense[4], hyperOffense[5],
      set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Fire Punch']),
      set('Weavile', 'Heavy-Duty Boots', 'Pressure', ['Swords Dance', 'Knock Off', 'Triple Axel', 'Ice Shard']),
    ];
    const needs = teamNeeds(physical, fixtureData, undefined, 'hyperOffense');
    expect(needs.values.anySpecial).toBe(0);
    expect(needs.essentialMissing).toEqual(['anySpecial']);
    expect(needs.needStyle).toBeNull();
    const area = teamRolesArea(physical, fixtureData, 'it', needs);
    expect(area.failures).toHaveLength(1);
    expect(area.failures[0]).toMatchObject({ points: 2, catalog: 'essentialRole' });
    expect(area.failures[0].text).toContain('Almeno un attaccante speciale');
  });

  it('priorità e velocità non sono voci dei Ruoli; lo Speed Control lo è, ma ignorato in ogni tipo di team', () => {
    expect(LEVEL_KEYS as string[]).not.toContain('priority');
    expect(LEVEL_KEYS as string[]).not.toContain('speed');
    expect(LEVEL_KEYS).toContain('speedControl');
    for (const a of Object.keys(ROLE_LEVELS) as (keyof typeof ROLE_LEVELS)[]) expect(levelOf(a, 'speedControl')).toBe('ignored');
  });
});

describe('voci a livello di team (teamRolesArea)', () => {
  const balance = [
    set('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang']),
    set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower']),
    set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up']),
    set('Toxapex', 'Black Sludge', 'Regenerator', ['Surf', 'Recover', 'Haze', 'Toxic']),
    set('Alomomola', 'Heavy-Duty Boots', 'Regenerator', ['Wish', 'Protect', 'Flip Turn', 'Scald']),
    set('Hatterene', 'Leftovers', 'Magic Bounce', ['Psychic', 'Draining Kiss', 'Calm Mind', 'Mystical Fire']),
  ];
  const area = () => teamRolesArea(balance, fixtureData, 'it', teamNeeds(balance, fixtureData, undefined, 'balance'));

  it('Cleric: Alomomola con Wish porta la voce (minore) nel Balance; in HO la voce non esiste', () => {
    const support = area().rows.find(r => r.key === 'support')!;
    expect(support.level).toBe('minor');
    expect(support.value).toBe(1);
    expect(support.by[0]).toMatchObject({ species: 'Alomomola', source: 'Wish' });
    expect(teamRolesArea(hyperOffense, fixtureData, 'it').rows.find(r => r.key === 'support')).toBeUndefined();
  });

  it('Controllo hazard: Hatterene con Magic Bounce e nessun Defog vale metà, con la fonte', () => {
    const removal = area().rows.find(r => r.key === 'removal')!;
    expect(removal.level).toBe('important');
    expect(removal.value).toBe(0.5);
    expect(removal.by[0]).toMatchObject({ species: 'Hatterene', value: 0.5, source: 'Magic Bounce' });
  });

  it('HO di 6 con hazard e controllo hazard ma senza pivot: base 2/3, nessun malus', () => {
    const ho = teamRolesArea(hyperOffense, fixtureData, 'it');
    expect(ho.rows.find(r => r.key === 'hazards')).toMatchObject({ level: 'important', value: 1 });
    expect(ho.rows.find(r => r.key === 'removal')).toMatchObject({ level: 'important', value: 1 });
    expect(ho.rows.find(r => r.key === 'pivot')).toMatchObject({ level: 'important', value: 0 });
    expect(ho.base).toBeCloseTo(2 / 3);
    expect(ho.failures).toEqual([]);
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
    expect(needs.values.anySweeper).toBe(1);
    expect(needs.values.anyBreaker).toBe(1);
    // Tabella 2026-11-01: in Balance le importanti sono rimozione, hazard e pivot (phazer e rimozione strumenti minori), nell'ordine delle voci
    expect(needs.importantMissing).toEqual(['removal', 'hazards', 'pivot']);
    expect(needs.missingRoles).toEqual(['physicalWall', 'removal', 'hazards', 'pivot']);
  });

  it('il valore del team è il migliore dei membri; senza attaccanti manca il gruppo', () => {
    const team = [stall[1], stall[3]];
    const needs = teamNeeds(team, fixtureData, [{ specialWall: 1, recovery: 0.5 }, { physicalWall: 1, recovery: 1, taunt: 0.3 }]);
    expect(needs.values.recovery).toBe(1);
    expect(needs.values.taunt).toBe(0.3);
    expect(needs.essentialMissing).toEqual(['anySweeper', 'anyBreaker']);
    expect(needs.missingRoles.slice(0, 4)).toEqual(FAMILIES.attack);
  });

  it('senza valori dei membri li misura (come nel voto)', () => {
    const needs = teamNeeds(stall, fixtureData);
    expect(needs.archetype).toBe('stall');
    expect(needs.essentialMissing).toEqual([]);
    expect(needs.levels.anySweeper).toBe('ignored');
    expect(needs.levels.anyBreaker).toBe('ignored');
  });

  it('un team incompleto si giudica come balance', () => {
    expect(teamNeeds(hyperOffense.slice(0, 3), fixtureData).archetype).toBe('balance');
  });

  it('etichette: i gruppi degli attaccanti e i sotto-ruoli', () => {
    expect(needLabel('anySweeper', 'it')).toBe('Almeno uno Sweeper');
    expect(needLabel('anyBreaker', 'en')).toBe('At least one Wallbreaker');
    expect(needLabel('hazards', 'it')).toBe('Hazard');
    expect(needLabel('physicalWall', 'en')).toBe('Physical Wall');
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
    expect(texts).toMatch(/Ruoli mancanti:.*Almeno uno Sweeper/);
  });

  it("l'area Ruoli del voto: base delle voci importanti ed extra delle minori dell'archetipo", () => {
    const rating = rateTeam(hyperOffense, fixtureData)!;
    const needs = teamNeeds(hyperOffense, fixtureData);
    const keys = (level: string) => LEVEL_KEYS.filter(k => needs.levels[k] === level);
    const of = (level: string) => keys(level).map(k => needs.values[k]);
    const score = rolesScore(of('important'), of('minor'), keys('important').map(importantWeight));
    expect(rating.areas.find(a => a.key === 'roles')!.value).toBe(score.value);
  });

  it('il coaching non chiede la priorità né la velocità', () => {
    const team = [set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Toxic Spikes']), set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Defog', 'U-turn', 'Roost'])];
    const texts = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).toMatch(/Ruoli mancanti/);
    expect(texts).not.toMatch(/Priorità|Velocità|Controllo Velocità/);
  });
});

describe('interruttore del doppio conteggio', () => {
  it('spento di default: Attacco e muri minori non danno punti nei Ruoli', () => {
    expect(levelOf('hyperOffense', 'physicalWall')).toBe('ignored');
    expect(levelOf('stall', 'recovery')).toBe('essential');
    expect(levelOf('balance', 'recovery')).toBe('ignored');
  });
});
