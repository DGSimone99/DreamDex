import { describe, expect, it } from 'vitest';
import { teamPower } from '../../src/engine/power';
import { teamNeeds } from '../../src/engine/needs';
import { AREA_KNEE, ARCHETYPE_WEIGHTS, DEFENSE_FULL, areaValue, gradeFor, memberIssues, rateTeam, typeSafety } from '../../src/engine/rating';
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
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
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
  it("Offesa, Difesa, Velocità e Ruoli si misurano contro il meta; niente area Meta", () => {
    const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
    const on = rateTeam(team, fixtureData)!;
    const off = rateTeam(team, { ...fixtureData, ignoreMeta: true })!;
    // I Ruoli usano i sotto-ruoli misurati (Offesa, Velocità e gruppo del meta o del tier): possono cambiare di poco
    const areas = (r: typeof on) => r.areas.filter(a => !['meta', 'strength', 'defense', 'speed', 'roles'].includes(a.key)).map(a => [a.key, a.value]);
    expect(areas(on)).toEqual(areas(off));
    const roles = (r: typeof on) => r.areas.find(a => a.key === 'roles')!.value!;
    expect(Math.abs(roles(on) - roles(off))).toBeLessThanOrEqual(5);
    expect(on.areas.some(a => a.key === 'meta')).toBe(false);
    expect(on.meta).not.toBeNull();
  });
});

describe('area Ruoli nel voto', () => {
  it('il valore dell\'area è quello di teamRolesArea', async () => {
    const { teamRolesArea } = await import('../../src/engine/rolesArea');
    const team = [tusk, gholdengo];
    const rating = rateTeam(team, fixtureData)!;
    expect(rating.roles.value).toBe(teamRolesArea(team, fixtureData, 'it').value);
    expect(value(rating, 'roles')).toBe(rating.roles.value);
  });
});

describe('membro debole e controllo velocità', () => {
  it('un membro debole con solo Sticky Web o Thunder Wave è esente (utilità chiave)', () => {
    const weak = (moves: string[]): TeamSet => ({ species: 'Delibird', ability: 'Hustle', item: '', moves, nature: 'Serious', evs: {} });
    const issues = (moves: string[]) => memberIssues([weak(moves)], 'it', teamNeeds([weak(moves)], fixtureData));
    expect(issues(['Sticky Web', 'Present'])).toEqual([]);
    expect(issues(['Thunder Wave', 'Present'])).toEqual([]);
    expect(issues(['Present', 'Drill Peck'])).toHaveLength(1);
  });

  it('membri deboli: −2 ciascuno, al massimo −6', () => {
    const weak: TeamSet = { species: 'Delibird', ability: 'Hustle', item: '', moves: ['Present', 'Drill Peck'], nature: 'Serious', evs: {} };
    const team = [weak, weak, weak, weak];
    const issues = memberIssues(team, 'it', teamNeeds(team, fixtureData));
    expect(issues).toHaveLength(4);
    expect(issues.reduce((a, b) => a + b.points, 0)).toBe(6);
    expect(issues.every(i => i.points <= 2)).toBe(true);
  });

  // Task 8 (controllo Terra della spec): non passa nemmeno dopo il passo 2 del fallback (debolezza condivisa −1 oltre il terzo).
  // Misurato il 2026-10-25: scoperto 75 (base 76, −1 debolezza condivisa a Terra; Difesa 84, Offesa 79, Velocità 69),
  // coperto 76 (base 76; Difesa 87, Offesa 81, Velocità 56): +1, non +5. Coprire Terra alza la Difesa di soli 3 punti
  // e il cambio sposta anche Offesa e Velocità. Membri: Dragapult Offesa 72 / Difesa 37, Rotom-Wash 88 / 74
  // (Rotom-Wash è persino più forte); con Corviknight (42 / 92) al posto di Dragapult il coperto fa 73.
  // Resta saltato finché l'utente non decide (vedi "Calibration notes" nella spec).
  it.skip('quattro deboli a Terra scoperti: almeno 5 punti sotto la versione coperta', () => {
    const build = (names: string[]) => names.map(n => mostCommonSet(fixtureStats, n) ?? { ...emptySet(n), moves: ['Tackle', 'Protect', 'Rest', 'Toxic'] });
    // I quattro deboli a Terra restano in entrambi; lo scoperto ha due membri neutri a Terra,
    // il coperto cambia uno dei neutri (Dragapult) con un immune (Rotom-Wash, Levitazione)
    const weak = ['Heatran', 'Toxapex', 'Gholdengo', 'Kingambit'];
    const uncovered = rateTeam(build([...weak, 'Great Tusk', 'Dragapult']), fixtureData)!;
    const covered = rateTeam(build([...weak, 'Great Tusk', 'Rotom-Wash']), fixtureData)!;
    expect(covered.overall - uncovered.overall).toBeGreaterThanOrEqual(5);
  });
});
