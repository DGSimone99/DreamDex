import type { CoachProblem, ProblemCategory } from './coach';
import type { CoachFix } from './coachFixes';
import type { MoveFix } from './moveFixes';

/** Tappe mostrate nel Coaching. */
export const MAX_STEPS = 3;

export interface CoachStep {
  problem: CoachProblem;
  /** Cambio di Pokémon (sostituzione o aggiunta) e cambio di mossa: almeno uno dei due c'è. */
  swap: CoachFix | null;
  move: MoveFix | null;
  /** Altri problemi che la tappa copre (risolti da almeno una delle due proposte), chiavi. */
  alsoSolves: string[];
}

/** Colonne della mappa delle aree. */
export type MapColumn = 'defense' | 'offense' | 'roles' | 'rules';

export function columnOf(category: ProblemCategory): MapColumn {
  switch (category) {
    case 'defense': return 'defense';
    case 'coverage': return 'offense';
    case 'rules':
    case 'meta': return 'rules';
    default: return 'roles';
  }
}

/**
 * Le tappe come passata golosa: problemi dal più grave, a pari gravità da quello col +N migliore (swap o mossa che lo risolve).
 * Ogni tappa prende il cambio e la mossa migliori che risolvono il problema, senza riusare specie o membri;
 * i problemi che quelle proposte risolvono pure non diventano tappe ma finiscono in `alsoSolves`.
 */
export function buildSteps(problems: CoachProblem[], fixes: CoachFix[], moves: MoveFix[]): CoachStep[] {
  const seen = new Set<string>();
  const unique = problems.filter(p => !seen.has(p.key) && !!seen.add(p.key));
  const best = (key: string) => Math.max(0, ...[...fixes, ...moves].filter(f => f.solves.includes(key)).map(f => f.gain));
  const ordered = unique
    .map((problem, i) => ({ problem, i, gain: best(problem.key) }))
    .sort((a, b) => Number(b.problem.severity === 'serious') - Number(a.problem.severity === 'serious') || b.gain - a.gain || a.i - b.i)
    .map(x => x.problem);
  const byGain = <T extends { gain: number }>(items: T[]) => [...items].sort((a, b) => b.gain - a.gain);
  const sortedFixes = byGain(fixes);
  const sortedMoves = byGain(moves);

  const covered = new Set<string>();
  const usedSpecies = new Set<string>();
  const usedMembers = new Set<number>();
  const steps: CoachStep[] = [];
  for (const problem of ordered) {
    if (covered.has(problem.key)) continue;
    const swap = sortedFixes.find(f => f.solves.includes(problem.key) && !usedSpecies.has(f.species)) ?? null;
    const move = sortedMoves.find(m => m.solves.includes(problem.key) && !usedMembers.has(m.index)) ?? null;
    if (!swap && !move) continue;
    if (swap) usedSpecies.add(swap.species);
    if (move) usedMembers.add(move.index);
    const solved = new Set([...(swap?.solves ?? []), ...(move?.solves ?? [])]);
    for (const key of solved) covered.add(key);
    covered.add(problem.key);
    steps.push({ problem, swap, move, alsoSolves: [...solved].filter(key => key !== problem.key) });
  }
  return steps;
}

/** Chiavi dei problemi coperti dalle prime `MAX_STEPS` tappe (per il barrato della mappa). */
export function coveredKeys(steps: CoachStep[]): Set<string> {
  return new Set(steps.slice(0, MAX_STEPS).flatMap(s => [s.problem.key, ...s.alsoSolves]));
}
