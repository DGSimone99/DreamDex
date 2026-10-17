import { describe, expect, it } from 'vitest';
import { teamPower } from '../../src/engine/power';
import { AREA_FULL, AREA_WEIGHTS, COVERAGE_DEPTH, META_WEIGHT, SPEED_WEIGHT, gradeFor, rateTeam, typeSafety } from '../../src/engine/rating';
import { hitQuality } from '../../src/engine/power';
import { metaTypeWeights } from '../../src/engine/stats';
import { superEffectiveMoves, TYPES } from '../../src/engine/types';

/** Valore mostrato di un'area: piena dal suo riferimento in su (AREA_FULL). */
const full = (key: keyof typeof AREA_FULL, percent: number) => Math.round(Math.min(100, percent / AREA_FULL[key]));
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
  it('5 aree senza meta: Velocità al 20%, le altre nelle proporzioni di prima (Statistiche 30% del resto), somma 1', () => {
    expect(AREA_WEIGHTS.speed).toBe(SPEED_WEIGHT);
    expect(AREA_WEIGHTS.strength).toBeCloseTo(0.3 * (1 - SPEED_WEIGHT));
    // Difesa, Coverage e Ruoli restano nelle proporzioni di prima (32,5 : 25 : 22,5)
    expect(AREA_WEIGHTS.defense / AREA_WEIGHTS.coverage).toBeCloseTo(1.3);
    expect(AREA_WEIGHTS.coverage / AREA_WEIGHTS.roles).toBeCloseTo(0.25 / 0.225);
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
    // Difesa 73% e Coverage 81% della perfezione, tarate: piene a 95% e 97%
    expect(value(rating, 'defense')).toBe(full('defense', 73.2));
    // Coverage in profondità: per tipo, il colpo migliore di ogni membro, 70% al primo e 20% al secondo
    const w = metaTypeWeights(fixtureData.stats);
    const coverage = TYPES.reduce((acc, type) => {
      const best = [tusk, gholdengo].map(s => Math.max(0, ...superEffectiveMoves(s, type).map(m => hitQuality(s, m)))).sort((a, b) => b - a);
      return acc + w[type] * Math.min(1, COVERAGE_DEPTH.reduce((a, share, i) => a + share * (best[i] ?? 0), 0));
    }, 0);
    expect(value(rating, 'coverage')).toBe(full('coverage', 100 * coverage));
    // Un solo colpo per tipo non basta più per la copertura piena
    expect(value(rating, 'coverage')).toBeLessThan(full('coverage', 81));
    // Forza dalle statistiche base: media dei membri, indipendente dall'uso nel meta
    expect(value(rating, 'strength')).toBe(full('strength', teamPower([tusk, gholdengo]).value!));
  });

  it('voto complessivo pesato, provvisorio con meno di 6 membri', () => {
    const base = rating.areas.filter(a => a.key !== 'meta').reduce((acc, a) => acc + AREA_WEIGHTS[a.key as keyof typeof AREA_WEIGHTS] * a.value!, 0);
    const expected = Math.round((1 - META_WEIGHT) * base + META_WEIGHT * value(rating, 'meta')!);
    expect(Math.abs(rating.base - expected)).toBeLessThanOrEqual(1);
    expect(rating).toMatchObject({ overall: rating.base, provisional: true });
  });

  it('ordine e nomi delle aree', () => {
    expect(rating.areas.map(a => a.label)).toEqual(['Difesa', 'Coverage', 'Ruoli', 'Statistiche', 'Velocità', 'Meta']);
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
    expect(value(noData, 'strength')).toBe(full('strength', teamPower([tusk, gholdengo]).value!));
  });
});
