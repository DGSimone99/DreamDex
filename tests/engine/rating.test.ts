import { describe, expect, it } from 'vitest';
import { teamPower } from '../../src/engine/power';
import { AREA_KNEE, AREA_WEIGHTS, BULK_SHARE, COVERAGE_DEPTH, DEFENSE_FULL, DEFENSIVE_BLEND, SPEED_WEIGHT, areaValue, gradeFor, rateTeam, typeSafety } from '../../src/engine/rating';
import { memberPower } from '../../src/engine/power';

// Offesa 1:1: la media dei percentili d'attacco dei membri
const offenseArea = (team: TeamSet[]) => Math.round(Math.min(100, team.reduce((a, s) => a + memberPower(s)!.offense, 0) / team.length));
import { hitQuality } from '../../src/engine/power';
import { UNIFORM_TYPE_WEIGHTS } from '../../src/engine/analysis';
import { superEffectiveMoves, TYPES, weaknessTable } from '../../src/engine/types';

/** Coverage difensiva mostrata: riferimento all'80%, poi la cima più lenta. */
const defenseShown = (percent: number) => Math.round(100 * areaValue(percent / 100, DEFENSE_FULL));
import { mostCommonSet, type TeamSet } from '../../src/engine/sets';
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
    // Saldo: immunità +2, ×¼ +1,5, ×½ +1, ×2 −1, ×4 −2; sicuro a +2, scoperto a −2
    expect(typeSafety([0, 1, 1])).toBe(1);
    expect(typeSafety([0.5, 0.5])).toBe(1);
    expect(typeSafety([0.5, 1])).toBe(0.75);
    expect(typeSafety([1, 1])).toBe(0.5);
    expect(typeSafety([2, 0.5])).toBe(0.5);
    expect(typeSafety([2, 1])).toBe(0.25);
    expect(typeSafety([4, 0.5])).toBe(0.25);
    expect(typeSafety([4, 1])).toBe(0);
    // Un ×4 pesa come due ×2, un'immunità come due resistenze
    expect(typeSafety([4])).toBe(typeSafety([2, 2]));
    expect(typeSafety([0])).toBe(typeSafety([0.5, 0.5]));
  });
});

describe('rateTeam', () => {
  const rating = rateTeam([tusk, gholdengo], fixtureData)!;

  it('aree calcolate sulla fixture', () => {
    // Coverage difensiva: saldo resistenze/debolezze per tipo, pesato per il meta (piena a 80%); Robustezza: media dei membri
    const weights = UNIFORM_TYPE_WEIGHTS;
    const defense = weaknessTable([tusk, gholdengo]).reduce((acc, row) => acc + weights[row.type] * typeSafety(row.multipliers), 0);
    expect(value(rating, 'defense')).toBe(defenseShown(100 * defense));
    const bulk = [tusk, gholdengo].reduce((a, s) => a + memberPower(s)!.bulk, 0) / 2 / 100;
    expect(value(rating, 'bulk')).toBe(Math.round(100 * Math.min(1, bulk)));
    // Le due si dividono il peso della difesa: per un balance (team incompleto) il 35% va alla Robustezza
    expect(rating.weights.bulk! / (rating.weights.bulk! + rating.weights.defense!)).toBeCloseTo(BULK_SHARE.balance);
    // Coverage in profondità: per tipo, il colpo migliore di ogni membro, 70% al primo e 20% al secondo
    const w = UNIFORM_TYPE_WEIGHTS;
    const coverage = TYPES.reduce((acc, type) => {
      const best = [tusk, gholdengo].map(s => Math.max(0, ...superEffectiveMoves(s, type).map(m => hitQuality(s, m)))).sort((a, b) => b - a);
      return acc + w[type] * Math.min(1, COVERAGE_DEPTH.reduce((a, share, i) => a + share * (best[i] ?? 0), 0));
    }, 0);
    // 1:1: la percentuale è il voto dell'area
    expect(value(rating, 'coverage')).toBe(Math.round(100 * coverage));
    // Offesa: quanto colpiscono forte i membri (statistiche base), indipendente dall'uso nel meta
    expect(value(rating, 'strength')).toBe(offenseArea([tusk, gholdengo]));
  });

  it('voto complessivo pesato, provvisorio con meno di 6 membri', () => {
    // Pesi effettivi delle aree (somma 1); il Meta non pesa, è una penalità
    expect(Object.values(rating.weights).reduce((a, b) => a + b!, 0)).toBeCloseTo(1);
    const base = rating.areas.filter(a => a.key !== 'meta').reduce((acc, a) => acc + rating.weights[a.key]! * a.value!, 0);
    expect(Math.abs(rating.base - Math.round(base))).toBeLessThanOrEqual(1);
    expect(rating).toMatchObject({ overall: rating.base, provisional: true });
  });

  it('ordine e nomi delle aree', () => {
    expect(rating.areas.map(a => a.label)).toEqual(['Coverage offensiva', 'Coverage difensiva', 'Offesa', 'Robustezza', 'Ruoli', 'Velocità', 'Meta']);
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
    expect(value(noData, 'strength')).toBe(offenseArea([tusk, gholdengo]));
  });
});

describe('cima delle aree', () => {
  it('fino al ginocchio come prima; il riferimento vale meno di 100; il 100 solo con la perfezione', () => {
    expect(areaValue(0.5, 0.9)).toBeCloseTo(0.5 / 0.9);
    expect(areaValue(AREA_KNEE * 0.9, 0.9)).toBeCloseTo(AREA_KNEE);
    expect(areaValue(0.9, 0.9)).toBeGreaterThan(AREA_KNEE);
    expect(areaValue(0.9, 0.9)).toBeLessThan(1);
    expect(areaValue(1, 0.9)).toBe(1);
  });

  it('coverage offensiva 1:1: un membro su ogni tipo vale 70, due 90, tre 100', () => {
    const team = (n: number) => Array.from({ length: n }, () => tusk);
    // Con lo stesso membro ripetuto ogni tipo che colpisce è preso 1, 2 o 3 volte: il valore scala come le quote
    const one = value(rateTeam(team(1), fixtureData)!, 'coverage')!;
    const two = value(rateTeam(team(2), fixtureData)!, 'coverage')!;
    const three = value(rateTeam(team(3), fixtureData)!, 'coverage')!;
    expect(two / one).toBeCloseTo(0.9 / 0.7, 1);
    expect(three / one).toBeCloseTo(1 / 0.7, 1);
    expect(COVERAGE_DEPTH).toEqual([0.7, 0.2, 0.1]);
  });
});


describe('pesi secondo il tipo di team', () => {
  it('offense invariato; balance e semi-stall si spostano verso i pesi dello stall', () => {
    expect(DEFENSIVE_BLEND.hyperOffense).toBe(0);
    expect(DEFENSIVE_BLEND.bulkyOffense).toBe(0);
    expect(DEFENSIVE_BLEND.balance).toBeGreaterThan(0);
    expect(DEFENSIVE_BLEND.semiStall).toBeGreaterThan(DEFENSIVE_BLEND.balance);
  });

  it('un team incompleto non si sposta: il suo tipo è solo presunto', () => {
    const rating = rateTeam([tusk, gholdengo], fixtureData)!;
    expect(rating.weights.speed!).toBeGreaterThan(0);
    expect(value(rating, 'strength')).toBe(offenseArea([tusk, gholdengo]));
  });
});

describe('il meta conta solo nella sua area', () => {
  it('le aree sono le stesse col meta e senza; col meta si aggiunge solo il Meta', () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
    const on = rateTeam(team, fixtureData)!;
    const off = rateTeam(team, { ...fixtureData, ignoreMeta: true })!;
    const areas = (r: typeof on) => r.areas.filter(a => a.key !== 'meta').map(a => [a.key, a.value]);
    expect(areas(on)).toEqual(areas(off));
    expect(on.areas.some(a => a.key === 'meta')).toBe(true);
    expect(off.areas.some(a => a.key === 'meta')).toBe(false);
  });
});
