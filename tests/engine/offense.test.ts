import { softScore } from '../../src/engine/scale';
import { describe, expect, it } from 'vitest';
import { memberOffense, offenseReference, POWER_FULL, RANK_WEIGHTS, REFERENCE_RANK, SETUP_SHARE, stepValue, TEAM_WALL_FULL, teamOffense } from '../../src/engine/offense';
import { bestHit } from '../../src/engine/damage';
import { defenderPanel } from '../../src/engine/defenders';
import { coverageTargets } from '../../src/engine/coverage';
import { mostCommonSet } from '../../src/engine/sets';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, tusk } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs'], extra: Partial<TeamSet> = {}): TeamSet =>
  ({ species, item, ability, moves, nature, evs, ...extra });

// Senza statistiche il riferimento è fisso (60% dei PS): i confronti di Potenza non arrivano al tetto di 100
const noStats = { stats: null, sets: null, formatId: 'ou' as const };
const gen9 = { stats: null, sets: null, formatId: 'gen9ou' as const };
const chomp = set('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Stone Edge'], 'Adamant', { atk: 252, spe: 252 });
const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Toxic', 'Seismic Toss', 'Stealth Rock'], 'Bold', { hp: 252, def: 252 });

describe('stepValue', () => {
  it('0 sotto il 33%, 0,5 per un 3HKO, 1 per un 2HKO, 1,5 per un OHKO sicuro; le mosse OHKO mai 1,5', () => {
    expect(stepValue({ move: 'Earthquake', expected: 0.32, min: 0.3 })).toBe(0);
    expect(stepValue({ move: 'Earthquake', expected: 0.34, min: 0.3 })).toBe(0.5);
    expect(stepValue({ move: 'Earthquake', expected: 0.49, min: 0.4 })).toBe(0.5);
    expect(stepValue({ move: 'Earthquake', expected: 0.5, min: 0.45 })).toBe(1);
    expect(stepValue({ move: 'Earthquake', expected: 1.2, min: 0.99 })).toBe(1);
    expect(stepValue({ move: 'Earthquake', expected: 1.2, min: 1 })).toBe(1.5);
    expect(stepValue({ move: 'Sheer Cold', expected: 0.3, min: 1 })).toBe(0);
    expect(stepValue(null)).toBe(0);
  });
});

describe('memberOffense', () => {
  it('una mossa speciale debole su un attaccante fisico non conta', () => {
    const plain = memberOffense(chomp, [chomp], fixtureData)!;
    const withWeak = memberOffense({ ...chomp, moves: [...chomp.moves, 'Earth Power'] }, [chomp], fixtureData)!;
    expect(withWeak.power).toBe(plain.power);
  });

  it('Body Press con Iron Defense è un setup, senza no', () => {
    const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 252 });
    expect(memberOffense(corv, [corv], fixtureData)!.setupMove).toBe('Iron Defense');
    const noSetup = { ...corv, moves: ['Body Press', 'Roost', 'U-turn'] };
    expect(memberOffense(noSetup, [noSetup], fixtureData)!.setupMove).toBeNull();
  });

  it('Gliscor con Swords Dance: il setup alza l\'Offesa del team (il Potenziale)', () => {
    const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Swords Dance', 'Earthquake', 'Facade', 'Protect'], 'Jolly', { hp: 244, atk: 12, spe: 252 });
    const team = teamOffense([gliscor], noStats);
    expect(team.wallbreakingSetup).toBeGreaterThan(team.wallbreaking);
    expect(team.setupGain).toBeGreaterThan(0);
    expect(team.setters).toEqual([{ species: 'Gliscor', move: 'Swords Dance' }]);
  });

  it('la pioggia del team alza la Potenza di chi ne gode; chi la porta con l\'abilità la ha piena', () => {
    const swim = set('Vaporeon', 'Leftovers', 'Water Absorb', ['Scald', 'Wish'], 'Bold', { hp: 252, def: 252 });
    const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Hydro Pump', 'U-turn', 'Roost'], 'Modest', { hp: 248, spa: 252 });
    expect(memberOffense(swim, [swim, pelipper], noStats)!.power).toBeGreaterThan(memberOffense(swim, [swim], noStats)!.power);
    const politoed = set('Politoed', 'Damp Rock', 'Drizzle', ['Scald'], 'Calm', { hp: 252, spd: 252 });
    const keenEye = { ...pelipper, ability: 'Keen Eye' };
    expect(memberOffense(pelipper, [pelipper], fixtureData)!.power).toBeGreaterThanOrEqual(memberOffense(keenEye, [keenEye, politoed], fixtureData)!.power);
  });

  it('il sole non abbassa mai il danno', () => {
    const water = set('Kingdra', 'Choice Specs', 'Sniper', ['Hydro Pump', 'Draco Meteor'], 'Modest', { spa: 252, spe: 252 });
    const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume'], 'Bold', { hp: 252, def: 252 });
    expect(memberOffense(water, [water, torkoal], fixtureData)!.power).toBe(memberOffense(water, [water], fixtureData)!.power);
  });

  it('il Tera conta solo dove il formato lo permette', () => {
    const gambit = set('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 252, atk: 252 });
    const teraGambit = { ...gambit, teraType: 'Dark' };
    expect(memberOffense(teraGambit, [teraGambit], gen9)!.power).toBeGreaterThan(memberOffense(gambit, [gambit], gen9)!.power);
    expect(memberOffense(teraGambit, [teraGambit], noStats)!.power).toBe(memberOffense(gambit, [gambit], noStats)!.power);
  });

  it('il valore del membro è Potenza e Wallbreaking, più il Potenziale del setup (nessun numero Setup)', () => {
    const volc = set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Flamethrower', 'Bug Buzz', 'Roost'], 'Timid', { spa: 252, spe: 252 });
    const m = memberOffense(volc, [volc], fixtureData)!;
    expect(m.value - m.setupGain).toBe(Math.round((0.5 * m.power + 0.35 * m.wallbreaking) / 0.85));
    expect('setup' in m).toBe(false);
  });

  it("il 100 di Wallbreaking e Potenza è il 3° miglior attaccante del meta, o l'ultimo se sono meno", () => {
    const ref = offenseReference(fixtureData);
    const fifth = mostCommonSet(fixtureStats, ref.attackers[Math.min(REFERENCE_RANK, ref.attackers.length) - 1])!;
    const m = memberOffense(fifth, [fifth], fixtureData)!;
    // Il riferimento vale circa 93: la scala rallenta sopra 80 e non arriva mai a 100
    expect(Math.abs(m.wallbreaking - 93)).toBeLessThanOrEqual(1);
  });

  it('una specie sconosciuta non conta', () => {
    expect(memberOffense(set('Notamon', '', '', ['Tackle'], 'Hardy', {}), [tusk], fixtureData)).toBeNull();
  });

  it('lo stesso set dà lo stesso risultato', () => {
    expect(memberOffense(chomp, [chomp], fixtureData)).toEqual(memberOffense({ ...chomp }, [chomp], fixtureData));
  });
});

describe('teamOffense', () => {
  it('media pesata per posizione: il più offensivo pesa di più (22/18/16/15/15/14), nessun peso per i supporti', () => {
    expect(RANK_WEIGHTS).toEqual([0.22, 0.18, 0.16, 0.15, 0.15, 0.14]);
    const team = teamOffense([blissey, chomp], fixtureData);
    expect('support' in team.members[0]).toBe(false);
  });

  it('un team senza mosse d\'attacco vale 0, senza NaN', () => {
    const wall = set('Toxapex', 'Black Sludge', 'Regenerator', ['Recover', 'Toxic', 'Haze', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252 });
    const team = teamOffense([wall], fixtureData);
    expect([team.value, team.power, team.wallbreaking, team.setupGain]).toEqual([0, 0, 0, 0]);
    expect(team.setters).toEqual([]);
  });

  it('un membro sconosciuto si salta', () => {
    const notamon = set('Notamon', '', '', ['Tackle'], 'Hardy', {});
    expect(teamOffense([tusk, notamon], fixtureData).value).toBe(teamOffense([tusk], fixtureData).value);
  });

  it('senza statistiche si usa il tier', () => {
    expect(teamOffense([tusk], { stats: null, sets: null, formatId: 'ou' }).value).toBeGreaterThan(0);
  });
});

describe('correzioni della revisione', () => {
  it('Belly Drum e Curse sono setup', () => {
    const azu = set('Azumarill', 'Sitrus Berry', 'Huge Power', ['Belly Drum', 'Aqua Jet', 'Play Rough', 'Knock Off'], 'Adamant', { hp: 252, atk: 252 });
    const snorlax = set('Snorlax', 'Leftovers', 'Thick Fat', ['Curse', 'Body Slam', 'Rest', 'Sleep Talk'], 'Careful', { hp: 252, spd: 252 });
    expect(memberOffense(azu, [azu], fixtureData)!.setupMove).toBe('Belly Drum');
    expect(memberOffense(snorlax, [snorlax], fixtureData)!.setupMove).toBe('Curse');
  });

  it('il riferimento senza meta non resta quello di riserva se prima mancavano i dati', () => {
    expect(offenseReference({ stats: null, sets: null, formatId: 'uu' }).power).toBe(0.6);
    expect(offenseReference({ ...fixtureData, ignoreMeta: true, formatId: 'uu' }).power).not.toBe(0.6);
  });

  it('dice quanti difensori vengono dal meta', () => {
    const team = teamOffense([chomp], fixtureData);
    expect(team.metaDefenders).toBeLessThan(team.defenders.length);
    expect(teamOffense([chomp], noStats).metaDefenders).toBe(0);
  });
});

describe('scala dei membri e del team', () => {
  it('contro ogni difensore il danno conta al massimo il 100%: un KO esagerato non gonfia la Potenza', () => {
    // Ninetales al sole: Weather Ball di Fuoco va oltre il 100% sui tipi deboli al Fuoco, poco sugli altri
    // Investimento scelto perché il danno medio resti sotto il riferimento fisso (60%) sia con il tetto sia senza
    const ninetales = set('Ninetales', 'Life Orb', 'Drought', ['Weather Ball', 'Encore'], 'Modest', { spa: 120, spe: 252 });
    // La Potenza si misura contro i bersagli della Coverage (senza meta: i 18 tipi neutri, stesso peso)
    const hits = coverageTargets(noStats).map(t => bestHit(ninetales, t.set, { conditions: ['sun'] })?.expected ?? 0);
    const score = (xs: number[]) => softScore(xs.reduce((a, b) => a + b, 0) / xs.length / POWER_FULL);
    const capped = score(hits.map(x => Math.min(1, x)));
    expect(capped).toBeLessThan(score(hits));
    expect(memberOffense(ninetales, [ninetales], noStats)!.power).toBe(capped);
  });

  it('il 100 del membro è il 3° miglior attaccante del meta; la Potenza del team è la media pesata, senza moltiplicatori', () => {
    expect(REFERENCE_RANK).toBe(3);
    const team = teamOffense([chomp, blissey], fixtureData);
    const raw = (0.22 * Math.max(...team.members.map(m => m.power)) + 0.18 * Math.min(...team.members.map(m => m.power))) / 0.4;
    expect(team.power).toBe(Math.round(raw));
  });
});

describe('la Coverage dentro l\'Offesa', () => {
  it('Offesa del team = 75% membri + 25% Coverage, con i buchi', () => {
    const team = teamOffense([chomp, blissey], fixtureData);
    expect(team.coverage).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(team.holes)).toBe(true);
    expect(team.value).toBe(Math.round(0.75 * team.memberValue + 0.25 * team.coverage));
    expect(team.members.map(m => m.covered)).toHaveLength(2);
  });
});

describe('Offesa di squadra', () => {
  const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 252 });
  const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Swords Dance', 'Earthquake', 'Facade', 'Protect'], 'Jolly', { hp: 244, atk: 12, spe: 252 });

  it('Wallbreaking di squadra: conta chi sfonda ogni muro, con la profondità; mai sotto il miglior membro', () => {
    const one = teamOffense([chomp], noStats);
    const two = teamOffense([chomp, { ...chomp }], noStats);
    expect(two.wallbreaking).toBeGreaterThan(one.wallbreaking);
    // Scala naturale: 100 vuol dire ogni muro mandato KO in due colpi da tre membri (la profondità piena)
    expect(TEAM_WALL_FULL).toBe(1);
    // Tre membri uguali: ogni muro vale il valore del colpo del membro, quindi il team fa 100 × il valore medio
    // (il membro senza statistiche si misura sul riferimento fisso 1,25: il suo valore medio è Wallbreaking × 1,25 / 100)
    // Un solo membro: ogni muro vale al massimo 0,7 (nessuna profondità), quindi il team resta sotto 70
    expect(one.wallbreaking).toBeLessThanOrEqual(70);
    expect(teamOffense([chomp, { ...chomp }, { ...chomp }], noStats).wallbreaking).toBeGreaterThan(one.wallbreaking);
    const mixed = teamOffense([chomp, corv], noStats);
    expect(mixed.wallbreaking).toBeGreaterThanOrEqual(Math.max(...mixed.members.map(m => m.wallbreaking)) * 0.7);
  });

  it('Potenziale: nel voto entra metà del guadagno di Wallbreaking col setup; +X è quanto alza l\'Offesa finale', () => {
    const team = teamOffense([gliscor, chomp], noStats);
    const attack = (wall: number) => (0.5 * team.power + 0.35 * wall) / 0.85;
    const effective = team.wallbreaking + SETUP_SHARE * (team.wallbreakingSetup - team.wallbreaking);
    const value = Math.round(0.75 * attack(effective) + 0.25 * team.coverage);
    expect(SETUP_SHARE).toBe(0.5);
    expect(team.value).toBe(value);
    expect(team.setupGain).toBe(value - Math.round(0.75 * attack(team.wallbreaking) + 0.25 * team.coverage));
  });

  it('senza setup il Potenziale è zero', () => {
    const team = teamOffense([chomp], noStats);
    expect([team.wallbreakingSetup, team.setupGain]).toEqual([team.wallbreaking, 0]);
  });

  it('Potenza contro i bersagli della Coverage (senza meta: i 18 tipi neutri), il Wallbreaking contro i muri', () => {
    const targets = coverageTargets(noStats);
    const hits = targets.map(t => Math.min(1, bestHit(chomp, t.set)?.expected ?? 0));
    const mean = hits.reduce((a, h, i) => a + h * targets[i].weight, 0);
    expect(memberOffense(chomp, [chomp], noStats)!.power).toBe(softScore(mean / POWER_FULL));
  });

  it('la Coverage del membro è una percentuale pesata', () => {
    const targets = coverageTargets(noStats);
    const covered = targets.filter(t => Math.min(1, bestHit(chomp, t.set)?.expected ?? 0) >= 0.5).length;
    expect(teamOffense([chomp], noStats).members[0].covered).toBe(Math.round(100 * covered / targets.length));
  });
});

describe('Potenziale del membro e tabella dei muri', () => {
  const volc = set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Flamethrower', 'Bug Buzz', 'Roost'], 'Timid', { spa: 252, spe: 252 });

  it('il setup alza l\'Offesa del membro di metà del suo guadagno; setupGain è la differenza finale', () => {
    const m = memberOffense(volc, [volc], noStats)!;
    expect(m.setupMove).toBe('Quiver Dance');
    expect(m.setupGain).toBeGreaterThan(0);
    expect(m.value - m.setupGain).toBe(Math.round((0.5 * m.power + 0.35 * m.wallbreaking) / 0.85));
    // Nella colonna Wallbreaking: quanto il setup alza il Wallbreaking nel voto (metà del guadagno)
    expect(m.wallbreakingGain).toBeGreaterThan(0);
    expect(m.value).toBe(Math.round((0.5 * m.power + 0.35 * (m.wallbreaking + m.wallbreakingGain)) / 0.85));
    const plain = memberOffense(chomp, [chomp], noStats)!;
    expect(plain.setupGain).toBe(0);
  });

  it('per ogni muro e membro: soglia e danno, senza e con il setup', () => {
    const team = teamOffense([volc, chomp], noStats);
    expect(team.walls).toHaveLength(team.defenders.length);
    for (const wall of team.walls) {
      expect(wall.cells).toHaveLength(2);
      const [v, c] = wall.cells;
      expect(v.setupPct).not.toBeNull();
      expect(v.setupPct!).toBeGreaterThanOrEqual(v.pct);
      expect(c.setupPct).toBeNull();
      expect([0, 0.5, 1, 1.5]).toContain(c.step);
    }
  });
});

describe('dati delle schede del modale', () => {
  it('il colpo migliore di ogni membro è una delle sue mosse d\'attacco', () => {
    const team = teamOffense([chomp, blissey], noStats);
    expect(team.members[0].bestMove).toBe('Earthquake');
    expect(['Seismic Toss']).toContain(team.members[1].bestMove);
  });

  it('per ogni bersaglio della Coverage: tipi, Pokémon, peso e chi lo copre', () => {
    const team = teamOffense([chomp], noStats);
    expect(team.coverageRows).toHaveLength(18);
    const electric = team.coverageRows.find(r => r.label === 'Electric')!;
    expect(electric.coveredBy.map(c => c.species)).toEqual(['Garchomp']);
    // Con la mossa che lo copre e il danno, e quanto è coperto (un membro: 70%)
    expect(electric.coveredBy[0].move).toBe('Earthquake');
    expect(electric.coveredBy[0].pct).toBeGreaterThanOrEqual(50);
    expect(electric.level).toBe(70);
    // Questo Garchomp ha anche Stone Edge: il Volante, immune a Earthquake, lo copre con la Roccia
    expect(team.coverageRows.find(r => r.label === 'Flying')!.coveredBy.map(c => c.move)).toEqual(['Stone Edge']);
    expect(electric.weight).toBeCloseTo(1 / 18);
  });
});
