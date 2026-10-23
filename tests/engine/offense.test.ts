import { describe, expect, it } from 'vitest';
import { memberOffense, offenseReference, POWER_FULL, RANK_WEIGHTS, REFERENCE_RANK, stepValue, teamOffense } from '../../src/engine/offense';
import { bestHit } from '../../src/engine/damage';
import { defenderPanel } from '../../src/engine/defenders';
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

  it('Body Press con Iron Defense ha il Setup, senza no', () => {
    const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense', 'Roost'], 'Impish', { hp: 252, def: 252 });
    expect(memberOffense(corv, [corv], fixtureData)!.setup).toBeGreaterThan(0);
    const noSetup = { ...corv, moves: ['Body Press', 'Roost', 'U-turn'] };
    expect(memberOffense(noSetup, [noSetup], fixtureData)!.setup).toBeNull();
  });

  it('Gliscor con Swords Dance: dopo il setup sfonda almeno quanto prima', () => {
    const gliscor = set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Swords Dance', 'Earthquake', 'Facade', 'Protect'], 'Jolly', { hp: 244, atk: 12, spe: 252 });
    const m = memberOffense(gliscor, [gliscor], fixtureData)!;
    expect(m.setup!).toBeGreaterThanOrEqual(m.wallbreaking);
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

  it('il Setup può solo aggiungere: mai sotto il valore senza setup', () => {
    const volc = set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Flamethrower', 'Bug Buzz', 'Roost'], 'Timid', { spa: 252, spe: 252 });
    const m = memberOffense(volc, [volc], fixtureData)!;
    expect(m.value).toBeGreaterThanOrEqual(Math.round((0.5 * m.power + 0.35 * m.wallbreaking) / 0.85));
  });

  it("il 100 di Wallbreaking e Potenza è il 3° miglior attaccante del meta, o l'ultimo se sono meno", () => {
    const ref = offenseReference(fixtureData);
    const fifth = mostCommonSet(fixtureStats, ref.attackers[Math.min(REFERENCE_RANK, ref.attackers.length) - 1])!;
    const m = memberOffense(fifth, [fifth], fixtureData)!;
    expect(m.wallbreaking).toBeGreaterThanOrEqual(99);
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
    expect([team.value, team.power, team.wallbreaking, team.setup]).toEqual([0, 0, 0, null]);
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
    expect(memberOffense(azu, [azu], fixtureData)!.setup).not.toBeNull();
    expect(memberOffense(snorlax, [snorlax], fixtureData)!.setup).not.toBeNull();
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
    // Ninetales al sole senza investimento: Weather Ball di Fuoco va oltre il 100% sugli Acciaio, poco sugli altri
    const ninetales = set('Ninetales', 'Heat Rock', 'Drought', ['Weather Ball', 'Encore'], 'Bold', { hp: 252, def: 252 });
    const hits = defenderPanel(noStats).map(d => bestHit(ninetales, d, { conditions: ['sun'] })?.expected ?? 0);
    const score = (xs: number[]) => Math.round(100 * Math.min(1, xs.reduce((a, b) => a + b, 0) / xs.length / POWER_FULL));
    const capped = score(hits.map(x => Math.min(1, x)));
    expect(capped).toBeLessThan(score(hits));
    expect(memberOffense(ninetales, [ninetales], noStats)!.power).toBe(capped);
  });

  it('il 100 del membro è il 3° miglior attaccante del meta; il team è la media pesata, senza moltiplicatori', () => {
    expect(REFERENCE_RANK).toBe(3);
    const team = teamOffense([chomp, blissey], fixtureData);
    const raw = (0.22 * Math.max(...team.members.map(m => m.value)) + 0.18 * Math.min(...team.members.map(m => m.value))) / 0.4;
    expect(team.memberValue).toBe(Math.round(raw));
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
