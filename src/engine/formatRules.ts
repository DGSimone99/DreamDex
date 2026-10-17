import type { EngineData } from './data';
import type { FormatId } from './format';

/** Regole del voto e del coach che cambiano col formato (oggi solo Ubers, dove tutti sono robusti e gli hazard decisivi). */
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
}

export const DEFAULT_RULES: FormatRules = { offensiveWallBulk: 0, noHazardsPenalty: 0, keepArchetype: false };

/** Ubers: Zacian-Crowned con Swords Dance non è un muro, Stealth Rock è fondamentale, un HO resta HO. */
export const UBERS_RULES: FormatRules = { offensiveWallBulk: 11000, noHazardsPenalty: 4, keepArchetype: true };

export function formatRules(formatId: FormatId | undefined): FormatRules {
  return formatId === 'ubers' ? UBERS_RULES : DEFAULT_RULES;
}

/** Le regole del formato dei dati (impostato dall'app; senza, quelle di sempre). */
export const rulesOf = (data: EngineData): FormatRules => formatRules(data.formatId);
