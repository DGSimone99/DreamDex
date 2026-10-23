import { describe, expect, it } from 'vitest';
import { coverageTargets, teamCoverage } from '../../src/engine/coverage';
import { bestHit } from '../../src/engine/damage';
import type { TeamSet } from '../../src/engine/sets';
import { usageOf } from '../../src/engine/stats';
import { fixtureData, fixtureStats } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noMeta = { ...fixtureData, ignoreMeta: true, formatId: 'ou' as const };
const chomp = set('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake'], 'Adamant', { atk: 252, spe: 252 });

describe('coverageTargets', () => {
  it('col meta: le combinazioni di tipi dei più usati, pesate per uso, col Pokémon più usato di ognuna', () => {
    const targets = coverageTargets(fixtureData);
    expect(targets.reduce((a, t) => a + t.weight, 0)).toBeCloseTo(1);
    const labels = targets.map(t => t.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const target of targets) {
      const sameTypes = targets.filter(t => t.label === target.label);
      expect(sameTypes).toHaveLength(1);
      expect(usageOf(fixtureStats, target.set.species)).toBeGreaterThan(0);
    }
  });

  it('senza meta: i 18 tipi con lo stesso peso, contro un bersaglio neutro', () => {
    const targets = coverageTargets(noMeta);
    expect(targets).toHaveLength(18);
    for (const target of targets) {
      expect(target.weight).toBeCloseTo(1 / 18);
      expect(target.set.species).toBe('Mew');
      expect(target.set.types).toEqual([target.label]);
    }
    // Il bersaglio neutro prende il tipo: Earthquake è super efficace sull'Elettro, nullo sul Volante
    const electric = targets.find(t => t.label === 'Electric')!.set;
    const flying = targets.find(t => t.label === 'Flying')!.set;
    expect(bestHit(chomp, electric)!.expected).toBeGreaterThan(bestHit(chomp, targets.find(t => t.label === 'Water')!.set)!.expected);
    expect(bestHit(chomp, flying)!.expected).toBe(0);
  });
});

describe('teamCoverage', () => {
  it('un tipo che nessuno scalfisce è un buco', () => {
    const coverage = teamCoverage([chomp], noMeta);
    expect(coverage.holes).toContain('Flying');
    expect(coverage.value).toBeGreaterThan(0);
    expect(coverage.value).toBeLessThan(100);
    expect(coverage.perMember).toHaveLength(1);
  });

  it('profondità: due membri che coprono gli stessi tipi valgono più di uno', () => {
    expect(teamCoverage([chomp, { ...chomp }], noMeta).value).toBeGreaterThan(teamCoverage([chomp], noMeta).value);
  });

  it('una mossa speciale debole su un attaccante fisico non copre niente', () => {
    const weak = set('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Ice Beam'], 'Adamant', { atk: 252, spe: 252 });
    expect(teamCoverage([weak], noMeta).value).toBe(teamCoverage([chomp], noMeta).value);
  });
});
