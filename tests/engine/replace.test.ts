import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { diffContribution, improveReplacements, similarity, similarReplacements } from '../../src/engine/replace';
import { mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

const corviknight = mostCommonSet(fixtureStats, 'Corviknight')!;
const dragapult = mostCommonSet(fixtureStats, 'Dragapult')!;
const skarmory: TeamSet = { species: 'Skarmory', item: 'Rocky Helmet', ability: 'Sturdy', moves: ['Brave Bird', 'Spikes', 'Roost', 'Whirlwind'], nature: 'Impish', evs: {} };

describe('similarity', () => {
  it('identico = 1', () => {
    expect(similarity(corviknight, corviknight, DEFAULT_RULES)).toBeCloseTo(1);
  });

  it('stessi tipi e ruolo simile battono un Pokémon diverso', () => {
    expect(similarity(corviknight, skarmory, DEFAULT_RULES)).toBeGreaterThan(similarity(corviknight, dragapult, DEFAULT_RULES));
  });

  it('Pokémon sconosciuto = 0', () => {
    expect(similarity(corviknight, { ...skarmory, species: 'Fakemon-Xyz' }, DEFAULT_RULES)).toBe(0);
  });
});

describe('diffContribution', () => {
  it('Great Tusk → Corviknight accanto a Gholdengo', () => {
    const diff = diffContribution(tusk, corviknight, analyzeTeam([gholdengo], fixtureData));
    expect(diff.gains).toEqual({ roles: ['pivot'], covers: ['Fighting', 'Bug'], resists: ['Ground'] });
    expect(diff.losses.covers).toContain('Fire');
    expect(diff.losses.resists).toContain('Dark');
    expect(diff.losses.roles).not.toContain('removal');
  });
});

describe('improveReplacements', () => {
  const list = improveReplacements([tusk, gholdengo], 0, DEFAULT_FORMAT, fixtureData);

  it('esclude l\'originale e gli altri membri', () => {
    const names = list.map(r => r.species);
    expect(names).not.toContain('Great Tusk');
    expect(names).not.toContain('Gholdengo');
    expect(names).toContain('Corviknight');
  });

  it('ogni candidato ha un diff', () => {
    expect(list.find(r => r.species === 'Corviknight')!.diff.gains.roles).toContain('pivot');
  });
});

describe('similarReplacements', () => {
  const list = similarReplacements([tusk, corviknight], 1, DEFAULT_FORMAT, fixtureData);

  it('somiglianza 0–1 e ordine per rango (0.8 somiglianza + 0.2 punteggio)', () => {
    const ranks = list.map(r => 0.8 * r.similarity! + 0.2 * (r.score / 100));
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    for (const r of list) {
      expect(r.similarity).toBeGreaterThanOrEqual(0);
      expect(r.similarity).toBeLessThanOrEqual(1);
    }
    expect(list.map(r => r.species)).not.toContain('Corviknight');
  });
});
