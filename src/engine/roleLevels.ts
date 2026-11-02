import type { Archetype } from './archetype';
import type { SubRole } from './subRoles';

/** Livello di un sotto-ruolo per l'archetipo: essenziale (solo malus), importante (±), minore (solo +), ignorato. */
export type Level = 'essential' | 'important' | 'minor' | 'ignored';
/**
 * Una voce della tabella: un sotto-ruolo, o un gruppo di attaccanti: "anySweeper" = uno sweeper fisico o speciale,
 * "anyBreaker" = un wallbreaker fisico o speciale, "anyPhysical" / "anySpecial" = un attaccante (sweeper o
 * wallbreaker) da quel lato.
 */
export type GroupKey = 'anySweeper' | 'anyBreaker' | 'anyPhysical' | 'anySpecial';
export type LevelKey = SubRole | GroupKey;
/** I sotto-ruoli dietro ogni gruppo (scritti per esteso: subRoles.ts è in un ciclo di import). */
export const GROUP_ROLES: Record<GroupKey, SubRole[]> = {
  anySweeper: ['physicalSweeper', 'specialSweeper'],
  anyBreaker: ['physicalBreaker', 'specialBreaker'],
  anyPhysical: ['physicalSweeper', 'physicalBreaker'],
  anySpecial: ['specialSweeper', 'specialBreaker'],
};
export const isGroupKey = (key: LevelKey): key is GroupKey => key in GROUP_ROLES;

/**
 * Tutte le voci della tabella, nell'ordine della specifica: prima il gruppo degli attaccanti, poi le famiglie (FAMILIES).
 * Scritte per esteso: subRoles.ts è in un ciclo di import e qui servono già al caricamento del modulo.
 */
export const LEVEL_KEYS: LevelKey[] = [
  'anySweeper', 'anyBreaker', 'anyPhysical', 'anySpecial', 'physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker',
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
 * hazard da soli diventano minori; allora nella base pesavano il doppio;
 * dal 2026-11-02 i Ruoli sono una lista con malus e bonus (rolesArea.ts).
 * Il Debuff è minore anche in semi-stall e stall: paralisi o sonno aiutano, ma uno stall non ne ha bisogno (utente).
 */
/**
 * Tabella 2026-11-01 (sera), dal censimento dei team da torneo del banco: 422 di Natdex OU (HO 39, BO 201, Balance 138,
 * Semi-stall 40, Stall 4) e, per lo Stall, i 6 di tutti i formati. Per ogni voce si conta la quota di team del tipo
 * con almeno un membro che la porta (valore ≥ 0,5). Regola unica (utente): essenziale dal 95%, importante dal 70%,
 * minore dal 30%, sotto ignorato. Due eccezioni fisse: le quattro righe singole degli attaccanti e i muri col Recupero
 * non vanno mai oltre il minore (li misurano già Offesa e Difesa; contano i gruppi degli attaccanti), tranne i muri e
 * il Recupero essenziali dove stanno sopra il 95% (Balance, Semi-stall, Stall).
 * Prove sul banco (scripts/bench-levels-spike.ts, cancellato prima del merge): Hazard essenziale con soglia 90 faceva
 * crollare gli HO da torneo sotto la ladder (Ruoli 53 contro 70); muri e Recupero importanti nel BO allagavano la base
 * (la base media saliva a 83–90, vicina alla buona); nessun peso doppio (utente). Basi buona / media / scarsa (Ruoli):
 * HO 74 / 44 / 32, BO 93 / 76 / 51, Balance 89 / 89 / 65, Semi-stall 90 / 90 / 52, Stall 94 / 94 / 47.
 * Quote (Natdex OU) dietro i livelli, per colonna:
 *   HO: gruppi 100 / 100 / 100 / 100; Hazard 92, Controllo 82, Pivot 74; Muri 59 / 36, Recupero 62, Rimozione 69.
 *   BO: gruppi 100 / 100 / 97 / 95; Hazard 90, Controllo 86, Pivot 80, Rimozione 73; Muri 94 / 83, Recupero 83, DoT 34.
 *   Balance: gruppi 100 / 100 / 96 / 91; Muri 100 / 98, Recupero 100, Hazard 99; Pivot 93, Controllo 83, Rimozione 78;
 *     DoT 55, Anti-setup 41.
 *   Semi-stall: Muri 100 / 100, Recupero 100, Hazard 100; Rimozione 90, Controllo 88, DoT 83, Anti-setup 78, Pivot 73,
 *     gruppi 85 / 80 / 83 / 68; Cleric 35.
 *   Stall (6 team): Muri, Recupero, Hazard, Cleric, DoT, Anti-setup 100; Controllo 83; Rimozione 67; gruppi e Pivot 17.
 */
const ROWS: [LevelKey, Level, Level, Level, Level, Level][] = [
  // Attaccanti: i gruppi (le righe singole restano minori o ignorate)
  ['anySweeper', E, E, E, I, X],
  ['anyBreaker', E, E, E, I, X],
  ['anyPhysical', E, E, E, I, X],
  ['anySpecial', E, E, I, M, X],
  ['physicalSweeper', M, M, M, M, X],
  ['specialSweeper', M, M, M, M, X],
  ['physicalBreaker', M, M, M, M, X],
  ['specialBreaker', M, M, M, M, X],
  // Difensori
  ['physicalWall', M, M, E, E, E],
  ['specialWall', M, M, E, E, E],
  ['recovery', M, M, E, E, E],
  // Support
  ['support', X, X, X, M, E],
  ['removal', I, I, I, I, I],
  ['screens', X, X, X, X, X],
  ['speedControl', X, X, X, X, X],
  ['debuff', X, X, X, X, X],
  ['phazer', X, X, M, I, E],
  // Utility
  ['hazards', I, I, E, E, E],
  ['pivot', I, I, I, I, X],
  ['dot', X, M, M, I, E],
  ['taunt', X, X, X, X, X],
  ['encore', X, X, X, X, X],
  ['itemRemoval', M, I, I, I, M],
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
  // Il Recupero lo misura già la Sostenibilità: resta solo dove la tabella lo chiede come essenziale (Balance, semi-stall, stall)
  if (key === 'recovery') return level === 'essential' ? 'essential' : 'ignored';
  if (SWITCHED.has(key) && level === 'minor') return 'ignored';
  return level;
}
