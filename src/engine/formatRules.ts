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
  /** Soglie dell'indice di muro (PS x Dif / PS x DifSp sulle statistiche reali): sotto non è un muro fisico/speciale. */
  wallIndex: { physical: number; special: number };
}

export const DEFAULT_RULES: FormatRules = { offensiveWallBulk: 0, noHazardsPenalty: 0, keepArchetype: false, strengthPool: null, teraBonusCap: 0, wallIndex: { physical: 100000, special: 95000 } };

/** Ubers: Zacian-Crowned con Swords Dance non è un muro, Stealth Rock è fondamentale, un HO resta HO. */
export const UBERS_RULES: FormatRules = { ...DEFAULT_RULES, offensiveWallBulk: 11000, noHazardsPenalty: 4, keepArchetype: true, wallIndex: { physical: 120000, special: 115000 } };

/** UU: statistiche confrontate coi Pokémon legali in UU, e gli hazard contano come in Ubers. */
export const UU_RULES: FormatRules = { ...DEFAULT_RULES, noHazardsPenalty: 4, strengthPool: 'uu' };

/** Gen 9: il Tera è una via d'uscita da una debolezza (una volta per partita): piccolo bonus, come il meteo. */
export const GEN9_RULES: FormatRules = { ...DEFAULT_RULES, teraBonusCap: 3 };

/** Gen 9 Ubers e UU: le regole di National Dex Ubers e UU, più il bonus Tera di Gen 9. */
export const GEN9_UBERS_RULES: FormatRules = { ...UBERS_RULES, teraBonusCap: GEN9_RULES.teraBonusCap };
export const GEN9_UU_RULES: FormatRules = { ...UU_RULES, strengthPool: 'gen9uu', teraBonusCap: GEN9_RULES.teraBonusCap };

const RULES: Partial<Record<FormatId, FormatRules>> = {
  ubers: UBERS_RULES, uu: UU_RULES,
  gen9ou: GEN9_RULES, gen9ubers: GEN9_UBERS_RULES, gen9uu: GEN9_UU_RULES, gen9ag: GEN9_RULES,
};

export function formatRules(formatId: FormatId | undefined): FormatRules {
  return (formatId && RULES[formatId]) ?? DEFAULT_RULES;
}

/** Le regole del formato dei dati (impostato dall'app; senza, quelle di sempre). */
export const rulesOf = (data: EngineData): FormatRules => formatRules(data.formatId);
