import { afterEach, describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { needLabel, teamNeeds } from '../../src/engine/needs';
import { levelOf, LEVEL_KEYS, ROLE_LEVELS, setRolesCountMeasured } from '../../src/engine/roleLevels';
import { rateTeam } from '../../src/engine/rating';
import { ESSENTIAL_POINTS, IMPORTANT_POINTS, teamRolesArea } from '../../src/engine/rolesArea';
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
  it('la tabella dai team da torneo: Sweeper e Wallbreaker essenziali in HO e BO, uno dei due nel balance (2026-11-13), minori nel semi-stall e nello stall; muri essenziali da balance in giù', () => {
    // La tabella com'è scritta, con l'interruttore acceso (spento di default: vedi "interruttore del doppio conteggio")
    setRolesCountMeasured(true);
    for (const key of ['anySweeper', 'anyBreaker'] as const) {
      expect(levelOf('stall', key)).toBe('minor');
      for (const a of ['hyperOffense', 'bulkyOffense'] as const) expect(levelOf(a, key)).toBe('essential');
      expect(levelOf('balance', key)).toBe('ignored');
      expect(levelOf('semiStall', key)).toBe('minor');
    }
    expect(levelOf('balance', 'sweeperOrBreaker')).toBe('essential');
    for (const a of ['hyperOffense', 'bulkyOffense', 'semiStall', 'stall'] as const) expect(levelOf(a, 'sweeperOrBreaker')).toBe('ignored');
    // "Almeno un fisico / uno speciale" essenziali in HO e BO, importanti alla pari nel Balance (2026-11-11); nel
    // semi-stall un Attaccante qualunque importante e un 2° Attaccante minore; nello stall tutti gli attaccanti minori
    expect(levelOf('hyperOffense', 'anyPhysical')).toBe('essential');
    expect(levelOf('hyperOffense', 'anySpecial')).toBe('essential');
    expect(levelOf('bulkyOffense', 'anyPhysical')).toBe('essential');
    expect(levelOf('bulkyOffense', 'anySpecial')).toBe('essential');
    expect(levelOf('balance', 'anyPhysical')).toBe('important');
    expect(levelOf('balance', 'anySpecial')).toBe('important');
    expect(levelOf('semiStall', 'anyPhysical')).toBe('ignored');
    expect(levelOf('semiStall', 'anySpecial')).toBe('ignored');
    expect(levelOf('semiStall', 'anyAttacker')).toBe('important');
    expect(levelOf('semiStall', 'secondAttacker')).toBe('minor');
    for (const key of ['anySweeper', 'anyBreaker', 'anyAttacker', 'secondAttacker'] as const) expect(levelOf('stall', key)).toBe('minor');
    for (const a of ['hyperOffense', 'bulkyOffense', 'balance'] as const) expect(levelOf(a, 'anyAttacker')).toBe('ignored');
    // HO: Hazard e Controllo Hazard importanti; muri, Recupero, Pivot e Rimozione Strumenti minori, Taunt ed Encore ignorati
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
    // 2026-11-03: Pivot e Rimozione Strumenti minori ovunque (il censimento dice che non distinguono i team da torneo dal ladder)
    expect(levelOf('semiStall', 'pivot')).toBe('minor');
    expect(levelOf('stall', 'pivot')).toBe('ignored');
    // Gli hazard: importanti negli offensivi (90–92%), essenziali da balance in giù (99–100%); Speed Control ignorato
    // ovunque, gli schermi minori ovunque (2026-11-08)
    // I cinque tipi del singolo: il doppio ha il suo elenco (doublesRoles.test.ts)
    for (const a of (Object.keys(ROLE_LEVELS) as (keyof typeof ROLE_LEVELS)[]).filter(a => a !== 'doubles')) {
      expect(levelOf(a, 'screens')).toBe('minor');
      expect(levelOf(a, 'speedControl')).toBe('ignored');
    }
    expect(levelOf('hyperOffense', 'hazards')).toBe('important');
    expect(levelOf('bulkyOffense', 'hazards')).toBe('important');
    expect(levelOf('balance', 'hazards')).toBe('essential');
    expect(levelOf('semiStall', 'hazards')).toBe('essential');
    expect(levelOf('stall', 'hazards')).toBe('essential');
    // Balance: Anti-setup minore (41%); Rimozione Strumenti minore in Balance, BO e semi-stall (2026-11-03)
    expect(levelOf('balance', 'phazer')).toBe('minor');
    expect(levelOf('balance', 'itemRemoval')).toBe('minor');
    expect(levelOf('bulkyOffense', 'itemRemoval')).toBe('minor');
    expect(levelOf('semiStall', 'itemRemoval')).toBe('minor');
    // Cleric (Wish, Healing Wish, Heal Bell): minore nel semi-stall (35%), essenziale nello stall (100%), ignorato altrove
    expect(levelOf('balance', 'support')).toBe('ignored');
    expect(levelOf('semiStall', 'support')).toBe('minor');
    expect(levelOf('stall', 'support')).toBe('essential');
    expect(levelOf('hyperOffense', 'support')).toBe('ignored');
    expect(levelOf('bulkyOffense', 'support')).toBe('ignored');
    // Stall: Danno nel Tempo e Anti-setup essenziali, Controllo Hazard importante, Rimozione Strumenti minore
    expect(levelOf('stall', 'dot')).toBe('essential');
    expect(levelOf('stall', 'phazer')).toBe('essential');
    expect(levelOf('stall', 'removal')).toBe('important');
    expect(levelOf('stall', 'itemRemoval')).toBe('minor');
    expect(LEVEL_KEYS.indexOf('support')).toBe(LEVEL_KEYS.indexOf('recovery') + 1);
  });

  it('HO: le voci importanti sono Controllo Hazard e Hazard (nell\'ordine delle voci)', () => {
    expect(levelOf('hyperOffense', 'hazards')).toBe('important');
    expect(LEVEL_KEYS.filter(k => levelOf('hyperOffense', k) === 'important')).toEqual(['removal', 'hazards']);
    // Il pivot in HO è minore (2026-11-03): manca al 47% degli HO da torneo, non distingue; averlo vale +1
    expect(levelOf('hyperOffense', 'pivot')).toBe('minor');
    const needs = teamNeeds(hyperOffense, fixtureData);
    expect(needs.archetype).toBe('hyperOffense');
    expect(needs.levels.hazards).toBe('important');
    expect(needs.levels.screens).toBe('minor');
    expect(needs.values.hazards).toBe(1);
    expect(needs.importantMissing).not.toContain('hazards');
  });

  it('HO con Sticky Web e senza altri hazard: Sticky Web copre gli Hazard e resta Speed Control (ignorato)', () => {
    const web = [set('Galvantula', 'Focus Sash', 'Compound Eyes', ['Sticky Web', 'Bug Buzz', 'Thunder', 'Giga Drain']), ...hyperOffense.slice(1)];
    const needs = teamNeeds(web, fixtureData);
    expect(needs.archetype).toBe('hyperOffense');
    expect(needs.values.hazards).toBe(1);
    expect(needs.values.speedControl).toBe(1);
    expect(needs.levels.speedControl).toBe('ignored');
    expect(needs.importantMissing).not.toContain('hazards');
  });

  it('HO con Aurora Veil e neve: Screen Setter 1, ma gli schermi non valgono come hazard', () => {
    const veil = [set('Ninetales-Alola', 'Light Clay', 'Snow Warning', ['Aurora Veil', 'Blizzard', 'Moonblast', 'Encore']), ...hyperOffense.slice(1)];
    const needs = teamNeeds(veil, fixtureData);
    expect(needs.values.hazards).toBe(0);
    expect(needs.values.screens).toBe(1);
    expect(needs.levels.screens).toBe('minor');
    expect(needs.importantMissing).toContain('hazards');
  });

  it('HO senza hazard: la voce manca (importante), una voce coperta in meno, malus −2 e nessun malus essenziale', () => {
    const none = [set('Glimmora', 'Focus Sash', 'Toxic Debris', ['Mortal Spin', 'Power Gem', 'Sludge Wave', 'Earth Power']), ...hyperOffense.slice(1)];
    const needs = teamNeeds(none, fixtureData);
    expect(needs.archetype).toBe('hyperOffense');
    expect(needs.values.hazards).toBe(0);
    expect(needs.importantMissing).toContain('hazards');
    expect(needs.essentialMissing).not.toContain('hazards');
    expect(needs.missingRoles).toContain('hazards');
    expect(needs.missingRoles).not.toContain('screens');
    const area = teamRolesArea(none, fixtureData, 'it', needs);
    // Hazard a 0: una voce coperta in meno e il malus dell'importante, non quello dell'essenziale
    const full = teamRolesArea(hyperOffense, fixtureData, 'it');
    expect(area.covered).toBe(full.covered - 1);
    expect(area.total).toBe(full.total);
    const hazard = area.failures.filter(f => /hazard/i.test(f.text));
    expect(hazard).toEqual([expect.objectContaining({ points: IMPORTANT_POINTS, catalog: 'importantRole' })]);
    expect(area.failures.some(f => f.catalog === 'essentialRole')).toBe(false);
    // I gruppi degli attaccanti hanno un'etichetta propria, nelle due lingue
    expect(needLabel('anySweeper', 'it')).toBe('Sweeper');
    expect(needLabel('anySweeper', 'en')).toBe('Sweeper');
    expect(needLabel('anyBreaker', 'it')).toBe('Wallbreaker');
    expect(needLabel('anyBreaker', 'en')).toBe('Wallbreaker');
    expect(needLabel('anyPhysical', 'it')).toBe('Attaccante fisico');
    expect(needLabel('anySpecial', 'en')).toBe('Special Attacker');
  });

  it('"Chi la porta" degli hazard nomina la mossa; Sticky Web è hazard e Speed Control, Aurora Veil Screen Setter e non hazard', () => {
    const by = (team: TeamSet[]) => teamRolesArea(team, fixtureData, 'it').rows.find(r => r.key === 'hazards')!.by;
    expect(by(hyperOffense)[0]).toMatchObject({ species: 'Glimmora', source: 'Stealth Rock' });
    const web = [set('Galvantula', 'Focus Sash', 'Compound Eyes', ['Sticky Web', 'Bug Buzz', 'Thunder', 'Giga Drain']), ...hyperOffense.slice(1)];
    expect(by(web)).toEqual([expect.objectContaining({ species: 'Galvantula', source: 'Sticky Web' })]);
    expect(subRoleReasons(web[0], web, fixtureData).find(r => r.role === 'speedControl')).toMatchObject({ value: 1, source: 'Sticky Web' });
    const veil = [set('Ninetales-Alola', 'Light Clay', 'Snow Warning', ['Aurora Veil', 'Blizzard', 'Moonblast', 'Encore']), ...hyperOffense.slice(1)];
    expect(by(veil)).toEqual([]);
    expect(subRoleReasons(veil[0], veil, fixtureData).find(r => r.role === 'screens')).toMatchObject({ value: 1, source: 'Aurora Veil' });
  });

  it('interruttore spento: i muri minori diventano ignorati, Recupero essenziale da balance in giù e ignorato altrove', () => {
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
    expect(levelOf('balance', 'recovery')).toBe('essential');
    expect(levelOf('bulkyOffense', 'recovery')).toBe('ignored');
    expect(levelOf('hyperOffense', 'recovery')).toBe('ignored');
    // Le altre famiglie restano com'erano
    expect(levelOf('hyperOffense', 'pivot')).toBe('minor');
    expect(levelOf('balance', 'phazer')).toBe('minor');
  });

  it("le voci: i gruppi degli attaccanti e poi i sotto-ruoli nell'ordine delle famiglie", () => {
    const { attack, defense, support, utility } = FAMILIES;
    // I gruppi degli attaccanti (Sweeper, Wallbreaker, fisico, speciale, Attaccante, 2° Attaccante) stanno davanti all'Attacco
    // Le voci del doppio (doublesRoles.test.ts) stanno in mezzo, nell'ordine in cui il doppio le mostra
    const doubles = ['secondProtect', 'anyWall', 'spread', 'fakeOut', 'redirector', 'secondFirstStrike'];
    expect(LEVEL_KEYS.filter(key => doubles.includes(key))).toEqual(doubles);
    expect(LEVEL_KEYS.filter(key => !doubles.includes(key))).toEqual(['anySweeper', 'anyBreaker', 'sweeperOrBreaker', 'anyPhysical', 'anySpecial', 'anyAttacker', 'secondAttacker', ...attack, ...defense, ...support, ...utility]);
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
    const area = teamRolesArea(physical, fixtureData, 'it', needs);
    // Un solo malus essenziale (le importanti mancanti hanno il loro): lo squilibrio lo dice la riga, nessun malus in più
    const essential = area.failures.filter(f => f.catalog === 'essentialRole');
    expect(essential).toHaveLength(1);
    expect(essential[0]).toMatchObject({ points: ESSENTIAL_POINTS });
    expect(essential[0].text).toContain('Attaccante speciale');
    expect(area.failures.filter(f => f.catalog === 'importantRole')).toHaveLength(needs.importantMissing.length);
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

  it('Cleric: Alomomola con Wish porta la voce (minore) nel Semi-stall; nel Balance e in HO la voce non esiste', () => {
    const semiStall = teamRolesArea(balance, fixtureData, 'it', teamNeeds(balance, fixtureData, undefined, 'semiStall'));
    const support = semiStall.rows.find(r => r.key === 'support')!;
    expect(support.level).toBe('minor');
    expect(support.value).toBe(1);
    expect(support.by[0]).toMatchObject({ species: 'Alomomola', source: 'Wish' });
    expect(area().rows.find(r => r.key === 'support')).toBeUndefined();
    expect(teamRolesArea(hyperOffense, fixtureData, 'it').rows.find(r => r.key === 'support')).toBeUndefined();
  });

  it('Controllo hazard: Hatterene con Magic Bounce e nessun Defog vale metà, con la fonte', () => {
    const removal = area().rows.find(r => r.key === 'removal')!;
    expect(removal.level).toBe('important');
    expect(removal.value).toBe(0.5);
    expect(removal.by[0]).toMatchObject({ species: 'Hatterene', value: 0.5, source: 'Magic Bounce' });
  });

  it('HO di 6 con hazard e controllo hazard ma senza pivot: nessun malus, e il pivot è una voce minore', () => {
    const ho = teamRolesArea(hyperOffense, fixtureData, 'it');
    expect(ho.rows.find(r => r.key === 'hazards')).toMatchObject({ level: 'important', value: 1 });
    expect(ho.rows.find(r => r.key === 'removal')).toMatchObject({ level: 'important', value: 1 });
    expect(ho.rows.find(r => r.key === 'pivot')).toMatchObject({ level: 'minor', value: 0 });
    expect(ho.failures).toEqual([]);
    expect(ho.covered).toBe(ho.rows.filter(r => r.value >= 0.5).length);
  });
});

describe('bisogni del team dai sotto-ruoli', () => {
  it('Balance senza muro fisico: essenziale mancante', () => {
    // Team incompleto: si giudica come balance; valori dei membri passati a mano
    const team = [stall[1], hyperOffense[3]];
    const members = [{ specialWall: 1, recovery: 1, dot: 1 }, { specialBreaker: 1, specialSweeper: 1 }];
    const needs = teamNeeds(team, fixtureData, members);
    expect(needs.archetype).toBe('balance');
    // Nel Balance sono essenziali anche gli Hazard, nell'ordine delle voci; "almeno un attaccante fisico" (qui solo
    // speciali) è importante (2026-11-11)
    expect(needs.essentialMissing).toEqual(['physicalWall', 'hazards']);
    expect(needs.values.specialWall).toBe(1);
    expect(needs.values.anySweeper).toBe(1);
    expect(needs.values.anyBreaker).toBe(1);
    expect(needs.values.anySpecial).toBe(1);
    // In Balance le importanti sono fisico e speciale (lo speciale è coperto) e la rimozione; pivot e rimozione strumenti sono minori (2026-11-03), phazer minore
    expect(needs.importantMissing).toEqual(['anyPhysical', 'removal']);
    expect(needs.missingRoles).toEqual(['physicalWall', 'hazards', 'physicalSweeper', 'physicalBreaker', 'physicalAttacker', 'removal']);
  });

  it('il valore del team è il migliore dei membri; senza attaccanti manca il gruppo', () => {
    const team = [stall[1], stall[3]];
    const needs = teamNeeds(team, fixtureData, [{ specialWall: 1, recovery: 0.5 }, { physicalWall: 1, recovery: 1, taunt: 0.3 }]);
    expect(needs.values.recovery).toBe(1);
    expect(needs.values.taunt).toBe(0.3);
    // Due muri col Recupero: manca Sweeper o Wallbreaker e gli Hazard (essenziali nel Balance)
    expect(needs.essentialMissing).toEqual(['sweeperOrBreaker', 'hazards']);
    expect(needs.importantMissing.slice(0, 2)).toEqual(['anyPhysical', 'anySpecial']);
    expect(needs.missingRoles.slice(0, 4)).toEqual(FAMILIES.attack);
  });

  it('senza valori dei membri li misura (come nel voto)', () => {
    const needs = teamNeeds(stall, fixtureData);
    expect(needs.archetype).toBe('stall');
    // Da stall gli attaccanti sono solo minori; fra gli essenziali manca solo il Danno nel Tempo (misurato sul meta del
    // fixture, pieno di Acciaio e Veleno immuni a Toxic): muri, Recupero, Cleric, Anti-setup e Hazard ci sono
    expect(needs.essentialMissing).toEqual(['dot']);
    expect(needs.importantMissing).toEqual([]);
    expect(needs.levels.anySweeper).toBe('minor');
    expect(needs.levels.anyBreaker).toBe('minor');
  });

  it('il 2° Attaccante è il secondo migliore del team: un solo attaccante non lo copre', () => {
    const team = [stall[1], stall[3]];
    const one = teamNeeds(team, fixtureData, [{ specialBreaker: 1 }, { physicalWall: 1 }], 'semiStall');
    expect(one.values.anyAttacker).toBe(1);
    expect(one.values.secondAttacker).toBe(0);
    const two = teamNeeds(team, fixtureData, [{ specialBreaker: 1 }, { physicalAttacker: 0.8 }], 'semiStall');
    expect(two.values.secondAttacker).toBe(0.8);
  });

  it('un team incompleto si giudica come balance', () => {
    expect(teamNeeds(hyperOffense.slice(0, 3), fixtureData).archetype).toBe('balance');
  });

  it('etichette: i gruppi degli attaccanti e i sotto-ruoli', () => {
    expect(needLabel('anySweeper', 'it')).toBe('Sweeper');
    expect(needLabel('anyBreaker', 'en')).toBe('Wallbreaker');
    expect(needLabel('hazards', 'it')).toBe('Hazard');
    expect(needLabel('physicalWall', 'en')).toBe('Physical Wall');
  });

});

describe('voto e coach seguono i livelli dell\'archetipo', () => {
  it('lo stall non riceve "Ruoli mancanti" per gli attaccanti (formati con la regola dei muri)', () => {
    const texts = coachTeam(stall, { ...DEFAULT_FORMAT, formatId: 'gen9ou' }, { ...fixtureData, formatId: 'gen9ou' }).problems.map(p => p.text).join(' | ');
    expect(texts).not.toMatch(/Ruoli mancanti:[^|]*(Sweeper|Wallbreaker|attaccante)/);
    // L'unico essenziale da stall che manca a questo team è il Danno nel Tempo (vedi "senza valori dei membri li misura")
    expect(texts).toMatch(/Ruoli mancanti: Danno nel Tempo( \||$)/);
  });

  it('in National Dex OU lo stall chiede i ruoli del Semi-stall tranne gli attaccanti (minori): non mancano', () => {
    const texts = coachTeam(stall, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).not.toMatch(/Ruoli importanti mancanti:[^|]*(Wallbreaker|Sweeper|Attaccante)/);
  });

  it('un team senza attaccanti né muro speciale li riceve come ruoli mancanti', () => {
    // Incompleto (balance): attaccanti e muri sono essenziali
    const team = [stall[3], stall[2]];
    const texts = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).toMatch(/Ruoli mancanti:.*Sweeper/);
  });

  it("i Ruoli del voto: una lista delle voci dell'archetipo, non un'area", () => {
    const rating = rateTeam(hyperOffense, fixtureData)!;
    const needs = teamNeeds(hyperOffense, fixtureData);
    const counted = LEVEL_KEYS.filter(k => needs.levels[k] !== 'ignored');
    expect(rating.areas.map(a => a.key)).not.toContain('roles');
    expect(rating.roles.total).toBe(counted.length);
    expect(rating.roles.covered).toBe(counted.filter(k => needs.values[k] >= 0.5).length);
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
    expect(levelOf('balance', 'recovery')).toBe('essential');
    expect(levelOf('bulkyOffense', 'recovery')).toBe('ignored');
  });
});
