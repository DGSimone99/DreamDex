import { describe, expect, it } from 'vitest';
import { holdStep, memberDefense, sustainability } from '../../src/engine/defense';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noStats = { stats: null, sets: null, formatId: 'ou' as const };
const hit = (max: number) => ({ move: 'x', expected: max, min: max, max });

describe('holdStep: quanti colpi regge (dal tiro più alto)', () => {
  it('OHKO 0, 2HKO 0,5, 3HKO 1, 4HKO o più 1,5', () => {
    expect([hit(1.2), hit(0.6), hit(0.4), hit(0.2)].map(holdStep)).toEqual([0, 0.5, 1, 1.5]);
    expect(holdStep(null)).toBe(1.5);
  });
});

describe('sustainability: recupero contro perdite per turno', () => {
  it('Boots e Magic Guard azzerano Stealth Rock; Magic Guard anche Life Orb', () => {
    const zard = set('Charizard', 'Leftovers', 'Blaze', ['Flamethrower'], 'Timid', { spa: 252 });
    expect(sustainability(zard, 1.5)).toBeCloseTo(0.0625 - 0.5);
    expect(sustainability({ ...zard, item: 'Heavy-Duty Boots' }, 1.5)).toBeCloseTo(0);
    const clef = set('Clefable', 'Life Orb', 'Magic Guard', ['Moonblast', 'Moonlight'], 'Modest', { hp: 252, spa: 252 });
    expect(sustainability(clef, 1.5)).toBeCloseTo(0.5);
  });

  it('Regenerator vale 0,33; il recupero si dimezza per chi non regge almeno un 3HKO', () => {
    const slowbro = set('Slowbro', 'Heavy-Duty Boots', 'Regenerator', ['Slack Off', 'Scald'], 'Bold', { hp: 252, def: 252 });
    expect(sustainability(slowbro, 1)).toBeCloseTo(0.5 + 0.33);
    expect(sustainability(slowbro, 0.5)).toBeCloseTo((0.5 + 0.33) / 2);
  });
});

describe('memberDefense', () => {
  const blissey = set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss'], 'Bold', { hp: 252, def: 252 });

  it('Blissey regge meglio gli speciali dei fisici', () => {
    const m = memberDefense(blissey, [blissey], noStats)!;
    expect(m.special).toBeGreaterThan(m.physical);
  });

  it('Assault Vest alza solo la Robustezza speciale', () => {
    // Un Pokémon non già al massimo della scala sul lato speciale
    const chomp = set('Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake'], 'Jolly', { atk: 252, spe: 252 });
    const plain = memberDefense(chomp, [chomp], noStats)!;
    const av = memberDefense({ ...chomp, item: 'Assault Vest' }, [chomp], noStats)!;
    expect(av.special).toBeGreaterThan(plain.special);
    expect(av.physical).toBe(plain.physical);
  });

  it('valore = 40% Fisica + 40% Speciale + 20% Sostenibilità, mai 100', () => {
    const m = memberDefense(blissey, [blissey], fixtureData)!;
    expect(m.value).toBe(Math.round(0.4 * m.physical + 0.4 * m.special + 0.2 * m.sustain));
    expect(m.value).toBeLessThan(100);
  });

  it('una specie sconosciuta non conta', () => {
    expect(memberDefense(set('Notamon', '', '', [], 'Hardy', {}), [], noStats)).toBeNull();
  });
});
