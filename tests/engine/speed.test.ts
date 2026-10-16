import { describe, expect, it } from 'vitest';
import { speedStat, speedTier } from '../../src/engine/speed';
import { emptySet } from '../../src/engine/sets';
import type { SpeciesStats, StatsData } from '../../src/engine/stats';

const garchomp = (nature: string, spe: number, item = '') => ({ ...emptySet('Garchomp'), nature, evs: { spe }, item });

describe('Velocità al livello 100 (IV 31)', () => {
  it('base, EV e natura', () => {
    expect(speedStat(garchomp('Jolly', 252))).toEqual({ value: 333, scarf: false });
    expect(speedStat(garchomp('Hardy', 252))).toEqual({ value: 303, scarf: false });
    expect(speedStat(garchomp('Hardy', 0))).toEqual({ value: 240, scarf: false });
    expect(speedStat(garchomp('Brave', 0))).toEqual({ value: 216, scarf: false });
  });

  it('Sciarpa Scelta ×1,5', () => {
    expect(speedStat(garchomp('Jolly', 252, 'Choice Scarf'))).toEqual({ value: 499, scarf: true });
  });

  it('forma Mega con la pietra', () => {
    // Garchomp-Mega: base 92 → 311 con Jolly e 252 EV
    expect(speedStat(garchomp('Jolly', 252, 'Garchompite')).value).toBe(311);
  });
});

const entry = (usage: number, spread: string, item = 'leftovers'): SpeciesStats => ({
  usage, count: 100, abilities: {}, items: { [item]: 0.6 }, moves: {}, teraTypes: {}, spreads: { [spread]: 0.5 }, teammates: {}, checks: {},
});
const stats: StatsData = { meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon: {
  'Great Tusk': entry(0.4, 'Jolly:0/252/4/0/0/252'), // 87 base → 300
  Gholdengo: entry(0.3, 'Timid:0/0/0/252/4/252'), // 84 → 293
  Dragapult: entry(0.25, 'Timid:0/0/0/252/4/252'), // 142 → 421
  Kingambit: entry(0.2, 'Adamant:252/252/0/0/4/0'), // 50 → 136
  Garchomp: entry(0.15, 'Jolly:0/252/0/0/4/252'),
  Rillaboom: entry(0.1, 'Adamant:0/252/0/0/4/252', 'choicescarf'), // 85 → 269 ×1,5 = 403
} };

describe('posto nel meta', () => {
  it('quota del meta più lenta, vicini più veloci e più lenti; esclude la specie stessa', () => {
    const tier = speedTier(garchomp('Jolly', 252), { stats, sets: null })!;
    expect(tier.speed).toBe(333);
    expect(tier.total).toBe(5);
    expect(tier.outspeeds).toBeCloseTo(3 / 5);
    expect(tier.faster.map(f => [f.species, f.value, f.scarf])).toEqual([['Rillaboom', 403, true], ['Dragapult', 421, false]]);
    expect(tier.slower.map(f => [f.species, f.value])).toEqual([['Great Tusk', 300], ['Gholdengo', 293], ['Kingambit', 136]]);
  });

  it('senza statistiche nessun confronto', () => {
    expect(speedTier(garchomp('Jolly', 252), { stats: null, sets: null })).toBeNull();
  });
});
