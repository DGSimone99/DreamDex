import type { Archetype } from './archetype';
import type { SubRole } from './subRoles';

/** Livello di un sotto-ruolo per l'archetipo: essenziale (solo malus), importante (±), minore (solo +), ignorato. */
export type Level = 'essential' | 'important' | 'minor' | 'ignored';
/**
 * Una voce della tabella: un sotto-ruolo, o un gruppo: "anySweeper" = uno sweeper fisico o speciale,
 * "anyBreaker" = un wallbreaker fisico o speciale.
 */
export type LevelKey = SubRole | 'anySweeper' | 'anyBreaker';

/**
 * Tutte le voci della tabella, nell'ordine della specifica: prima il gruppo degli attaccanti, poi le famiglie (FAMILIES).
 * Scritte per esteso: subRoles.ts è in un ciclo di import e qui servono già al caricamento del modulo.
 */
export const LEVEL_KEYS: LevelKey[] = [
  'anySweeper', 'anyBreaker', 'physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker',
  'physicalWall', 'specialWall', 'recovery',
  'support', 'removal', 'screens', 'speedControl', 'debuff', 'phazer',
  'hazards', 'pivot', 'dot', 'taunt', 'encore', 'itemRemoval',
];

/**
 * Interruttore: i sotto-ruoli misurati anche da altre aree (Attacco, muri, Recupero) contano anche nei Ruoli.
 * Spento, le loro voci minori diventano ignorate e il Recupero è essenziale in semi-stall e stall, ignorato altrove.
 * Spento per scelta (utente, 2026-10-25): un effetto, un posto; distacco torneo − medio 7,7 → 8,4, replay nel rumore.
 * Non va cambiato a runtime nell'interfaccia (le cache non dipendono da lui): solo test e bench.
 */
export let ROLES_COUNT_MEASURED = false;
/** Per test e bench. */
export function setRolesCountMeasured(v: boolean): void {
  ROLES_COUNT_MEASURED = v;
}

const E = 'essential' as const, I = 'important' as const, M = 'minor' as const, X = 'ignored' as const;
/**
 * Colonne della tabella della specifica: HO, BO, Balance, Semi-stall, Stall.
 * Calibrazione (Task 9): pivot minore in HO (i team HO da torneo spesso hanno lead con hazard e sweeper, senza pivot).
 * Per scelta (calibrazione 2026-10-24) l'unica voce importante dell'HO è il setup del campo (hazard, schermi o
 * Sticky Web a metà, gruppo "fieldSetup"; i singoli hazard e schermi restano minori): un HO senza nulla di tutto
 * questo ha base 0 e Ruoli bassi (restano le minori), ma nessuna penalità essenziale. Pavimento e media con le
 * minori sono stati provati e scartati: abbassavano il distacco torneo − medio sotto 6,5.
 * Calibrazione 2026-10-25: il setup del campo è importante anche nel Bulky Offense (team con Sticky Web), dove gli
 * hazard da soli diventano minori; nella base hazard e setup del campo pesano il doppio (IMPORTANT_WEIGHT, rolesArea.ts).
 * Il Debuff è minore anche in semi-stall e stall: paralisi o sonno aiutano, ma uno stall non ne ha bisogno (utente).
 */
/**
 * Tabella 2026-11-01, dai 231 team da torneo del banco (quota di team che portano la voce, per tipo) e dal confronto
 * con 878 team di ladder: essenziale ≈ 99% dei team da torneo, importante ≈ 70%, sotto minore; attaccanti, muri e
 * Recupero restano requisiti come prima. Il setup del campo (hazard, schermi o Sticky Web a metà) è l'unica voce di
 * campo: hazard e schermi non hanno più un livello loro (contavano due volte). HO: il setup del campo è l'unica
 * importante (a doppio peso): essenziale (malus −2) riempiva la base di qualunque HO e i team brutti fatti a mano
 * salivano di 15–20 punti; importante tiene i brutti a 44 e le partite di alto livello al 53,5%.
 * Balance: phazer (48%) e rimozione strumenti (69%, più in ladder) minori.
 * BO: rimozione strumenti importante (78%). Semi-stall: setup del campo essenziale (100%). Supporto (Wish, Healing
 * Wish, Heal Bell) minore da balance in giù (6–24%). Sul banco (tabella costruita): torneo − medio 7,7 → 7,3,
 * torneo − ladder 5,9 → 6,1, partite di alto livello 51,6% → 53,6%, ladder 52,5% → 52,3% (rumore).
 */
const ROWS: [LevelKey, Level, Level, Level, Level, Level][] = [
  // Semi-stall e stall vincono logorando: senza attaccanti nessun malus (2026-10-30; l'Offesa misura comunque il danno)
  // Tabella provvisoria (voci nuove, livelli di ieri): il setup del campo è diventato Hazard, l'Attaccante le due righe di gruppo
  ['anySweeper', E, E, E, X, X],
  ['anyBreaker', E, E, E, X, X],
  ['physicalSweeper', M, M, M, M, X],
  ['specialSweeper', M, M, M, M, X],
  ['physicalBreaker', M, M, M, M, M],
  ['specialBreaker', M, M, M, M, M],
  ['physicalWall', M, M, E, E, E],
  ['specialWall', M, M, E, E, E],
  ['recovery', X, M, I, I, I],
  // Support
  ['support', X, X, M, M, M],
  ['removal', M, I, I, I, I],
  ['screens', X, X, X, X, X],
  ['speedControl', X, X, X, X, X],
  ['debuff', X, M, M, M, M],
  ['phazer', X, M, M, I, I],
  // Utility
  ['hazards', I, I, I, E, I],
  ['pivot', M, I, I, M, M],
  ['dot', X, M, M, I, I],
  ['taunt', M, M, M, M, M],
  ['encore', M, M, M, M, M],
  ['itemRemoval', M, I, M, I, I],
];
const COLUMNS: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];

/** Livelli per archetipo (bozza della specifica; le voci ignorate sono omesse). */
export const ROLE_LEVELS: Record<Archetype, Partial<Record<LevelKey, Level>>> = Object.fromEntries(
  COLUMNS.map((archetype, c) => [archetype, Object.fromEntries(
    ROWS.filter(row => row[c + 1] !== X).map(row => [row[0], row[c + 1]]),
  )]),
) as Record<Archetype, Partial<Record<LevelKey, Level>>>;

/** Righe toccate dall'interruttore: Attacco e muri (il gruppo degli attaccanti resta). */
const SWITCHED = new Set<LevelKey>(['physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker', 'physicalWall', 'specialWall']);

/** Livello della voce per l'archetipo, con l'interruttore applicato. */
export function levelOf(archetype: Archetype, key: LevelKey): Level {
  const level = ROLE_LEVELS[archetype][key] ?? 'ignored';
  if (ROLES_COUNT_MEASURED) return level;
  // Il Recupero lo misura già la Sostenibilità: resta solo come requisito degli archetipi difensivi
  if (key === 'recovery') return archetype === 'semiStall' || archetype === 'stall' ? 'essential' : 'ignored';
  if (SWITCHED.has(key) && level === 'minor') return 'ignored';
  return level;
}
