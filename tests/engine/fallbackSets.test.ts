import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { buildFallbackSets, defaultSet, emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats, StatsData } from '../../src/engine/stats';

const entry = (usage: number, item: string, moves: string[]): SpeciesStats => ({
  usage, count: 100, abilities: {}, items: { [item]: 1 }, teraTypes: {}, spreads: {},
  moves: Object.fromEntries(moves.map(m => [m, 1])), teammates: {}, checks: {},
});
const stats = (pokemon: Record<string, SpeciesStats>): StatsData => ({ meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon });

describe('set di riserva da altri formati', () => {
  const ubers = { stats: stats({ Dragapult: entry(0.2, 'choiceband', ['dragondarts', 'uturn']) }), sets: {} };
  const uu = { stats: stats({ Dragapult: entry(0.05, 'leftovers', ['willowisp']) }), sets: {} };
  const analysis: TeamSet = { ...emptySet('Leafeon'), moves: ['Leaf Blade', 'Knock Off'] };
  const mono = { stats: stats({}), sets: { Leafeon: analysis } };

  it('prende il set dal formato in cui il Pokémon è più usato', () => {
    const fallback = buildFallbackSets([uu, ubers, mono]);
    expect(fallback.Dragapult.item).toBe('Choice Band');
    expect(fallback.Dragapult.moves).toEqual(['Dragon Darts', 'U-turn']);
  });

  it('senza statistiche usa i set delle analisi', () => {
    expect(buildFallbackSets([uu, ubers, mono]).Leafeon).toEqual(analysis);
  });

  it('defaultSet: statistiche del formato → analisi del formato → riserva → set vuoto', () => {
    const data: EngineData = { stats: stats({}), sets: {}, fallback: buildFallbackSets([ubers]) };
    expect(defaultSet(data, 'Dragapult').moves).toEqual(['Dragon Darts', 'U-turn']);
    expect(defaultSet(data, 'Garchomp')).toEqual(emptySet('Garchomp'));
    const own: EngineData = { ...data, stats: stats({ Dragapult: entry(0.1, 'heavydutyboots', ['shadowball']) }) };
    expect(defaultSet(own, 'Dragapult').moves).toEqual(['Shadow Ball']);
  });
});
