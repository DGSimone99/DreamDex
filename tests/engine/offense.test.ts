import { describe, expect, it } from 'vitest';
import { memberOffense, stepValue, teamOffense } from '../../src/engine/offense';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData, tusk } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs'], extra: Partial<TeamSet> = {}): TeamSet =>
  ({ species, item, ability, moves, nature, evs, ...extra });

const gen9 = { ...fixtureData, formatId: 'gen9ou' as const };
const chomp = set('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Stone Edge'], 'Adamant', { atk: 252, spe: 252 });
const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Toxic', 'Seismic Toss', 'Stealth Rock'], 'Bold', { hp: 252, def: 252 });

describe('stepValue', () => {
  it('0 sotto il 50%, 1 per un 2HKO, 1,5 per un OHKO sicuro; le mosse OHKO mai 1,5', () => {
    expect(stepValue({ move: 'Earthquake', expected: 0.49, min: 0.4 })).toBe(0);
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
    expect(memberOffense(swim, [swim, pelipper], fixtureData)!.power).toBeGreaterThan(memberOffense(swim, [swim], fixtureData)!.power);
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
    expect(memberOffense(teraGambit, [teraGambit], fixtureData)!.power).toBe(memberOffense(gambit, [gambit], fixtureData)!.power);
  });

  it('una specie sconosciuta non conta', () => {
    expect(memberOffense(set('Notamon', '', '', ['Tackle'], 'Hardy', {}), [tusk], fixtureData)).toBeNull();
  });

  it('lo stesso set si calcola una volta', () => {
    expect(memberOffense(chomp, [chomp], fixtureData)).toBe(memberOffense(chomp, [chomp], fixtureData));
  });
});

describe('teamOffense', () => {
  it('un supporto pesa la metà di un attaccante', () => {
    const team = teamOffense([chomp, blissey], fixtureData);
    const [a, b] = team.members;
    expect(b.support).toBe(true);
    expect(team.value).toBe(Math.round((a.value + 0.5 * b.value) / 1.5));
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
