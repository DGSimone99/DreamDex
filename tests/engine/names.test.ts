import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { getSpecies } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { scoreCandidates } from '../../src/engine/scoring';
import { mostCommonSet } from '../../src/engine/sets';
import { teammatePct, topThreats, usageOf, type SpeciesStats } from '../../src/engine/stats';

const entry = (usage: number, extra: Partial<SpeciesStats> = {}): SpeciesStats => ({
  usage, count: 100, abilities: { scrappy: 1 }, items: { leek: 1 }, moves: { closecombat: 1 }, teraTypes: {},
  spreads: { 'Jolly:0/252/0/0/4/252': 1 }, teammates: {}, checks: {}, ...extra,
});

// Smogon usa l'apostrofo dritto, @pkmn/dex quello tipografico (Sirfetch’d)
const data: EngineData = {
  stats: {
    meta: { month: '2026-09', cutoff: 1630, battles: 1 },
    pokemon: {
      "Sirfetch'd": entry(0.05, { teammates: { 'Great Tusk': 0.3 } }),
      'Great Tusk': entry(0.15, { teammates: { "Sirfetch'd": 0.2 } }),
    },
  },
  sets: {},
};
const dexName = getSpecies("Sirfetch'd")!.name;

describe('nomi con apostrofo', () => {
  it('il nome del dex differisce da quello di Smogon', () => {
    expect(dexName).not.toBe("Sirfetch'd");
  });

  it('le statistiche si trovano con entrambe le grafie', () => {
    expect(usageOf(data.stats, dexName)).toBe(0.05);
    expect(mostCommonSet(data.stats, dexName)?.item).toBe('Leek');
    expect(teammatePct(data.stats, 'Great Tusk', dexName)).toBe(0.2);
    expect(teammatePct(data.stats, dexName, 'Great Tusk')).toBe(0.3);
  });

  it('topThreats esclude il membro del team con qualunque grafia', () => {
    expect(topThreats(data.stats, 5, [dexName])).toEqual(['Great Tusk']);
  });

  it('il candidato ha uso e set dalle statistiche', () => {
    const tusk = mostCommonSet(data.stats, 'Great Tusk')!;
    const sirfetchd = scoreCandidates([tusk], { ...DEFAULT_FORMAT, minUsage: 0 }, data).find(s => s.species === dexName)!;
    expect(sirfetchd.facts.strength.usage).toBe(0.05);
    expect(sirfetchd.set.item).toBe('Leek');
    expect(sirfetchd.facts.synergy?.pct).toBe(0.2);
  });
});
