import { describe, expect, it } from 'vitest';
import { commonChoices } from '../../src/engine/common';
import type { EngineData } from '../../src/engine/data';
import { emptySet, type Preset } from '../../src/engine/sets';
import type { SpeciesStats, StatsData } from '../../src/engine/stats';

const entry = (spreads: Record<string, number>): SpeciesStats => ({
  usage: 0.2, count: 100, abilities: {}, items: {}, moves: {}, teraTypes: {}, spreads, teammates: {}, checks: {},
});
const stats = (spreads: Record<string, number>): StatsData => ({ meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon: { Garchomp: entry(spreads) } });
const preset = (name: string, format: string, nature: string, i: number): Preset =>
  ({ name, format, set: { ...emptySet('Garchomp'), nature, moves: [`Move${i}`], item: `Item${i}`, evs: { hp: 4 * i } } });

describe('spread pronti', () => {
  it('al massimo 4: prima le statistiche, poi i set del formato', () => {
    const data: EngineData = {
      stats: stats({ 'Jolly:0/252/0/0/4/252': 0.4, 'Jolly:4/252/0/0/0/252': 0.2, 'Impish:252/0/164/0/0/92': 0.1 }), sets: null,
      presets: { Garchomp: [preset('A', 'gen9nationaldex', 'Careful', 1), preset('B', 'gen9nationaldex', 'Bold', 2)] },
    };
    const spreads = commonChoices(data, emptySet('Garchomp')).spreads;
    expect(spreads).toHaveLength(4);
    expect(spreads.map(s => s.share)).toEqual([0.4, 0.2, 0.1, null]);
    expect(spreads[3].nature).toBe('Careful');
  });

  it('i set di altri formati solo per arrivare a 3', () => {
    const data: EngineData = {
      stats: stats({ 'Jolly:0/252/0/0/4/252': 0.4 }), sets: null,
      presets: { Garchomp: [preset('A', 'gen9nationaldex', 'Careful', 1)] },
      fallbackPresets: { Garchomp: [preset('M1', 'gen9nationaldexmonotype', 'Bold', 2), preset('M2', 'gen9nationaldexmonotype', 'Calm', 3)] },
    };
    expect(commonChoices(data, emptySet('Garchomp')).spreads.map(s => s.nature)).toEqual(['Jolly', 'Careful', 'Bold']);
  });

  it('con 3 o più dal formato, niente dagli altri formati', () => {
    const data: EngineData = {
      stats: stats({ 'Jolly:0/252/0/0/4/252': 0.4, 'Jolly:4/252/0/0/0/252': 0.2, 'Impish:252/0/164/0/0/92': 0.1 }), sets: null,
      fallbackPresets: { Garchomp: [preset('M1', 'gen9nationaldexmonotype', 'Bold', 2)] },
    };
    expect(commonChoices(data, emptySet('Garchomp')).spreads.map(s => s.nature)).toEqual(['Jolly', 'Jolly', 'Impish']);
  });
});
