import type { TeamRating } from '../../engine/rating';
import { isSummedKey, keyRoles, keyValue, MISSING_BELOW } from '../../engine/needs';
import { levelKeysFor, type Level, type LevelKey } from '../../engine/roleLevels';
import { ESSENTIAL_POINTS, IMPORTANT_POINTS, type TeamRoles } from '../../engine/rolesArea';
import { FAMILIES, secondaryRoles, type Family, type SubRoleReason } from '../../engine/subRoles';

/** Chi porta una voce: valore (col credito del secondario), fonte e motivo del sotto-ruolo migliore dietro la voce. */
export interface RoleHolder { species: string; slot: number; value: number; source: string; secondary: boolean; reason?: SubRoleReason }

/**
 * Una voce dei Ruoli per la vista: livello, famiglia, valore di team, chi la porta (dal migliore), se manca.
 * `together`: il DoT coperto solo dalla somma di più membri (nessuno basta da solo).
 */
export interface RoleLine { key: LevelKey; level: Level; family: Family; value: number; missing: boolean; by: RoleHolder[]; together: boolean }

export const FAMILY_ORDER: Family[] = ['attack', 'defense', 'support', 'utility'];
export const LEVEL_ORDER: Level[] = ['essential', 'important', 'minor', 'ignored'];

/** Le famiglie delle voci del doppio che non sono sotto-ruoli delle famiglie. */
const DOUBLES_FAMILY: Partial<Record<LevelKey, Family>> = {
  anyWall: 'defense', secondProtect: 'support', redirector: 'support', fakeOut: 'utility', spread: 'attack', secondFirstStrike: 'attack',
};

/** La famiglia di una voce: i gruppi degli attaccanti stanno con gli Attaccanti. */
export const familyOf = (key: LevelKey): Family =>
  DOUBLES_FAMILY[key] ?? FAMILY_ORDER.find(f => (FAMILIES[f] as LevelKey[]).includes(key)) ?? 'attack';

/**
 * Tutte le voci della tabella (anche quelle che non contano) coi valori del voto: livello dalle righe del voto, chi la
 * porta dai valori accreditati dei membri (come rolesArea), il motivo dai motivi del membro. Solo lettura: niente logica
 * nuova, le voci contate vengono da `rating.roles.rows`.
 */
export function roleLines(rating: TeamRating): RoleLine[] {
  const { roles } = rating;
  // Solo le voci del formato: in singolo nessuna voce del doppio, in doppio solo le sue
  return levelKeysFor(rating.needs.rules.typeRule).map(key => {
    // Le righe del voto sono tutte le voci che contano: le altre sono ignorate per questo tipo di team
    const row = roles.rows.find(r => r.key === key);
    const level: Level = row?.level ?? 'ignored';
    // Dal valore più alto; a pari valore prima chi la porta da principale
    const by: RoleHolder[] = roles.members.map((m, slot) => {
      const values = m.credited ?? m.values;
      const role = keyRoles(key).reduce((best, r) => ((values[r] ?? 0) > (values[best] ?? 0) ? r : best));
      const reason = m.reasons.find(r => r.role === role);
      const secondary = !!m.values[role] && secondaryRoles(m.primary).includes(role);
      const source = reason?.source ?? row?.by.find(b => b.species === m.species)?.source ?? '';
      return { species: m.species, slot, value: keyValue(values, key), source, secondary, reason };
    }).filter(h => h.value > 0).sort((a, b) => b.value - a.value || Number(a.secondary) - Number(b.secondary));
    const value = row?.value ?? Math.max(0, ...by.map(h => h.value));
    // O c'è o non c'è (2026-11-20, utente): chi la porta solo in parte non si vede; nel DoT, se nessuno basta da solo,
    // restano tutti quelli che contribuiscono alla somma
    const full = by.filter(h => h.value >= MISSING_BELOW);
    const summed = isSummedKey(key) && full.length === 0 && by.length > 0;
    return { key, level, family: familyOf(key), value, missing: value < MISSING_BELOW, by: summed ? by : full, together: summed && value >= MISSING_BELOW };
  });
}

/** Prima le voci che mancano, poi le coperte (a parità resta l'ordine della tabella). */
export const missingFirst = (lines: RoleLine[]) => [...lines].sort((a, b) => Number(b.missing) - Number(a.missing));

/**
 * I malus dei Ruoli valgono adesso? Solo in un team di 6 specie riconosciute (rolesArea): allora c'è almeno un malus o
 * non manca niente, e in tutti e due i casi le voci mancanti sono proprio quelle dei malus.
 */
export const rolesMalusOn = (roles: TeamRoles) => roles.failures.length > 0;

/**
 * Quanto vale una voce sul voto, per la vista (sottoscheda Ruoli e, più avanti, Panoramica):
 * - essenziale o importante: 'ok' se coperta; se manca 'malus' (−4 / −2) in un team che li conta (`full`), altrimenti
 *   'missing' (manca, ma per ora non toglie punti);
 * - minore: 'ok' se coperta, 'none' se no (non è un difetto e non vale punti);
 * - una voce che non conta: sempre 'zero'.
 */
export type RolePointsKind = 'ok' | 'malus' | 'missing' | 'zero' | 'none';
export function rolePoints(line: Pick<RoleLine, 'level' | 'missing'>, full: boolean): { kind: RolePointsKind; points: number } {
  if (line.level === 'essential' || line.level === 'important') {
    if (!line.missing) return { kind: 'ok', points: 0 };
    return full ? { kind: 'malus', points: -(line.level === 'essential' ? ESSENTIAL_POINTS : IMPORTANT_POINTS) } : { kind: 'missing', points: 0 };
  }
  if (line.level === 'minor') return { kind: line.missing ? 'none' : 'ok', points: 0 };
  return { kind: 'zero', points: 0 };
}
