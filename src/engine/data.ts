import type { SetsData } from './sets';
import type { StatsData } from './stats';

export interface EngineData {
  stats: StatsData | null;
  sets: SetsData | null;
}
