import chaos from './chaos.json';
import { reduceChaos, type ChaosFile, type StatsData } from '../../src/engine/stats';
import { mostCommonSet } from '../../src/engine/sets';
import type { EngineData } from '../../src/engine/data';

export const fixtureStats: StatsData = {
  meta: { month: '2026-09', cutoff: 1695, battles: 1000 },
  pokemon: reduceChaos(chaos as unknown as ChaosFile),
};

export const fixtureData: EngineData = { stats: fixtureStats, sets: {} };

export const tusk = mostCommonSet(fixtureStats, 'Great Tusk')!;
export const gholdengo = mostCommonSet(fixtureStats, 'Gholdengo')!;
