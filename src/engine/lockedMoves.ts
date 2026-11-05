import { getMove, toID } from './dex';
import type { TeamSet } from './sets';

/** Gli strumenti Choice: bloccano su una mossa finché il membro non esce. */
const CHOICE_ITEMS = new Set(['choiceband', 'choicespecs', 'choicescarf']);
/** Con Trick o Switcheroo la Choice passa all'avversario: dopo, tutte le mosse si usano. */
const TRICK_MOVES = new Set(['trick', 'switcheroo']);
/** Potenziamenti che i dati non descrivono come aumenti (`boosts`). */
const EXTRA_SETUP = new Set(['bellydrum', 'stockpile', 'curse']);

/** Mossa che con la Choice non serve: potenziarsi e restare bloccati sul potenziamento, o Protect/Detect (falliscono di fila). */
function uselessWhenLocked(move: NonNullable<ReturnType<typeof getMove>>): boolean {
  if (move.stallingMove) return true;
  if (EXTRA_SETUP.has(move.id)) return true;
  return move.target === 'self' && !!move.boosts && Object.values(move.boosts).some(v => (v ?? 0) > 0);
}

/**
 * Le mosse di stato che non servono al membro:
 * - con l'Assault Vest tutte (nel gioco non si possono usare);
 * - con la Choice, se il set non ha Trick o Switcheroo, i potenziamenti e Protect/Detect. Le altre (Defog, hazard,
 *   stati, Aromatherapy, Recover…) si usano una volta e poi si cambia: sul banco le portano il 16% dei team da torneo.
 * Nel voto valgono come se non ci fossero, e costano un malus (rating.ts).
 */
export function lockedStatusMoves(set: TeamSet): string[] {
  const item = toID(set.item);
  const vest = item === 'assaultvest';
  if (!vest && !CHOICE_ITEMS.has(item)) return [];
  if (!vest && set.moves.some(m => TRICK_MOVES.has(toID(m)))) return [];
  return set.moves.filter(name => {
    const move = getMove(name);
    return move?.category === 'Status' && (vest || uselessWhenLocked(move));
  });
}

const usable = new WeakMap<TeamSet, TeamSet>();
/** Il set senza le mosse di stato inutilizzabili; lo stesso oggetto se non ne ha (le cache per set restano buone). */
export function withUsableMoves(set: TeamSet): TeamSet {
  const locked = lockedStatusMoves(set);
  if (!locked.length) return set;
  let clean = usable.get(set);
  if (!clean) {
    clean = { ...set, moves: set.moves.filter(m => !locked.includes(m)) };
    usable.set(set, clean);
  }
  return clean;
}
