import type { FormatId } from './format';
import type { GameId } from './games';
import type { PresetsData, SetsData } from './sets';
import type { FallbackStats, StatsData } from './stats';
import type { EffectiveLists } from './lists';
import type { TournamentTeam } from './tournamentTeams';

export interface EngineData {
  stats: StatsData | null;
  sets: SetsData | null;
  /** Set di riserva presi da altri formati, per i Pokémon senza dati in questo. */
  fallback?: SetsData | null;
  /** Set con nome delle analisi Smogon del formato. */
  presets?: PresetsData | null;
  /** Set con nome delle analisi degli altri formati. */
  fallbackPresets?: PresetsData | null;
  /** Squadre da torneo della fonte (pkmn), per "Team da torneo"; null se non scaricate. */
  tournamentTeams?: TournamentTeam[] | null;
  /** Statistiche dal formato in cui ogni Pokémon è più giocato, per chi non ne ha in questo (es. i vietati). */
  fallbackStats?: FallbackStats | null;
  /** Valutazione senza meta: tipi tutti uguali, niente minacce né uso dei membri (giochi in single player). */
  ignoreMeta?: boolean;
  /** "Più Mega ammesse": senza, nel voto è Mega solo la prima del team (legalTeam.ts). */
  allowMultipleMegas?: boolean;
  /** Formato scelto, per le regole che cambiano col formato (vedi formatRules). */
  formatId?: FormatId;
  /** Gioco scelto: i set proposti usano solo le mosse del gioco (il voto non lo legge). */
  game?: GameId | null;
  /** Preferiti e bannati dell'utente nel formato: i bannati non diventano mai candidati (il voto non cambia). */
  userLists?: EffectiveLists;
}
