import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { suggest } from '../../src/engine/scoring';
import { emptySet } from '../../src/engine/sets';
import { areaDrops, bestSwaps, extrasDelta, rankByTeamGain, rolesDelta, withCandidate } from '../../src/engine/teamGain';
import { improveReplacements } from '../../src/engine/replace';
import { fixtureData } from '../fixtures/data';

describe('voto del team col candidato', () => {
  const team = [{ ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Rapid Spin'] }];

  it('aggiunge in fondo o sostituisce il membro', () => {
    const set = emptySet('Gholdengo');
    expect(withCandidate(team, set, null).map(s => s.species)).toEqual(['Great Tusk', 'Gholdengo']);
    expect(withCandidate(team, set, 0).map(s => s.species)).toEqual(['Gholdengo']);
  });

  it('ordina per voto del team, con quanto sale rispetto a ora', () => {
    const items = suggest(team, DEFAULT_FORMAT, fixtureData, 20);
    const ranked = rankByTeamGain(items, team, null, fixtureData, 'it');
    const before = rateTeam(team, fixtureData)!.overall;
    expect(ranked.map(r => r.teamGain!.overall)).toEqual([...ranked.map(r => r.teamGain!.overall)].sort((a, b) => b - a));
    for (const r of ranked) {
      expect(r.teamGain!.overall).toBe(rateTeam([...team, r.set], fixtureData)!.overall);
      expect(r.teamGain!.gain).toBe(r.teamGain!.overall - before);
    }
  });

  it('primo Pokémon o unico membro sostituito: nessun voto, ordine invariato', () => {
    const items = suggest([], DEFAULT_FORMAT, fixtureData, 5);
    expect(rankByTeamGain(items, [], null, fixtureData, 'it')).toEqual(items);
    expect(rankByTeamGain(items, team, 0, fixtureData, 'it')).toEqual(items);
  });

  it('senza ordinare (Sostituto simile) mantiene l\'ordine ma porta il voto', () => {
    const items = suggest(team, DEFAULT_FORMAT, fixtureData, 20);
    const kept = rankByTeamGain(items, team, null, fixtureData, 'it', false);
    expect(kept.map(r => r.species)).toEqual(items.map(r => r.species));
    expect(kept.every(r => r.teamGain)).toBe(true);
  });
});

describe('raccomandazioni libere', () => {
  const team = ['Great Tusk', 'Gholdengo', 'Kingambit'].map(name => ({ ...emptySet(name), moves: [] as string[] }));
  const candidates = (index: number) => improveReplacements(team, index, DEFAULT_FORMAT, fixtureData, 15);

  it('ogni candidato una volta, col membro che conviene di più sostituire; gli altri in alternativa', () => {
    const swaps = bestSwaps(team, fixtureData, 'it', candidates);
    expect(new Set(swaps.map(s => s.species)).size).toBe(swaps.length);
    const before = rateTeam(team, fixtureData)!.overall;
    for (const swap of swaps) {
      const after = rateTeam(withCandidate(team, swap.set, swap.replaces), fixtureData)!.overall;
      expect(swap.teamGain.gain).toBe(after - before);
      expect(swap.alternatives.every(alt => alt.gain <= swap.teamGain.gain && alt.index !== swap.replaces)).toBe(true);
    }
    expect(swaps.map(s => s.teamGain.overall)).toEqual([...swaps.map(s => s.teamGain.overall)].sort((a, b) => b - a));
  });

  it('i preferiti non escono mai', () => {
    const starred = team.map((set, i) => (i === 0 ? { ...set, favorite: true } : set));
    expect(bestSwaps(starred, fixtureData, 'it', candidates).every(s => s.replaces !== 0)).toBe(true);
  });

  it('niente doppioni di specie già nel team', () => {
    const names = team.map(s => s.species);
    expect(bestSwaps(team, fixtureData, 'it', candidates).every(s => !names.includes(s.species))).toBe(true);
  });
});

describe('punti per area', () => {
  const team = [
    { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Rapid Spin', 'Close Combat', 'Ice Spinner'] },
    { ...emptySet('Gholdengo'), ability: 'Good as Gold', moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'] },
  ];
  // Le aree spiegano il voto base; penalità e bonus (ridondanze, meteo, Tera) restano fuori
  it('areaPoints somma circa al cambio del voto base', () => {
    const ranked = rankByTeamGain(suggest(team, DEFAULT_FORMAT, fixtureData, 10), team, null, fixtureData, 'it');
    const before = rateTeam(team, fixtureData)!.base;
    expect(ranked.length).toBeGreaterThan(0);
    for (const r of ranked) {
      // I Ruoli stanno nei malus e bonus, non nel voto base
      const points = Object.entries(r.teamGain!.areaPoints ?? {}).filter(([k]) => k !== 'roles').reduce((a, [, b]) => a + b, 0);
      expect(Math.abs(points - (rateTeam([...team, r.set], fixtureData)!.base - before))).toBeLessThanOrEqual(1);
    }
  });
});

describe('cosa spiega il cambio di voto oltre alle aree', () => {
  const rating = (penalty: number, bonus: number, areas: [string, number | null, boolean?][]) => ({
    penalty: { total: penalty, items: [] }, bonus: { total: bonus, items: [] },
    areas: areas.map(([key, value, inactive]) => ({ key, label: key, value, ...(inactive ? { inactive } : {}) })),
  }) as never;

  // Voci del voto: [punti, catalogo]; i ruoli mancanti (malus) e minori (bonus) fanno i punti dei Ruoli
  const graded = (malus: [number, string?][], bonus: [number, string?][], roles: { failures: number[]; bonuses: number[] }) => ({
    penalty: { total: malus.reduce((n, [p]) => n + p, 0), items: malus.map(([points, catalog]) => ({ text: '', points, catalog })) },
    bonus: { total: bonus.reduce((n, [p]) => n + p, 0), items: bonus.map(([points, catalog]) => ({ text: '', points, catalog })) },
    roles: { failures: roles.failures.map(points => ({ points })), bonuses: roles.bonuses.map(points => ({ points })) },
    areas: [],
  }) as never;

  it('Bonus/Malus: quanto cambiano penalità e bonus insieme, senza i ruoli; i Ruoli a parte', () => {
    const before = graded([[10, 'sameType'], [4, 'essentialRole']], [], { failures: [4], bonuses: [] });
    const after = graded([[2, 'hazardDuplicate']], [[1, 'minorRole'], [3, 'core']], { failures: [], bonuses: [1] });
    expect(extrasDelta(before, after)).toBe(11);
    expect(rolesDelta(before, after)).toBe(5);
    expect(extrasDelta(graded([], [], { failures: [], bonuses: [] }), graded([[3, 'sameType']], [], { failures: [], bonuses: [] }))).toBe(-3);
  });

  it('aree in calo, dalla più grande; le inattive e senza valore no', () => {
    const before = rating(0, 0, [['defense', 70], ['strength', 80], ['roles', 60], ['speed', 50, true]]);
    const after = rating(0, 0, [['defense', 73], ['strength', 79], ['roles', 55], ['speed', 40, true]]);
    expect(areaDrops(before, after)).toEqual([{ key: 'roles', label: 'roles', change: -5 }, { key: 'strength', label: 'strength', change: -1 }]);
  });
});
