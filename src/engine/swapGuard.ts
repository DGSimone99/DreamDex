import { MISSING_BELOW, teamValue, type TeamNeeds } from './needs';
import type { TeamRating } from './rating';
import { LEVEL_KEYS, type LevelKey } from './roleLevels';
import type { TeamSet } from './sets';
import { defensiveMultiplier, TYPES, type TypeName } from './types';

/** Una voce dei Ruoli essenziale o importante che il team aveva e che dopo il cambio nessuno copre più. */
export interface LostRole {
  key: LevelKey;
  level: 'essential' | 'important';
}

/** Quanto scende in classifica un cambio per ogni voce persa (solo l'ordine: il voto mostrato resta quello vero). */
export const ROLE_PENALTY: Record<LostRole['level'], number> = { essential: 3, important: 2 };

/**
 * Voci essenziali o importanti (per il tipo di team di `before`) presenti prima del cambio e mancanti dopo:
 * contano solo le perdite nuove, non quelle che mancavano già, e riempire una voce non dà niente.
 */
export function lostRoles(before: TeamNeeds, after: TeamNeeds): LostRole[] {
  return LEVEL_KEYS.flatMap(key => {
    const level = before.levels[key];
    if (level !== 'essential' && level !== 'important') return [];
    return before.values[key] >= MISSING_BELOW && after.values[key] < MISSING_BELOW ? [{ key, level }] : [];
  });
}

export const rolePenalty = (lost: LostRole[]): number => lost.reduce((sum, role) => sum + ROLE_PENALTY[role.level], 0);

/**
 * I ruoli d'aiuto che il voto non misura in nessuna area (utente, 2026-11-22): danno nel tempo, Disruptor (Taunt, Encore,
 * paralisi, sonno), rimozione degli strumenti, pivot, anti-setup e Cleric. Dove sono minori non danno e non tolgono punti,
 * quindi per il voto la mossa che li porta vale zero: "zero" però vuol dire "non misurato", non "inutile" (li portano il
 * 58% dei team da torneo non stall di National Dex OU, quanto i team medi). Senza protezione il Coaching proponeva di
 * togliere Toxic per un +1 in un team da torneo su quattro (9 su 40 fra Bulky Offense e Balance). Attaccanti, muri,
 * recupero e schermi restano fuori: li misurano già Attacco e Difesa.
 */
export const HELPER_ROLES: LevelKey[] = ['dot', 'disruptor', 'itemRemoval', 'pivot', 'phazer', 'support'];

/** Quanto scende in classifica un cambio per ogni ruolo d'aiuto che il team perde (solo l'ordine: il voto mostrato resta quello vero). */
export const HELPER_PENALTY = 1;

/**
 * I ruoli d'aiuto minori (per il tipo di team di `before`) che il team copriva e che dopo il cambio nessuno copre più.
 * Essenziali e importanti non servono qui: perderli costa già punti nel voto. Si legge dai voti già calcolati.
 */
export function lostHelpers(before: TeamRating, after: TeamRating): LevelKey[] {
  const now = after.roles.members.map(member => member.credited ?? member.values);
  return before.roles.rows
    .filter(row => row.level === 'minor' && HELPER_ROLES.includes(row.key) && row.value >= MISSING_BELOW && teamValue(now, row.key) < MISSING_BELOW)
    .map(row => row.key);
}

/** Tipi a cui qualcuno del team resisteva (o era immune) prima del cambio e nessuno dopo. */
export function lostResistances(before: TeamSet[], after: TeamSet[]): TypeName[] {
  const resisted = (team: TeamSet[], type: TypeName) => team.some(set => defensiveMultiplier(type, set) < 1);
  return TYPES.filter(type => resisted(before, type) && !resisted(after, type));
}
