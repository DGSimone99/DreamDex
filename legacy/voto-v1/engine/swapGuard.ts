import { MISSING_BELOW, type TeamNeeds } from './needs';
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

/** Tipi a cui qualcuno del team resisteva (o era immune) prima del cambio e nessuno dopo. */
export function lostResistances(before: TeamSet[], after: TeamSet[]): TypeName[] {
  const resisted = (team: TeamSet[], type: TypeName) => team.some(set => defensiveMultiplier(type, set) < 1);
  return TYPES.filter(type => resisted(before, type) && !resisted(after, type));
}
