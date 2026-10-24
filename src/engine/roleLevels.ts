import type { Archetype } from './archetype';
import type { SubRole } from './subRoles';

/** Livello di un sotto-ruolo per l'archetipo: essenziale (solo malus), importante (±), minore (solo +), ignorato. */
export type Level = 'essential' | 'important' | 'minor' | 'ignored';
/** Una voce della tabella: un sotto-ruolo, o "attacker" = un sotto-ruolo d'Attacco qualunque (gruppo). */
export type LevelKey = SubRole | 'attacker';

/**
 * Tutte le voci della tabella, nell'ordine della specifica: prima il gruppo degli attaccanti, poi le famiglie (FAMILIES).
 * Scritte per esteso: subRoles.ts è in un ciclo di import e qui servono già al caricamento del modulo.
 */
export const LEVEL_KEYS: LevelKey[] = [
  'attacker', 'physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker',
  'physicalWall', 'specialWall', 'recovery', 'hazards', 'removal', 'pivot', 'screens',
  'dot', 'debuff', 'phazer', 'taunt', 'encore', 'itemRemoval',
];

/**
 * Interruttore: i sotto-ruoli misurati anche da altre aree (Attacco, muri, Recupero) contano anche nei Ruoli.
 * Spento, le loro voci minori diventano ignorate e il Recupero è essenziale in semi-stall e stall, ignorato altrove.
 */
export let ROLES_COUNT_MEASURED = true;
/** Per test e bench. */
export function setRolesCountMeasured(v: boolean): void {
  ROLES_COUNT_MEASURED = v;
}

const E = 'essential' as const, I = 'important' as const, M = 'minor' as const, X = 'ignored' as const;
/** Colonne della tabella della specifica: HO, BO, Balance, Semi-stall, Stall. */
const ROWS: [LevelKey, Level, Level, Level, Level, Level][] = [
  ['attacker', E, E, E, E, X],
  ['physicalSweeper', M, M, M, M, X],
  ['specialSweeper', M, M, M, M, X],
  ['physicalBreaker', M, M, M, M, M],
  ['specialBreaker', M, M, M, M, M],
  ['physicalWall', M, M, E, E, E],
  ['specialWall', M, M, E, E, E],
  ['recovery', X, M, I, I, I],
  ['hazards', I, I, I, I, I],
  ['removal', M, I, I, I, I],
  ['pivot', I, I, I, M, M],
  ['screens', M, M, M, M, M],
  ['dot', X, M, M, I, I],
  ['debuff', X, M, M, I, I],
  ['phazer', X, M, I, I, I],
  ['taunt', M, M, M, M, M],
  ['encore', M, M, M, M, M],
  ['itemRemoval', M, M, I, I, I],
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
