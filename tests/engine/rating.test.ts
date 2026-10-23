import { describe, expect, it } from 'vitest';
import { teamPower } from '../../src/engine/power';
import { AREA_KNEE, ARCHETYPE_WEIGHTS, DEFENSE_FULL, areaValue, gradeFor, rateTeam, typeSafety } from '../../src/engine/rating';
import { memberPower } from '../../src/engine/power';
import { teamOffense } from '../../src/engine/offense';
import { teamDefense } from '../../src/engine/defense';
import type { EngineData } from '../../src/engine/data';

// Offesa: il danno vero dei set contro i difensori del formato (offense.ts)
const offenseArea = (team: TeamSet[], data: EngineData = fixtureData) => teamOffense(team, data).value;
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
  it('una tabella per tipo di team, ogni riga somma 100: ognuno si giudica su quello con cui vince', () => {
    for (const row of Object.values(ARCHETYPE_WEIGHTS)) expect(Object.values(row).reduce((a, b) => a + b, 0)).toBe(100);
    const { hyperOffense: ho, balance, stall } = ARCHETYPE_WEIGHTS;
    // L'hyper offense vince con Offesa e Velocità, lo stall con Difesa e Ruoli; il balance sta nel mezzo
    expect(ho.strength).toBeGreaterThan(stall.strength);
    expect(ho.speed).toBeGreaterThan(balance.speed);
    expect(stall.speed).toBe(0);
    expect(stall.defense).toBeGreaterThan(balance.defense);
    expect(balance.defense).toBeGreaterThan(ho.defense);
    // La Coverage offensiva è una sottostatistica dell'Offesa: il suo peso è passato all'Offesa
    // La Difesa ha preso il peso di Coverage difensiva e Robustezza (e il Meta è dentro di lei)
    expect(Object.keys(balance)).toEqual(['defense', 'strength', 'roles', 'speed']);
    expect([ho.defense, ARCHETYPE_WEIGHTS.bulkyOffense.defense, balance.defense, ARCHETYPE_WEIGHTS.semiStall.defense, stall.defense]).toEqual([20, 28, 36, 46, 56]);
    expect([ho.strength, balance.strength, stall.strength]).toEqual([46, 34, 18]);
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
    // Difesa: robustezza e coverage difensiva di tipi e del meta (defense.ts)
    expect(value(rating, 'defense')).toBe(teamDefense([tusk, gholdengo], fixtureData).value);
    expect(rating.defense.members.map(m => m.species)).toEqual(['Great Tusk', 'Gholdengo']);
    // Un team incompleto si giudica come balance
    expect(rating.weights.defense!).toBeCloseTo(ARCHETYPE_WEIGHTS.balance.defense / 100);
    // La Coverage offensiva non è più un'area: è dentro l'Offesa
    expect(rating.areas.some(a => a.key === 'coverage')).toBe(false);
    // Offesa: il danno vero dei set contro i difensori del meta
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
    // Il Meta non è più un'area: le minacce sono nella Coverage meta della Difesa
    expect(rating.areas.map(a => a.label)).toEqual(['Difesa', 'Offesa', 'Ruoli', 'Velocità']);
  });

  it('team completo: non provvisorio', () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
    expect(rateTeam(team, fixtureData)!.provisional).toBe(false);
  });

  it('team vuoto: nessuna valutazione', () => {
    expect(rateTeam([], fixtureData)).toBeNull();
  });

  it("senza statistiche Smogon l'Offesa resta calcolabile (difensori del tier)", () => {
    const noData = rateTeam([tusk, gholdengo], { stats: null, sets: null })!;
    expect(value(noData, 'strength')).toBe(offenseArea([tusk, gholdengo], { stats: null, sets: null }));
    expect(noData.offense.members.map(m => m.species)).toEqual(['Great Tusk', 'Gholdengo']);
  });

  it("la Velocità non entra nell'Offesa", () => {
    const slow = { ...tusk, evs: { ...tusk.evs, spe: 0, hp: 252 }, nature: 'Adamant' };
    const fast = { ...tusk, evs: { ...tusk.evs, spe: 252, hp: 0 }, nature: 'Adamant' };
    expect(value(rateTeam([slow, gholdengo], fixtureData)!, 'strength')).toBe(value(rateTeam([fast, gholdengo], fixtureData)!, 'strength'));
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

});


describe('pesi secondo il tipo di team', () => {
  it('un team incompleto non si sposta: il suo tipo è solo presunto', () => {
    const rating = rateTeam([tusk, gholdengo], fixtureData)!;
    expect(rating.weights.speed!).toBeGreaterThan(0);
    expect(value(rating, 'strength')).toBe(offenseArea([tusk, gholdengo]));
  });
});

describe('il meta conta solo nella sua area', () => {
  it("le aree sono le stesse col meta e senza (tranne l'Offesa, che usa i difensori del meta); col meta si aggiunge il Meta", () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
    const on = rateTeam(team, fixtureData)!;
    const off = rateTeam(team, { ...fixtureData, ignoreMeta: true })!;
    // Offesa e Difesa si misurano contro il meta, se attivo; le altre aree no
    const areas = (r: typeof on) => r.areas.filter(a => !['meta', 'strength', 'defense'].includes(a.key)).map(a => [a.key, a.value]);
    expect(areas(on)).toEqual(areas(off));
    expect(on.areas.some(a => a.key === 'meta')).toBe(false);
    expect(on.meta).not.toBeNull();
  });
});
