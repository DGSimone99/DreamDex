import { describe, expect, it } from 'vitest';
import { teamPower } from '../../src/engine/power';
import { AREA_WEIGHTS, gradeFor, rateTeam, typeSafety } from '../../src/engine/rating';
import { mostCommonSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

const value = (rating: ReturnType<typeof rateTeam>, key: string) => rating!.areas.find(a => a.key === key)!.value;

describe('gradeFor', () => {
  it('soglie S / A / B / C / D', () => {
    expect(gradeFor(90)).toEqual({ grade: 'S', label: 'Eccellente' });
    expect(gradeFor(89)).toEqual({ grade: 'A', label: 'Ottimo' });
    expect(gradeFor(82)).toEqual({ grade: 'A', label: 'Ottimo' });
    expect(gradeFor(81)).toEqual({ grade: 'B', label: 'Buono' });
    expect(gradeFor(70)).toEqual({ grade: 'B', label: 'Buono' });
    expect(gradeFor(60)).toEqual({ grade: 'C', label: 'Discreto' });
    expect(gradeFor(59)).toEqual({ grade: 'D', label: 'Debole' });
  });
});

describe('pesi delle aree', () => {
  it('4 aree, Forza al 20%, somma 1', () => {
    expect(AREA_WEIGHTS).toEqual({ defense: 0.325, coverage: 0.25, roles: 0.225, strength: 0.2 });
    expect(Object.values(AREA_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('typeSafety', () => {
  it('premia le resistenze, punisce le debolezze scoperte', () => {
    expect(typeSafety(1, 1)).toBe(1);
    expect(typeSafety(0, 2)).toBe(1);
    expect(typeSafety(0, 0)).toBe(0.5);
    expect(typeSafety(1, 0)).toBe(0.25);
    expect(typeSafety(3, 1)).toBe(0);
  });
});

describe('rateTeam', () => {
  const rating = rateTeam([tusk, gholdengo], fixtureData)!;

  it('aree calcolate sulla fixture', () => {
    expect(value(rating, 'defense')).toBe(73);
    expect(value(rating, 'coverage')).toBe(81);
    // Team incompleto giudicato come balance: Rimozione, Minaccia offensiva e Wall fisico (1 + 1 + 1) su 7
    expect(value(rating, 'roles')).toBe(43);
    // Forza dalle statistiche base: media dei membri, indipendente dall'uso nel meta
    expect(value(rating, 'strength')).toBe(teamPower([tusk, gholdengo]).value);
  });

  it('voto complessivo pesato, provvisorio con meno di 6 membri', () => {
    const expected = Math.round(rating.areas.reduce((acc, a) => acc + AREA_WEIGHTS[a.key] * a.value!, 0));
    expect(Math.abs(rating.base - expected)).toBeLessThanOrEqual(1);
    expect(rating).toMatchObject({ overall: rating.base, provisional: true });
  });

  it('ordine e nomi delle aree', () => {
    expect(rating.areas.map(a => a.label)).toEqual(['Difesa', 'Coverage', 'Ruoli', 'Statistiche']);
  });

  it('team completo: non provvisorio', () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
    expect(rateTeam(team, fixtureData)!.provisional).toBe(false);
  });

  it('team vuoto: nessuna valutazione', () => {
    expect(rateTeam([], fixtureData)).toBeNull();
  });

  it('senza statistiche Smogon la forza resta calcolabile (statistiche base)', () => {
    const noData = rateTeam([tusk, gholdengo], { stats: null, sets: null })!;
    expect(value(noData, 'strength')).toBe(teamPower([tusk, gholdengo]).value);
  });
});
