import type { Archetype } from './archetype';
import type { SubRole } from './subRoles';
import type { FormatRules } from './formatRules';

type TypeRule = FormatRules['typeRule'];

/** Livello di un sotto-ruolo per l'archetipo: essenziale e importante (solo malus, di peso diverso), minore (solo +), ignorato. */
export type Level = 'essential' | 'important' | 'minor' | 'ignored';
/**
 * Una voce della tabella: un sotto-ruolo, o un gruppo di attaccanti: "anySweeper" = uno sweeper fisico o speciale,
 * "anyBreaker" = un wallbreaker fisico o speciale, "anyPhysical" / "anySpecial" = un attaccante da quel lato (sweeper,
 * wallbreaker, o chi ha almeno 2 attacchi di quel lato con Offesa almeno 40: physicalAttacker / specialAttacker),
 * "sweeperOrBreaker" = uno sweeper o un wallbreaker, fisico o speciale (il Balance ne chiede uno dei due),
 * "anyAttacker" = un attaccante fisico o speciale, "secondAttacker" = un secondo membro, diverso, che attacca anche lui
 * (fisico o speciale: il suo valore è il secondo migliore del team, needs.ts).
 */
export type GroupKey = 'anySweeper' | 'anyBreaker' | 'sweeperOrBreaker' | 'anyPhysical' | 'anySpecial' | 'anyAttacker' | 'secondAttacker';
const ATTACKERS: SubRole[] = ['physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker', 'physicalAttacker', 'specialAttacker'];
export type LevelKey = SubRole | GroupKey;
/** I sotto-ruoli dietro ogni gruppo (scritti per esteso: subRoles.ts è in un ciclo di import). */
export const GROUP_ROLES: Record<GroupKey, SubRole[]> = {
  anySweeper: ['physicalSweeper', 'specialSweeper'],
  anyBreaker: ['physicalBreaker', 'specialBreaker'],
  sweeperOrBreaker: ['physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker'],
  // Gli attaccanti di un lato per ultimi: a pari valore la fonte mostrata resta quella dello sweeper o del breaker
  anyPhysical: ['physicalSweeper', 'physicalBreaker', 'physicalAttacker'],
  anySpecial: ['specialSweeper', 'specialBreaker', 'specialAttacker'],
  anyAttacker: ATTACKERS,
  secondAttacker: ATTACKERS,
};
export const isGroupKey = (key: LevelKey): key is GroupKey => key in GROUP_ROLES;

/**
 * Tutte le voci della tabella, nell'ordine della specifica: prima il gruppo degli attaccanti, poi le famiglie (FAMILIES).
 * Scritte per esteso: subRoles.ts è in un ciclo di import e qui servono già al caricamento del modulo.
 */
export const LEVEL_KEYS: LevelKey[] = [
  'anySweeper', 'anyBreaker', 'sweeperOrBreaker', 'anyPhysical', 'anySpecial', 'anyAttacker', 'secondAttacker', 'physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker',
  'physicalWall', 'specialWall', 'recovery',
  'support', 'removal', 'screens', 'speedControl', 'debuff', 'phazer',
  'hazards', 'pivot', 'dot', 'taunt', 'encore', 'itemRemoval',
];

/**
 * Interruttore: i sotto-ruoli misurati anche da altre aree (Attacco, muri, Recupero) contano anche nei Ruoli.
 * Spento, le loro voci minori diventano ignorate e il Recupero conta solo dove è essenziale (Balance, semi-stall, stall).
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
 * Oggi le voci importanti dell'HO e del Bulky Offense sono Hazard e Controllo Hazard (il vecchio gruppo "fieldSetup"
 * del 2026-10-24 non c'è più); dal 2026-11-02 i Ruoli sono una lista con malus e bonus (rolesArea.ts).
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
 * 2026-11-03 (test dei pesi): Pivot e Rimozione Strumenti scendono a minori ovunque. Il censimento su tutti i formati
 * dice che non distinguono: il Pivot manca al 47% degli HO da torneo e solo al 17% di quelli del ladder (nel semi-stall
 * 39% contro 10%), Knock Off manca al 30% dei BO da torneo e al 33% del ladder. Costavano 2 punti a team da torneo
 * senza separare; come minori danno +1 a chi li ha. Hazard, Rimozione e l'attaccante fisico del semi-stall separano e restano.
 */
/*
 * 2026-11-11 (utente): gli attaccanti per lato restano in HO e BO (essenziali tutti e due: un team di un solo lato si
 * ferma su un muro); nel Balance fisico e speciale importanti alla pari (prima fisico essenziale e speciale importante);
 * nel Semi-stall un attaccante qualunque importante e un secondo minore (prima fisico importante e speciale minore, solo
 * per la soglia: 83% contro 68% dei team da torneo); nello Stall tutti gli attaccanti minori (prima ignorati, e in
 * National Dex OU quelli del Semi-stall).
 * 2026-11-13 (utente): nel Balance basta uno Sweeper o un Wallbreaker (essenziale uno dei due, come fisico o speciale):
 * un Balance pesante vince coi suoi setup (Dragon Dance, Calm Mind) e prendeva −4 per "senza Wallbreaker". Nel
 * Semi-stall Sweeper e Wallbreaker diventano minori (+1 se ci sono, niente malus se mancano): uno stall con un muro che
 * attacca è letto Semi-stall e pagava ruoli che non gli servono.
 */
const ROWS: [LevelKey, Level, Level, Level, Level, Level][] = [
  // Attaccanti: i gruppi (le righe singole restano minori o ignorate)
  ['anySweeper', E, E, X, M, M],
  ['anyBreaker', E, E, X, M, M],
  ['sweeperOrBreaker', X, X, E, X, X],
  ['anyPhysical', E, E, I, X, X],
  ['anySpecial', E, E, I, X, X],
  ['anyAttacker', X, X, X, I, M],
  ['secondAttacker', X, X, X, M, M],
  ['physicalSweeper', M, M, M, M, M],
  ['specialSweeper', M, M, M, M, M],
  ['physicalBreaker', M, M, M, M, M],
  ['specialBreaker', M, M, M, M, M],
  // Difensori
  ['physicalWall', M, M, E, E, E],
  ['specialWall', M, M, E, E, E],
  ['recovery', M, M, E, E, E],
  // Support
  ['support', X, X, X, M, E],
  ['removal', I, I, I, I, I],
  // Screens minori ovunque (utente 2026-11-08): un lavoro vero, +1 a chi li ha; le partite non dicono di più (vince ~48%)
  ['screens', M, M, M, M, M],
  ['speedControl', X, X, X, X, X],
  ['debuff', X, X, X, X, X],
  ['phazer', X, X, M, I, E],
  // Utility
  ['hazards', I, I, E, E, E],
  ['pivot', M, M, M, M, X],
  ['dot', X, M, M, I, E],
  ['taunt', X, X, X, X, X],
  ['encore', X, X, X, X, X],
  ['itemRemoval', M, M, M, M, M],
];
const COLUMNS: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];

/** La colonna del doppio (tipo unico): un elenco a parte, uguale per ogni team. */
const DOUBLES_LEVELS: Partial<Record<LevelKey, Level>> = {};

/** Livelli per archetipo (bozza della specifica; le voci ignorate sono omesse). */
export const ROLE_LEVELS: Record<Archetype, Partial<Record<LevelKey, Level>>> = {
  ...Object.fromEntries(
    COLUMNS.map((archetype, c) => [archetype, Object.fromEntries(
      ROWS.filter(row => row[c + 1] !== X).map(row => [row[0], row[c + 1]]),
    )]),
  ),
  doubles: DOUBLES_LEVELS,
} as Record<Archetype, Partial<Record<LevelKey, Level>>>;

/** Righe toccate dall'interruttore: Attacco e muri (il gruppo degli attaccanti resta). */
const SWITCHED = new Set<LevelKey>(['physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker', 'physicalWall', 'specialWall']);

/**
 * Il tipo di team di cui si chiedono i ruoli. In National Dex OU (regola 'recoverySpeed') lo Stall chiede quelli del
 * Semi-stall, tranne gli attaccanti che prende dalla sua colonna (levelFor, 2026-11-11). Prima, dal 2026-11-08, tutti:
 * i due tipi hanno già gli stessi pesi, e il salto fra loro veniva tutto dai ruoli (il Semi-stall
 * chiede Sweeper, Wallbreaker e Attaccante fisico come importanti). Una mossa d'attacco al posto di un recupero toglieva
 * fino a 8 punti (Mega Sableye Recover → Foul Play 77 → 69); così 4 al massimo. I team Stall perdono in media 2,6 punti,
 * in linea con le partite vere (lo Stall vince il 32,5%, il peggiore); il resto del banco e le partite non cambiano.
 */
export const rolesTypeOf = (archetype: Archetype, typeRule?: TypeRule): Archetype =>
  typeRule === 'recoverySpeed' && archetype === 'stall' ? 'semiStall' : archetype;

/** Le voci degli attaccanti: in National Dex OU lo Stall le prende dalla sua colonna (tutte minori), il resto dal Semi-stall. */
const ATTACK_ROWS = new Set<LevelKey>(['anySweeper', 'anyBreaker', 'sweeperOrBreaker', 'anyPhysical', 'anySpecial', 'anyAttacker', 'secondAttacker', ...ATTACKERS]);

/** Livello della voce per il tipo di team nel formato: rolesTypeOf, tranne gli attaccanti dello Stall (2026-11-11). */
export const levelFor = (archetype: Archetype, key: LevelKey, typeRule?: TypeRule): Level =>
  levelOf(archetype === 'stall' && ATTACK_ROWS.has(key) ? 'stall' : rolesTypeOf(archetype, typeRule), key);

/** Livello della voce per l'archetipo, con l'interruttore applicato. */
export function levelOf(archetype: Archetype, key: LevelKey): Level {
  const level = ROLE_LEVELS[archetype][key] ?? 'ignored';
  if (ROLES_COUNT_MEASURED) return level;
  // Il ruolo Recupero lo misura già la sottoscheda Recupero della Difesa: resta solo dove la tabella lo chiede come essenziale (Balance, semi-stall, stall)
  if (key === 'recovery') return level === 'essential' ? 'essential' : 'ignored';
  if (SWITCHED.has(key) && level === 'minor') return 'ignored';
  return level;
}
