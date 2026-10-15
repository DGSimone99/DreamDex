import type { SetsData } from './sets';
import type { StatsData } from './stats';

export interface EngineData {
  stats: StatsData | null;
  sets: SetsData | null;
  /** Set di riserva presi da altri formati, per i Pokémon senza dati in questo. */
  fallback?: SetsData | null;
}
