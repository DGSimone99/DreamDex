import { describe, expect, it } from 'vitest';
import { analyzeTeam, checksThreat, resistsAllStabs } from '../../src/engine/analysis';
import { rateTeam, ratingThreats } from '../../src/engine/rating';
import { usageOf } from '../../src/engine/stats';
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

  it('minacce mostrate: dal voto (Coverage meta della Difesa), retta = qualcuno regge del tutto il suo colpo', () => {
    const rating = rateTeam([tusk, gholdengo], fixtureData)!;
    const rows = rating.defense.coverageMeta!.rows;
    const threats = ratingThreats(rating, fixtureData);
    expect(threats.map(t => t.name)).toEqual(rows.map(r => r.species));
    for (const [i, t] of threats.entries()) {
      expect(t.usage).toBe(usageOf(fixtureStats, t.name));
      // Chi regge solo a metà (KO in due colpi) non basta
      expect(t.handledBy).toEqual(rows[i].heldBy.filter(h => !h.partial).map(h => h.species));
    }
    // Le non rette sono le `unanswered` del voto
    expect(threats.filter(t => !t.handledBy.length).map(t => t.name)).toEqual(rating.defense.coverageMeta!.unanswered);
    expect(threats.find(t => t.name === 'Kingambit')!.handledBy).toEqual(['Great Tusk']);
    // Senza voto o senza meta: nessuna minaccia
    expect(ratingThreats(null, fixtureData)).toEqual([]);
    expect(ratingThreats(rateTeam([tusk, gholdengo], { ...fixtureData, ignoreMeta: true }), fixtureData)).toEqual([]);
  });

  it('riusa tabelle di tipi e bisogni', () => {
    expect(analysis.weakness.filter(r => r.pressure > 0).map(r => r.type)).toEqual(['Fire', 'Water', 'Ground', 'Ghost']);
    expect(analysis.coverage.filter(r => r.hitters.length === 0).map(r => r.type)).toEqual(['Water', 'Fighting', 'Bug']);
    // Essenziali e importanti mancanti (il Pivot è una voce minore: non entra qui)
    expect(analysis.needs.missingRoles).toEqual(['specialWall', 'hazards']);
    expect(analysis.needs.missingRoles).not.toContain('pivot');
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
