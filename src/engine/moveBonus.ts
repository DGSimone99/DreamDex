import type { EngineData } from './data';
import { battleAbility, battleName, battleSpecies, toID } from './dex';
import type { TeamSet } from './sets';
import { outspeedShare, speedPool, speedStat } from './speed';

/**
 * Bonus di due mosse di disturbo (2026-11-21, utente): Knock Off e Taunt/Encore valgono +1 ciascuno, una volta sola
 * anche con più membri che le portano. Sono i ruoli minori "Rimozione Strumenti" e "Disruptor" che non danno più punti:
 * per queste due mosse l'utente vuole comunque un premio. Solo nel singolo.
 * Knock Off: basta averla (Trick e Switcheroo no: l'utente ha chiesto Knock Off).
 * Taunt/Encore: chi la usa deve agire prima di almeno metà del gruppo della Velocità, o avere Prankster (la stessa
 * condizione del ruolo Disruptor). Senza, in National Dex OU la portano più i team medi (42%) di quelli da torneo (32%);
 * con, 18% e 21%, e i brutti 8%. Knock Off: torneo 75%, medio 79%, brutto 37%.
 */
export const KNOCK_OFF_POINTS = 1;
export const TAUNT_ENCORE_POINTS = 1;
/** Taunt ed Encore contano se chi le usa supera in velocità almeno questa quota del gruppo. */
export const TAUNT_FIRST = 0.5;

const TAUNT_ENCORE = new Set(['taunt', 'encore']);

/** Il primo membro del team con Knock Off, o null. */
export function knockOffUser(team: TeamSet[]): { member: string } | null {
  const set = team.find(s => !!battleSpecies(s) && s.moves.some(m => toID(m) === 'knockoff'));
  return set ? { member: battleName(set) } : null;
}

/** Il primo membro del team con Taunt o Encore che agisce prima (o ha Prankster), con la mossa; null se nessuno. */
export function tauntEncoreUser(team: TeamSet[], data: EngineData): { member: string; move: string } | null {
  const speeds = speedPool(data);
  for (const set of team) {
    const move = set.moves.find(m => TAUNT_ENCORE.has(toID(m)));
    if (!move || !battleSpecies(set)) continue;
    const first = toID(battleAbility(set)) === 'prankster' || outspeedShare(speedStat(set).value, speeds, set.species) >= TAUNT_FIRST;
    if (first) return { member: battleName(set), move };
  }
  return null;
}
