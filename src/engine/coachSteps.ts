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
 * i problemi che quelle proposte risolvono pure finiscono in `alsoSolves`. Un problema già risolto dalla mossa di una
 * tappa non diventa tappa; uno risolto solo dallo swap di una tappa sì, se una mossa libera lo risolve (così i cambi
 * di mossa, più piccoli, non spariscono dietro uno swap che risolve tutto).
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

  // Coperti da una tappa (il suo problema o la sua mossa) e coperti solo dallo swap di una tappa
  const covered = new Set<string>();
  const bySwap = new Set<string>();
  const usedSpecies = new Set<string>();
  const usedMembers = new Set<number>();
  const steps: CoachStep[] = [];
  for (const problem of ordered) {
    if (covered.has(problem.key)) continue;
    const move = sortedMoves.find(m => m.solves.includes(problem.key) && !usedMembers.has(m.index)) ?? null;
    if (bySwap.has(problem.key) && !move) continue;
    const swap = sortedFixes.find(f => f.solves.includes(problem.key) && !usedSpecies.has(f.species)) ?? null;
    if (!swap && !move) continue;
    if (swap) usedSpecies.add(swap.species);
    if (move) usedMembers.add(move.index);
    for (const key of swap?.solves ?? []) bySwap.add(key);
    for (const key of move?.solves ?? []) covered.add(key);
    covered.add(problem.key);
    const solved = new Set([...(swap?.solves ?? []), ...(move?.solves ?? [])]);
    steps.push({ problem, swap, move, alsoSolves: [...solved].filter(key => key !== problem.key) });
  }
  return steps;
}

/** Per la mappa: problema → numero della prima delle `MAX_STEPS` tappe che lo copre (il suo problema o le sue proposte). */
export function stepNumbers(steps: CoachStep[]): Map<string, number> {
  const numbers = new Map<string, number>();
  steps.slice(0, MAX_STEPS).forEach((step, i) => [step.problem.key, ...step.alsoSolves].forEach(key => { if (!numbers.has(key)) numbers.set(key, i + 1); }));
  return numbers;
}
