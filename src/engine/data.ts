import type { PresetsData, SetsData } from './sets';
import type { StatsData } from './stats';

export interface EngineData {
  stats: StatsData | null;
  sets: SetsData | null;
  /** Set di riserva presi da altri formati, per i Pokémon senza dati in questo. */
  fallback?: SetsData | null;
  /** Set con nome delle analisi Smogon del formato. */
  presets?: PresetsData | null;
  /** Set con nome delle analisi degli altri formati. */
  fallbackPresets?: PresetsData | null;
}
