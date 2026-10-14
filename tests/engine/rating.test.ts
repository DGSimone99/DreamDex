import { describe, expect, it } from 'vitest';
import { gradeFor, rateTeam, typeSafety } from '../../src/engine/rating';
import { mostCommonSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

const value = (rating: ReturnType<typeof rateTeam>, key: string) => rating!.areas.find(a => a.key === key)!.value;

describe('gradeFor', () => {
  it('soglie S / A / B / C / D', () => {
    expect(gradeFor(88)).toEqual({ grade: 'S', label: 'Eccellente' });
    expect(gradeFor(87)).toEqual({ grade: 'A', label: 'Ottimo' });
    expect(gradeFor(80)).toEqual({ grade: 'A', label: 'Ottimo' });
    expect(gradeFor(70)).toEqual({ grade: 'B', label: 'Buono' });
    expect(gradeFor(55)).toEqual({ grade: 'C', label: 'Discreto' });
    expect(gradeFor(54)).toEqual({ grade: 'D', label: 'Debole' });
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
    expect(value(rating, 'threats')).toBe(42);
    expect(value(rating, 'roles')).toBe(31);
    expect(value(rating, 'strength')).toBe(90);
    expect(value(rating, 'synergy')).toBe(100);
  });

  it('voto complessivo pesato, provvisorio con meno di 6 membri', () => {
    expect(rating).toMatchObject({ overall: 66, grade: 'C', label: 'Discreto', provisional: true });
  });

  it('ordine e nomi delle aree', () => {
    expect(rating.areas.map(a => a.label)).toEqual(['Difesa', 'Coverage', 'Minacce', 'Ruoli', 'Forza', 'Sinergia']);
  });

  it('team completo: non provvisorio', () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
    expect(rateTeam(team, fixtureData)!.provisional).toBe(false);
  });

  it('team vuoto: nessuna valutazione', () => {
    expect(rateTeam([], fixtureData)).toBeNull();
  });

  it('un solo membro: sinergia n/d', () => {
    expect(value(rateTeam([tusk], fixtureData), 'synergy')).toBeNull();
  });

  it('senza statistiche: minacce, forza e sinergia n/d, voto sulle aree disponibili', () => {
    const noData = rateTeam([tusk, gholdengo], { stats: null, sets: null })!;
    expect(value(noData, 'threats')).toBeNull();
    expect(value(noData, 'strength')).toBeNull();
    expect(value(noData, 'synergy')).toBeNull();
    const d = value(noData, 'defense')!;
    const c = value(noData, 'coverage')!;
    const r = value(noData, 'roles')!;
    expect(Math.abs(noData.overall - (0.25 * d + 0.2 * c + 0.15 * r) / 0.6)).toBeLessThanOrEqual(1);
  });
});
