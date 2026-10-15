import { describe, expect, it } from 'vitest';
import { analyzeTeam, checksThreat, resistsAllStabs, threatScore } from '../../src/engine/analysis';
import { mostCommonSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

describe('analyzeTeam', () => {
  const analysis = analyzeTeam([tusk, gholdengo], fixtureData);

  it('minacce: ordine per uso, chi le gestisce', () => {
    expect(analysis.threats.map(t => [t.name, t.handledBy])).toEqual([
      ['Kingambit', ['Great Tusk']],
      ['Dragapult', []],
      ['Corviknight', []],
      ['Toxapex', ['Great Tusk']],
      ['Rotom-Wash', []],
      ['Garchomp', []],
    ]);
  });

  it('punteggio minacce del meta: quota gestita pesata per uso', () => {
    // gestite Kingambit (20%) e Toxapex (10%) su 71.5% totale
    expect(threatScore(analysis)).toBe(42);
    expect(threatScore(analyzeTeam([tusk], { stats: null, sets: null }))).toBeNull();
  });

  it('riusa tabelle di tipi e bisogni', () => {
    expect(analysis.weakness.filter(r => r.pressure > 0).map(r => r.type)).toEqual(['Fire', 'Water', 'Ground', 'Ghost']);
    expect(analysis.coverage.filter(r => r.hitters.length === 0).map(r => r.type)).toEqual(['Water', 'Fighting', 'Bug']);
    expect(analysis.needs.missingRoles).toContain('pivot');
  });

  it('senza statistiche: niente minacce, analisi di tipo disponibile', () => {
    const empty = analyzeTeam([tusk], { stats: null, sets: null });
    expect(empty.threats).toEqual([]);
    expect(empty.weakness).toHaveLength(18);
  });
});

describe('checksThreat', () => {
  const corviknight = mostCommonSet(fixtureStats, 'Corviknight')!;

  it('usa i dati Smogon quando esistono', () => {
    expect(checksThreat(fixtureData, tusk, 'Kingambit')).toBe(true);
    expect(checksThreat(fixtureData, gholdengo, 'Dragapult')).toBe(false); // 0.6 - 0.2 = 0.4 < 0.5
  });

  it('fallback per tipi se la minaccia non ha dati', () => {
    expect(resistsAllStabs(corviknight, 'Garchomp')).toBe(true);
    expect(checksThreat(fixtureData, corviknight, 'Garchomp')).toBe(true);
  });

  it('un Pokémon non è check di sé stesso', () => {
    expect(checksThreat(fixtureData, corviknight, 'Corviknight')).toBe(false);
  });
});
