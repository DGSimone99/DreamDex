import type { EngineData } from './data';
import type { FormatId } from './format';

/** Regole del voto e del coach che cambiano col formato (National Dex OU, Ubers, UU e Gen 9; gli altri usano quelle di sempre). */
export interface FormatRules {
  /**
   * PS × difesa minimo perché un Pokémon con un set offensivo (3+ attacchi o un setup offensivo) sia un muro;
   * 0 = bastano le soglie normali. Un set difensivo usa sempre le soglie normali (Ferrothorn resta un muro).
   */
  offensiveWallBulk: number;
  /**
   * Formato con cui confrontare le statistiche dei membri (area Statistiche); null = tutti i Pokémon.
   * In UU i Pokémon sono più deboli di quelli di OU: confrontati con tutti, un ottimo team UU non arriverebbe mai ad S.
   */
  strengthPool: FormatId | null;
  /** Soglie dell'indice di muro (PS x Dif / PS x DifSp sulle statistiche reali): sotto non è un muro fisico/speciale. */
  wallIndex: { physical: number; special: number };
  /**
   * Come si riconosce il tipo di team e quali pesi delle aree usa (archetype.ts, rating.ts).
   * 'walls': la regola di sempre, dai muri passivi, dal recupero e dalla robustezza.
   * 'recoverySpeed': National Dex OU (2026-11-05), dai membri con una mossa di recupero e dalla velocità base media (la
   * Focus Sash tolta il 2026-11-09); tarata sui team del banco di cui l'autore ha scritto il tipo (dal 74% all'80% di giusti), coi suoi pesi.
   * 'oneType': il doppio (2026-11-21), un tipo solo ('doubles') per ogni team, anche incompleto, con un solo elenco di ruoli e
   * le tre aree alla pari; niente "vicino a". Sulle partite di doppio i cinque tipi del singolo erano solo fasce di velocità.
   */
  typeRule: 'walls' | 'recoverySpeed' | 'oneType';
}

export const DEFAULT_RULES: FormatRules = { offensiveWallBulk: 0, strengthPool: null, wallIndex: { physical: 100000, special: 95000 }, typeRule: 'walls' };

/** National Dex OU: il tipo di team dal recupero e dalla velocità, coi suoi pesi. Gli altri formati per ora no (in Ubers sono tutti molto robusti: serviranno soglie loro). */
export const NATDEX_OU_RULES: FormatRules = { ...DEFAULT_RULES, typeRule: 'recoverySpeed' };

/** Ubers: Zacian-Crowned con Swords Dance non è un muro, un HO resta HO (gli hazard li chiedono i Ruoli, come altrove). */
export const UBERS_RULES: FormatRules = { ...DEFAULT_RULES, offensiveWallBulk: 11000, wallIndex: { physical: 120000, special: 115000 } };

/** UU: statistiche confrontate coi Pokémon legali in UU. */
export const UU_RULES: FormatRules = { ...DEFAULT_RULES, strengthPool: 'uu' };

/** Gen 9: le regole di sempre (il bonus Tera è stato tolto il 2026-11-07). */
export const GEN9_RULES: FormatRules = { ...DEFAULT_RULES };

/** Gen 9 Ubers e UU: le regole di National Dex Ubers e UU (UU confrontato coi Pokémon di Gen 9 UU). */
export const GEN9_UBERS_RULES: FormatRules = { ...UBERS_RULES };
export const GEN9_UU_RULES: FormatRules = { ...UU_RULES, strengthPool: 'gen9uu' };

/** Gen 9 AG: le soglie di muro di Ubers (Arceus e Kingambit hanno bulk naturale da muro senza esserlo); il resto come Gen 9. */
export const GEN9_AG_RULES: FormatRules = { ...GEN9_RULES, wallIndex: UBERS_RULES.wallIndex };

/** Doppio: un tipo di team solo; il resto come le regole di sempre. */
export const DOUBLES_RULES: FormatRules = { ...DEFAULT_RULES, typeRule: 'oneType' };

/** Il formato ha un tipo di team solo (il doppio): niente riconoscimento dei tipi del singolo. */
export const isOneType = (rules: FormatRules): boolean => rules.typeRule === 'oneType';

const RULES: Partial<Record<FormatId, FormatRules>> = {
  ou: NATDEX_OU_RULES, ubers: UBERS_RULES, uu: UU_RULES,
  gen9ou: GEN9_RULES, gen9ubers: GEN9_UBERS_RULES, gen9uu: GEN9_UU_RULES, gen9ag: GEN9_AG_RULES,
  natdexdoubles: DOUBLES_RULES,
};

export function formatRules(formatId: FormatId | undefined): FormatRules {
  return (formatId && RULES[formatId]) ?? DEFAULT_RULES;
}

/** Le regole del formato dei dati (impostato dall'app; senza, quelle di sempre). */
export const rulesOf = (data: EngineData): FormatRules => formatRules(data.formatId);

/**
 * Le opzioni dei colpi che dipendono dal formato, da aggiungere a ogni `bestHit` del voto e del coach: in doppio le
 * mosse a più bersagli fanno meno danno (damage.ts SPREAD_SHARE). La Sfida non le usa.
 */
export const hitRules = (data: EngineData): { doubles?: boolean } => (isOneType(rulesOf(data)) ? { doubles: true } : {});
