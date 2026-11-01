import type { TeamRating } from '../../engine/rating';
import { keyRoles, keyValue, MISSING_BELOW } from '../../engine/needs';
import { LEVEL_KEYS, type Level, type LevelKey } from '../../engine/roleLevels';
import { FAMILIES, secondaryRoles, type Family, type SubRoleReason } from '../../engine/subRoles';

/** Chi porta una voce: valore (col credito del secondario), fonte e motivo del sotto-ruolo migliore dietro la voce. */
export interface RoleHolder { species: string; slot: number; value: number; source: string; secondary: boolean; reason?: SubRoleReason }

/** Una voce dei Ruoli per la vista: livello, famiglia, valore di team, chi la porta (dal migliore), se manca. */
export interface RoleLine { key: LevelKey; level: Level; family: Family; value: number; missing: boolean; by: RoleHolder[] }

export const FAMILY_ORDER: Family[] = ['attack', 'defense', 'support', 'utility'];
export const LEVEL_ORDER: Level[] = ['essential', 'important', 'minor', 'ignored'];

/** La famiglia di una voce: i gruppi degli attaccanti stanno con gli Attaccanti. */
export const familyOf = (key: LevelKey): Family =>
  FAMILY_ORDER.find(f => (FAMILIES[f] as LevelKey[]).includes(key)) ?? 'attack';

export const points = (x: number) => Math.round(100 * x);

/**
 * Tutte le voci della tabella (anche quelle che non contano) coi valori del voto: livello dalle righe del voto, chi la
 * porta dai valori accreditati dei membri (come rolesArea), il motivo dai motivi del membro. Solo lettura: niente logica
 * nuova, le voci contate vengono da `rating.roles.rows`.
 */
export function roleLines(rating: TeamRating): RoleLine[] {
  const { roles } = rating;
  return LEVEL_KEYS.map(key => {
    // Le righe del voto sono tutte le voci che contano: le altre sono ignorate per questo tipo di team
    const row = roles.rows.find(r => r.key === key);
    const level: Level = row?.level ?? 'ignored';
    const by: RoleHolder[] = roles.members.map((m, slot) => {
      const values = m.credited ?? m.values;
      const role = keyRoles(key).reduce((best, r) => ((values[r] ?? 0) > (values[best] ?? 0) ? r : best));
      const reason = m.reasons.find(r => r.role === role);
      const secondary = !!m.values[role] && secondaryRoles(m.primary).includes(role);
      const source = reason?.source ?? row?.by.find(b => b.species === m.species)?.source ?? '';
      return { species: m.species, slot, value: keyValue(values, key), source, secondary, reason };
    }).filter(h => h.value > 0).sort((a, b) => b.value - a.value);
    const value = row?.value ?? Math.max(0, ...by.map(h => h.value));
    return { key, level, family: familyOf(key), value, missing: value < MISSING_BELOW, by };
  });
}

/** Le voci di un livello, raggruppate per famiglia; in ogni famiglia prima quelle che mancano. */
export function byFamily(lines: RoleLine[]): { family: Family; lines: RoleLine[] }[] {
  return FAMILY_ORDER
    .map(family => ({ family, lines: lines.filter(l => l.family === family).sort((a, b) => Number(b.missing) - Number(a.missing)) }))
    .filter(g => g.lines.length > 0);
}
