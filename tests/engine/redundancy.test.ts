import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { MAX_PENALTY, rateTeam, redundancies } from '../../src/engine/rating';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

const withMoves = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });
const items = (team: TeamSet[]) => redundancies(team, analyzeTeam(team, fixtureData)).items;

describe('ridondanze', () => {
  it('debolezze accumulate: ogni debole scoperto oltre il primo', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    // Ice è raro nella fixture (peso 0): 1 punto per debole in più invece di 2
    expect(items(team)).toContainEqual({ text: '3 membri deboli a Ice, nessuno resiste', points: 2 });
  });

  it('debolezze su tipi frequenti pesano doppio', () => {
    const team = [withMoves('Great Tusk', []), withMoves('Garchomp', []), withMoves('Toxapex', [])];
    // Ground: Toxapex debole, Tusk e Garchomp neutri → 1 solo debole, nessuna penalità
    expect(items(team).some(i => i.text.includes('Ground'))).toBe(false);
    const water = [withMoves('Great Tusk', []), withMoves('Landorus-Therian', []), withMoves('Hippowdon', [])];
    // Water: 3 deboli, Water è frequente nella fixture → 2 punti per debole in più
    expect(items(water)).toContainEqual({ text: '3 membri deboli a Water, nessuno resiste', points: 4 });
  });

  it('stesso hazard da più membri', () => {
    const team = [withMoves('Great Tusk', ['Stealth Rock']), withMoves('Garchomp', ['Stealth Rock']), withMoves('Kingambit', ['Stone Axe'])];
    expect(items(team)).toContainEqual({ text: '3 setter di Stealth Rock', points: 4 });
  });

  it('più rimozioni hazard', () => {
    const team = [withMoves('Great Tusk', ['Rapid Spin']), withMoves('Corviknight', ['Defog'])];
    expect(items(team)).toContainEqual({ text: '2 rimozioni hazard', points: 1 });
  });

  it('tre o più membri dello stesso tipo', () => {
    const team = ['Gholdengo', 'Kingambit', 'Corviknight'].map(n => withMoves(n, []));
    expect(items(team)).toContainEqual({ text: '3 membri di tipo Steel', points: 1 });
  });

  it('team senza ridondanze', () => {
    expect(redundancies([tusk, gholdengo], analyzeTeam([tusk, gholdengo], fixtureData))).toEqual({ total: 0, items: [] });
  });

  it('penalità massima', () => {
    const team = Array(6).fill(0).map(() => withMoves('Great Tusk', ['Stealth Rock', 'Rapid Spin']));
    expect(redundancies(team, analyzeTeam(team, fixtureData)).total).toBe(MAX_PENALTY);
  });
});

describe('voto con ridondanze', () => {
  it('la penalità si sottrae al voto complessivo', () => {
    const team = [withMoves('Great Tusk', ['Stealth Rock']), withMoves('Garchomp', ['Stealth Rock'])];
    const rating = rateTeam(team, fixtureData)!;
    expect(rating.penalty.total).toBeGreaterThan(0);
    expect(rating.overall).toBe(Math.max(0, rating.base - rating.penalty.total));
  });

  it('il coaching segnala i ruoli doppi e i tipi ripetuti', () => {
    const team = [withMoves('Great Tusk', ['Stealth Rock']), withMoves('Garchomp', ['Stealth Rock'])];
    expect(coachTeam(team, DEFAULT_FORMAT, fixtureData).problems)
      .toContainEqual({ severity: 'minor', text: 'Ridondanza: 2 setter di Stealth Rock', fixes: [] });
  });
});
