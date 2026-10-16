import { describe, expect, it } from 'vitest';
import { commonChoices } from '../../src/engine/common';
import { emptySet } from '../../src/engine/sets';
import { buildFallbackStats, type SpeciesStats, type StatsData } from '../../src/engine/stats';

const entry = (count: number, item: string): SpeciesStats => ({
  usage: 0.2, count, abilities: { pressure: 1 }, items: { [item]: 0.6 }, moves: { psystrike: 0.9 }, teraTypes: {},
  spreads: { 'Timid:0/0/0/252/4/252': 0.5 }, teammates: {}, checks: {},
});
const stats = (pokemon: Record<string, SpeciesStats>): StatsData => ({ meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon });

describe('statistiche di riserva dagli altri formati', () => {
  it('per ogni Pokémon il formato in cui è in più squadre, col suo nome', () => {
    const fallback = buildFallbackStats([
      { format: 'gen9nationaldexubers', stats: stats({ Mewtwo: entry(5000, 'lifeorb') }) },
      { format: 'gen8ubers', stats: stats({ Mewtwo: entry(200, 'choicescarf'), Palafin: entry(300, 'choiceband') }) },
    ]);
    expect(fallback.Mewtwo.format).toBe('gen9nationaldexubers');
    expect(Object.keys(fallback.Mewtwo.items)).toEqual(['lifeorb']);
    expect(fallback.Palafin.format).toBe('gen8ubers');
  });

  it('i formati preferiti (National Dex, stesse regole) vincono anche con meno squadre', () => {
    const fallback = buildFallbackStats(
      [{ format: 'gen9nationaldexubers', stats: stats({ Mewtwo: entry(100, 'mewtwonitey') }) }],
      [{ format: 'gen9ubers', stats: stats({ Mewtwo: entry(9000, 'choicespecs'), Miraidon: entry(500, 'choicespecs') }) }],
    );
    expect(fallback.Mewtwo.format).toBe('gen9nationaldexubers');
    expect(fallback.Miraidon.format).toBe('gen9ubers');
  });

  it('Pokémon vietato nel formato: le scelte arrivano da lì, con la fonte', () => {
    const fallbackStats = buildFallbackStats([{ format: 'gen9nationaldexubers', stats: stats({ Mewtwo: entry(5000, 'lifeorb') }) }]);
    const common = commonChoices({ stats: stats({}), sets: null, fallbackStats }, emptySet('Mewtwo'));
    expect(common.source).toBe('gen9nationaldexubers');
    expect(common.items).toEqual([{ name: 'Life Orb', share: 0.6 }]);
    expect(common.spreads[0]).toEqual(expect.objectContaining({ nature: 'Timid', share: 0.5 }));
  });

  it('forma senza dati propri: quelli della forma base', () => {
    const fallbackStats = buildFallbackStats([{ format: 'gen9ou', stats: stats({ Palafin: entry(300, 'choiceband') }) }]);
    const common = commonChoices({ stats: stats({}), sets: null, fallbackStats }, emptySet('Palafin-Hero'));
    expect(common.items).toEqual([{ name: 'Choice Band', share: 0.6 }]);
  });

  it('con dati nel formato: nessuna fonte esterna', () => {
    const common = commonChoices({ stats: stats({ Mewtwo: entry(10, 'leftovers') }), sets: null }, emptySet('Mewtwo'));
    expect(common.source).toBeNull();
  });
});
