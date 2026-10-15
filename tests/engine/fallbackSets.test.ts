import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { buildFallbackSets, defaultSet, emptySet, type TeamSet } from '../../src/engine/sets';
import { generatedSet } from '../../src/engine/generatedSet';
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

  it('a parità di uso percentuale vince il formato con più squadre', () => {
    const big = { stats: stats({ Dragapult: { ...entry(0.05, 'leftovers', ['willowisp']), count: 5000 } }), sets: {} };
    expect(buildFallbackSets([ubers, big]).Dragapult.item).toBe('Leftovers');
  });

  it('defaultSet: statistiche del formato → analisi del formato → riserva → forma base → set generato', () => {
    const data: EngineData = { stats: stats({}), sets: {}, fallback: buildFallbackSets([ubers]) };
    expect(defaultSet(data, 'Dragapult').moves).toEqual(['Dragon Darts', 'U-turn']);
    expect(defaultSet(data, 'Garchomp')).toEqual(generatedSet('Garchomp'));
    const own: EngineData = { ...data, stats: stats({ Dragapult: entry(0.1, 'heavydutyboots', ['shadowball']) }) };
    expect(defaultSet(own, 'Dragapult').moves).toEqual(['Shadow Ball']);
  });
});

describe('statistiche di data.pkmn.cc', () => {
  it('convertite nel formato interno, utili per il set più comune', async () => {
    const { reducePkmnStats } = await import('../../src/engine/stats');
    const { mostCommonSet } = await import('../../src/engine/sets');
    const pokemon = reducePkmnStats({
      battles: 10,
      pokemon: {
        Leafeon: {
          usage: { weighted: 0.04 }, count: 321,
          abilities: { Chlorophyll: 0.7, 'Leaf Guard': 0.3 }, items: { 'Life Orb': 0.6 },
          moves: { 'Leaf Blade': 0.9, 'Knock Off': 0.8, 'Swords Dance': 0.7, 'X-Scissor': 0.5, Synthesis: 0.2 },
          spreads: { 'Jolly:0/252/0/0/4/252': 0.5 }, teraTypes: { normal: 0.4 },
        },
        Rare: { usage: { weighted: 0.0001 }, count: 1 },
      },
    });
    expect(Object.keys(pokemon)).toEqual(['Leafeon']);
    expect(pokemon.Leafeon.count).toBe(321);
    const set = mostCommonSet(stats(pokemon), 'Leafeon')!;
    expect(set).toMatchObject({ item: 'Life Orb', ability: 'Chlorophyll', nature: 'Jolly', teraType: 'Normal' });
    expect(set.moves).toEqual(['Leaf Blade', 'Knock Off', 'Swords Dance', 'X-Scissor']);
  });
});

describe('preset Smogon', () => {
  it('tutti i set con nome, al massimo 5, senza doppioni; prima il formato scelto', async () => {
    const { normalizeAnalysisPresets, mergePresets, presetsFor, formatName } = await import('../../src/engine/sets');
    const raw = {
      Garchomp: {
        'Swords Dance': { moves: ['Swords Dance', 'Earthquake', 'Scale Shot', 'Stealth Rock'], item: 'Loaded Dice', ability: 'Rough Skin' },
        'Choice Scarf': { moves: ['Outrage', 'Earthquake', 'Stone Edge', 'Fire Fang'], item: 'Choice Scarf', ability: 'Rough Skin' },
      },
    };
    const own = normalizeAnalysisPresets(raw, 'gen9nationaldex');
    const other = mergePresets([
      normalizeAnalysisPresets(raw, 'gen9ou'), // doppioni del formato scelto: scartati
      normalizeAnalysisPresets({ Garchomp: Object.fromEntries(['A', 'B', 'C', 'D'].map(n => [n, { moves: [n === 'A' ? 'Spikes' : `Move ${n}`], item: 'Leftovers' }])) }, 'gen8ou'),
    ]);
    const presets = presetsFor({ stats: null, sets: null, presets: own, fallbackPresets: other }, 'Garchomp');
    expect(presets).toHaveLength(5);
    expect(presets.slice(0, 2).map(p => [p.name, p.format])).toEqual([['Swords Dance', 'gen9nationaldex'], ['Choice Scarf', 'gen9nationaldex']]);
    expect(presets.slice(2).map(p => p.format)).toEqual(['gen8ou', 'gen8ou', 'gen8ou']);
    expect(formatName('gen9nationaldexubers')).toBe('NatDex Ubers');
    expect(formatName('gen9nationaldex')).toBe('NatDex OU');
    expect(formatName('gen8zu')).toBe('Gen 8 ZU');
  });
});
