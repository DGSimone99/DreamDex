import { softScore } from '../../src/engine/scale';
import { describe, expect, it } from 'vitest';
import { memberOffense, offenseReference, rolesMemberOffense, stepBucket, POWER_FULL, RANK_WEIGHTS, REFERENCE_RANK, SETUP_SHARE, ONE_USE_SHARE, stepValue, teamOffense } from '../../src/engine/offense';
import { bestHit } from '../../src/engine/damage';
import { coverageTargets, teamCoverage } from '../../src/engine/coverage';
import { mostCommonSet } from '../../src/engine/sets';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, tusk } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs'], extra: Partial<TeamSet> = {}): TeamSet =>
  ({ species, item, ability, moves, nature, evs, ...extra });

// Senza statistiche il riferimento è fisso (80% dei PS): i confronti di Potenza non arrivano al tetto di 100
const noStats = { stats: null, sets: null, formatId: 'ou' as const };
const gen9 = { stats: null, sets: null, formatId: 'gen9ou' as const };
const chomp = set('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Stone Edge'], 'Adamant', { atk: 252, spe: 252 });
const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Toxic', 'Seismic Toss', 'Stealth Rock'], 'Bold', { hp: 252, def: 252 });

describe('stepValue', () => {
  it('0 sotto il 33%, 0,5 per un 3HKO, 1 per un 2HKO, 1,5 per un OHKO sicuro; le mosse OHKO mai 1,5', () => {
    expect(stepValue({ move: 'Earthquake', expected: 0.32, min: 0.3, max: 0.3 })).toBe(0);
    expect(stepValue({ move: 'Earthquake', expected: 0.34, min: 0.3, max: 0.3 })).toBe(0.5);
    expect(stepValue({ move: 'Earthquake', expected: 0.49, min: 0.4, max: 0.4 })).toBe(0.5);
    expect(stepValue({ move: 'Earthquake', expected: 0.5, min: 0.45, max: 0.45 })).toBe(1);
    expect(stepValue({ move: 'Earthquake', expected: 1.2, min: 0.99, max: 0.99 })).toBe(1);
    expect(stepValue({ move: 'Earthquake', expected: 1.2, min: 1, max: 1 })).toBe(1.5);
    expect(stepValue({ move: 'Sheer Cold', expected: 0.3, min: 1, max: 1 })).toBe(0);
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

  it('Gliscor con Swords Dance: il setup alza la Potenza e l\'Offesa del team', () => {
    const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Swords Dance', 'Earthquake', 'Facade', 'Protect'], 'Jolly', { hp: 244, atk: 12, spe: 252 });
    const team = teamOffense([gliscor], noStats);
    expect(team.members[0].setupGain).toBeGreaterThan(0);
    expect(team.members[0].value).toBe(Math.round(team.members[0].powerInGrade));
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
    // Il Tera entra nel valore (un quarto del guadagno), non nella Potenza base
    expect(memberOffense(teraGambit, [teraGambit], gen9)!.value).toBeGreaterThan(memberOffense(gambit, [gambit], gen9)!.value);
    expect(memberOffense(teraGambit, [teraGambit], noStats)!.value).toBe(memberOffense(gambit, [gambit], noStats)!.value);
  });

  it('il valore del membro è la sua Potenza, più metà del setup e un quarto di Tera/Z; niente Wallbreaking', () => {
    const volc = set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Flamethrower', 'Bug Buzz', 'Roost'], 'Timid', { spa: 252, spe: 252 });
    const m = memberOffense(volc, [volc], fixtureData)!;
    expect(m.value - m.setupGain - m.oneUseGain).toBe(m.power);
    expect('setup' in m).toBe(false);
    expect('wallbreaking' in m).toBe(false);
    expect('wallbreakingGain' in m).toBe(false);
  });

  it("il 100 della Potenza è il miglior attaccante del meta, misurato sui 18 Pokémon medi", () => {
    const ref = offenseReference(fixtureData);
    const best = mostCommonSet(fixtureStats, ref.byPower[0])!;
    const m = memberOffense(best, [best], fixtureData)!;
    // Il riferimento vale 100: la scala è lineare
    expect(Math.abs(m.power - 100)).toBeLessThanOrEqual(1);
  });

  it('la Potenza è la stessa con e senza meta', () => {
    expect(memberOffense(chomp, [chomp], { ...fixtureData, ignoreMeta: true })!.power).toBe(memberOffense(chomp, [chomp], fixtureData)!.power);
  });

  it('una specie sconosciuta non conta', () => {
    expect(memberOffense(set('Notamon', '', '', ['Tackle'], 'Hardy', {}), [tusk], fixtureData)).toBeNull();
  });

  it('lo stesso set dà lo stesso risultato', () => {
    expect(memberOffense(chomp, [chomp], fixtureData)).toEqual(memberOffense({ ...chomp }, [chomp], fixtureData));
  });
});

describe('teamOffense', () => {
  it('media pesata per posizione: il più offensivo pesa di più (30/22/17/13/10/8), nessun peso per i supporti', () => {
    // Più ripidi: le minacce principali contano di più, i supporti meno
    expect(RANK_WEIGHTS).toEqual([0.30, 0.22, 0.17, 0.13, 0.10, 0.08]);
    const team = teamOffense([blissey, chomp], fixtureData);
    expect('support' in team.members[0]).toBe(false);
  });

  it('un team senza mosse d\'attacco vale 0, senza NaN', () => {
    const wall = set('Toxapex', 'Black Sludge', 'Regenerator', ['Recover', 'Toxic', 'Haze', 'Toxic Spikes'], 'Bold', { hp: 252, def: 252 });
    const team = teamOffense([wall], fixtureData);
    expect([team.value, team.power, team.setupGain, team.coverage]).toEqual([0, 0, 0, 0]);
    expect(Number.isNaN(team.value)).toBe(false);
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
    expect(offenseReference({ stats: null, sets: null, formatId: 'uu' }).power).toBe(POWER_FULL);
    expect(offenseReference({ ...fixtureData, ignoreMeta: true, formatId: 'uu' }).power).not.toBe(POWER_FULL);
  });

  it('il Wallbreaking non è più nel team: né valore né tabella dei muri', () => {
    const team = teamOffense([chomp], fixtureData);
    for (const key of ['wallbreaking', 'wallbreakingSetup', 'walls', 'defenders', 'metaDefenders', 'memberValue']) expect(key in team).toBe(false);
  });

  it('i Ruoli usano ancora la vecchia misura del membro, setup compreso', () => {
    const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Swords Dance', 'Earthquake', 'Facade', 'Protect'], 'Jolly', { hp: 244, atk: 12, spe: 252 });
    const old = rolesMemberOffense(gliscor, [gliscor], fixtureData)!;
    expect(old.wallbreakingGain).toBeGreaterThan(0);
    expect(old.setupMove).toBe('Swords Dance');
    expect(rolesMemberOffense(set('Notamon', '', '', ['Tackle'], 'Hardy', {}), [tusk], fixtureData)).toBeNull();
  });

  it('senza statistiche il riferimento della Potenza è quello di riserva', () => {
    expect(offenseReference(noStats).power).toBe(POWER_FULL);
    expect(teamOffense([chomp], noStats).coverageMeta).toBeNull();
  });
});

describe('scala dei membri e del team', () => {
  it('contro ogni difensore il danno conta al massimo il 100%: un KO esagerato non gonfia la Potenza', () => {
    // Ninetales al sole: Weather Ball di Fuoco va oltre il 100% sui tipi deboli al Fuoco, poco sugli altri
    // Investimento scelto perché il danno medio resti sotto il riferimento fisso (80%) sia con il tetto sia senza
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
    const raw = (0.30 * Math.max(...team.members.map(m => m.power)) + 0.22 * Math.min(...team.members.map(m => m.power))) / 0.52;
    expect(team.power).toBe(Math.round(raw));
  });
});

describe('la Coverage dentro l\'Offesa', () => {
  it('col meta: Offesa = Potenza 60% + Coverage tipi 20% + Coverage meta 20%', () => {
    const team = teamOffense([chomp, blissey], fixtureData);
    expect(Array.isArray(team.coverageTypes.holes)).toBe(true);
    expect(team.value).toBe(Math.round(0.6 * team.power + 0.2 * team.coverageTypes.value + 0.2 * team.coverageMeta!.value));
    expect(team.members.map(m => m.coverTypes)).toHaveLength(2);
  });

  it('senza meta: Offesa = Potenza 60% + Coverage tipi 40%', () => {
    const team = teamOffense([chomp, blissey], { ...fixtureData, ignoreMeta: true });
    expect(team.coverageMeta).toBeNull();
    expect(team.value).toBe(Math.round(0.6 * team.power + 0.4 * team.coverageTypes.value));
  });
});

describe('Offesa di squadra', () => {
  const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 252 });
  const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Swords Dance', 'Earthquake', 'Facade', 'Protect'], 'Jolly', { hp: 244, atk: 12, spe: 252 });

  it('il setup: nel voto entra metà del guadagno di Potenza; +X è quanto alza l\'Offesa finale', () => {
    const team = teamOffense([gliscor, chomp], noStats);
    expect(SETUP_SHARE).toBe(0.5);
    expect(team.setupGain).toBeGreaterThan(0);
    const g = team.members.find(m => m.species === 'Gliscor')!;
    expect(g.setupGain).toBeGreaterThan(0);
  });

  it('senza setup il guadagno è zero', () => {
    const team = teamOffense([chomp], noStats);
    expect(team.setupGain).toBe(0);
    expect(team.members[0].setupGain).toBe(0);
    void corv;
  });

  it('Potenza contro i 18 Pokémon medi dei tipi', () => {
    const targets = coverageTargets(noStats);
    const hits = targets.map(t => Math.min(1, bestHit(chomp, t.set)?.expected ?? 0));
    const mean = hits.reduce((a, h, i) => a + h * targets[i].weight, 0);
    expect(memberOffense(chomp, [chomp], noStats)!.power).toBe(softScore(mean / POWER_FULL));
  });

  it('la Coverage del membro è una percentuale pesata', () => {
    const targets = coverageTargets(noStats);
    const covered = targets.filter(t => Math.min(1, bestHit(chomp, t.set, { superEffectiveOnly: true })?.expected ?? 0) >= 0.5).length;
    expect(teamOffense([chomp], noStats).members[0].coverTypes).toBe(Math.round(100 * covered / targets.length));
  });
});

describe('setup del membro', () => {
  const volc = set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Flamethrower', 'Bug Buzz', 'Roost'], 'Timid', { spa: 252, spe: 252 });

  it('il setup alza la Potenza del membro di metà del suo guadagno; setupGain è quella parte', () => {
    const m = memberOffense(volc, [volc], noStats)!;
    expect(m.setupMove).toBe('Quiver Dance');
    expect(m.setupGain).toBeGreaterThan(0);
    expect(m.value).toBe(Math.round(m.powerInGrade));
    expect(m.value - m.setupGain).toBe(m.power);
    const plain = memberOffense(chomp, [chomp], noStats)!;
    expect(plain.setupGain).toBe(0);
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
    expect(team.coverageTypes.rows).toHaveLength(18);
    const electric = team.coverageTypes.rows.find(r => r.label === 'Electric')!;
    expect(electric.coveredBy.map(c => c.species)).toEqual(['Garchomp']);
    // Con la mossa che lo copre e il danno, e quanto è coperto (un membro: 70%)
    expect(electric.coveredBy[0].move).toBe('Earthquake');
    expect(electric.coveredBy[0].pct).toBeGreaterThanOrEqual(50);
    expect(electric.level).toBe(70);
    // Questo Garchomp ha anche Stone Edge: il Volante, immune a Earthquake, lo copre con la Roccia
    expect(team.coverageTypes.rows.find(r => r.label === 'Flying')!.coveredBy.map(c => c.move)).toEqual(['Stone Edge']);
    expect(electric.weight).toBeCloseTo(1 / 18);
  });
});

describe('Coverage di tipi e del meta', () => {
  it('col meta: due sottostatistiche che si dividono a metà il peso della Coverage', () => {
    const team = teamOffense([chomp, blissey], fixtureData);
    expect(team.coverageTypes.rows).toHaveLength(18);
    expect(team.coverageMeta).not.toBeNull();
    expect(team.coverage).toBe(Math.round((team.coverageTypes.value + team.coverageMeta!.value) / 2));
  });

  it('senza meta: solo la Coverage di tipi, con tutto il peso', () => {
    const team = teamOffense([chomp], noStats);
    expect(team.coverageMeta).toBeNull();
    expect(team.coverage).toBe(team.coverageTypes.value);
  });
});

describe('correzioni della revisione finale (soglie e riferimento)', () => {
  it('la soglia di una casella si legge anche dai valori medi (Tera, Z e meteo contano a metà)', () => {
    expect([1.5, 1.25, 1, 0.875, 0.75, 0.625, 0.5, 0.25, 0.1, 0].map(stepBucket))
      .toEqual(['ohko', 'ohko', 'two', 'two', 'two', 'three', 'three', 'three', 'none', 'none']);
  });

  it('il riferimento della Potenza nomina gli attaccanti col danno medio più alto', () => {
    const team = teamOffense([chomp], fixtureData);
    const ref = offenseReference(fixtureData);
    expect(team.referenceAttackers).toEqual(ref.byPower.slice(0, 3));
  });
});

describe('team con due meteo', () => {
  it('ogni membro usa il meteo del team che gli conviene: un Fuoco col sole anche se c\'è anche la pioggia', () => {
    const fire = set('Arcanine', 'Leftovers', 'Intimidate', ['Flamethrower'], 'Bold', { hp: 252, def: 252 });
    const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane'], 'Modest', { hp: 248, spa: 252 });
    const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume'], 'Bold', { hp: 252, def: 252 });
    const sunOnly = memberOffense(fire, [fire, torkoal], noStats)!.power;
    expect(sunOnly).toBeGreaterThan(memberOffense(fire, [fire], noStats)!.power);
    expect(memberOffense(fire, [fire, pelipper, torkoal], noStats)!.power).toBe(sunOnly);
  });
});

describe('Tera e mosse Z: una volta a partita', () => {
  it('il valore base è senza Tera; nel voto entra un quarto del guadagno, mostrato a parte', () => {
    const gambit = set('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 252, atk: 252 });
    const tera = memberOffense({ ...gambit, teraType: 'Dark' }, [gambit], gen9)!;
    const plain = memberOffense(gambit, [gambit], gen9)!;
    expect(tera.power).toBe(plain.power);
    expect(tera.oneUse).toEqual({ kind: 'tera', name: 'Dark' });
    expect(tera.oneUseGain).toBeGreaterThan(0);
    expect(tera.value - tera.oneUseGain).toBe(plain.value);
    expect(ONE_USE_SHARE).toBe(0.25);
  });

  it('la mossa Z conta allo stesso modo (National Dex)', () => {
    const kyurem = set('Kyurem', 'Groundium Z', 'Pressure', ['Earth Power', 'Ice Beam'], 'Timid', { spa: 252, spe: 252 });
    const m = memberOffense(kyurem, [kyurem], noStats)!;
    expect(m.oneUse).toEqual({ kind: 'z', name: 'Groundium Z' });
    expect(m.oneUseGain).toBeGreaterThanOrEqual(0);
    expect(memberOffense(chomp, [chomp], noStats)!.oneUse).toBeNull();
  });
});

describe('il membro nelle colonne di Generale', () => {
  it('Coverage tipi e meta del membro, e il suo totale con i pesi della squadra (60/20/20, senza meta 60/40)', () => {
    const m = memberOffense(chomp, [chomp], fixtureData)!;
    expect(m.coverTypes).toBe(teamCoverage([chomp], fixtureData, 'types').perMember[0]);
    expect(m.coverMeta).toBe(teamCoverage([chomp], fixtureData, 'meta').perMember[0]);
    expect(m.total).toBe(Math.round(0.6 * m.powerInGrade + 0.2 * m.coverTypes + 0.2 * m.coverMeta!));
    const plain = memberOffense(chomp, [chomp], { ...fixtureData, ignoreMeta: true })!;
    expect(plain.coverMeta).toBeNull();
    expect(plain.total).toBe(Math.round(0.6 * plain.powerInGrade + 0.4 * plain.coverTypes));
    // Il valore resta la Potenza (serve a dire chi è un attaccante forte)
    expect(m.value).toBe(Math.round(m.powerInGrade));
  });
});
