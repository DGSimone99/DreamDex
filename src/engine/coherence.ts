import { getMove, isDefined, toID } from './dex';
import type { FormatRules } from './formatRules';
import { detectRoles } from './roles';
import type { TeamSet } from './sets';
import { defensiveMultiplier, TYPES, type TypeName } from './types';

/** Un buco di coerenza in un team da 6: manca un compito o troppi sono deboli allo stesso tipo. */
export type Gap =
  | { kind: 'hazards' }
  | { kind: 'removal' }
  | { kind: 'weakness'; type: TypeName; count: number };

/**
 * Controlli di coerenza di un team completo: nessuno mette le trappole, nessuno le toglie,
 * tre o più membri deboli allo stesso tipo senza nessuno che lo resista o ne sia immune.
 * Ha senso solo con 6 membri: con meno restituisce [].
 */
export function coherenceGaps(team: TeamSet[], rules: FormatRules): Gap[] {
  if (team.length < 6) return [];
  const gaps: Gap[] = [];
  const roles = team.map(s => detectRoles(s, rules) as string[]);
  if (!roles.some(r => r.includes('hazards'))) gaps.push({ kind: 'hazards' });
  if (!roles.some(r => r.includes('removal'))) gaps.push({ kind: 'removal' });
  for (const type of TYPES) {
    const mults = team.map(s => defensiveMultiplier(type, s));
    const count = mults.filter(m => m > 1).length;
    if (count >= 3 && !mults.some(m => m < 1)) gaps.push({ kind: 'weakness', type, count });
  }
  return gaps;
}

const CHOICE_ITEMS = new Set(['choiceband', 'choicespecs', 'choicescarf']);
const CHOICE_OK_STATUS = new Set(['trick', 'switcheroo']);

/**
 * Set che si contraddice: strumento Choice con una mossa di stato (tranne Trick/Switcheroo; le mosse
 * di setup sono di stato, quindi contano) oppure Gilet d'assalto con qualunque mossa di stato.
 */
export function contradictorySet(set: TeamSet): boolean {
  const item = toID(set.item);
  const status = set.moves.map(getMove).filter(isDefined).filter(m => m.category === 'Status');
  if (item === 'assaultvest') return status.length > 0;
  if (!CHOICE_ITEMS.has(item)) return false;
  return status.some(m => !CHOICE_OK_STATUS.has(m.id));
}
