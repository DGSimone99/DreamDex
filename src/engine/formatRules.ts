import type { EngineData } from './data';
import type { FormatId } from './format';

/** Regole del voto e del coach che cambiano col formato (oggi Ubers, UU e Gen 9; National Dex OU usa quelle di sempre). */
export interface FormatRules {
  /**
   * PS × difesa minimo perché un Pokémon con un set offensivo (3+ attacchi o un setup offensivo) sia un muro;
   * 0 = bastano le soglie normali. Un set difensivo usa sempre le soglie normali (Ferrothorn resta un muro).
   */
  offensiveWallBulk: number;
  /** Penalità per un team senza hazard. */
  noHazardsPenalty: number;
  /** Il coach non propone sostituzioni che cambiano il tipo di team (salvo team da C o D). */
  keepArchetype: boolean;
  /**
   * Formato con cui confrontare le statistiche dei membri (area Statistiche); null = tutti i Pokémon.
   * In UU i Pokémon sono più deboli di quelli di OU: confrontati con tutti, un ottimo team UU non arriverebbe mai ad S.
   */
  strengthPool: FormatId | null;
  /** Punti massimi del bonus Tera (Gen 9): +1 per ogni debolezza del team che un Tera dichiarato fa resistere; 0 = niente. */
  teraBonusCap: number;
}

export const DEFAULT_RULES: FormatRules = { offensiveWallBulk: 0, noHazardsPenalty: 0, keepArchetype: false, strengthPool: null, teraBonusCap: 0 };

/** Ubers: Zacian-Crowned con Swords Dance non è un muro, Stealth Rock è fondamentale, un HO resta HO. */
export const UBERS_RULES: FormatRules = { ...DEFAULT_RULES, offensiveWallBulk: 11000, noHazardsPenalty: 4, keepArchetype: true };

/** UU: statistiche confrontate coi Pokémon legali in UU, e gli hazard contano come in Ubers. */
export const UU_RULES: FormatRules = { ...DEFAULT_RULES, noHazardsPenalty: 4, strengthPool: 'uu' };

/** Gen 9: il Tera è una via d'uscita da una debolezza (una volta per partita): piccolo bonus, come il meteo. */
export const GEN9_RULES: FormatRules = { ...DEFAULT_RULES, teraBonusCap: 3 };

export function formatRules(formatId: FormatId | undefined): FormatRules {
  if (formatId === 'gen9ou') return GEN9_RULES;
  return formatId === 'ubers' ? UBERS_RULES : formatId === 'uu' ? UU_RULES : DEFAULT_RULES;
}

/** Le regole del formato dei dati (impostato dall'app; senza, quelle di sempre). */
export const rulesOf = (data: EngineData): FormatRules => formatRules(data.formatId);
