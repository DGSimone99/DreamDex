import { analyzeTeam, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleSpecies } from './dex';
import type { Format } from './format';
import { detectRoles, roleLabel } from './roles';
import { scoreCandidates, scoreSets, type Suggestion } from './scoring';
import type { TeamSet } from './sets';
import { neededConditions, providesAll } from './synergy';
import { defensiveMultiplier, superEffectiveMove } from './types';

export interface Diff {
  gains: string[];
  losses: string[];
}

export interface Replacement extends Suggestion {
  diff: Diff;
  similarity?: number;
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  return [...left].filter(x => right.has(x)).length / union.size;
}

function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((acc, x, i) => acc + x * b[i], 0);
  const norm = (v: number[]) => Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
  return dot / (norm(a) * norm(b) || 1);
}

export function similarity(a: TeamSet, b: TeamSet): number {
  const sa = battleSpecies(a);
  const sb = battleSpecies(b);
  if (!sa || !sb) return 0;
  const vector = (s: typeof sa) => [s.baseStats.hp, s.baseStats.atk, s.baseStats.def, s.baseStats.spa, s.baseStats.spd, s.baseStats.spe];
  const speedGap = Math.abs(sa.baseStats.spe - sb.baseStats.spe);
  const speed = speedGap <= 10 ? 1 : speedGap <= 25 ? 0.5 : 0;
  return (
    0.35 * jaccard(sa.types, sb.types) +
    0.35 * jaccard(detectRoles(a), detectRoles(b)) +
    0.2 * cosine(vector(sa), vector(sb)) +
    0.1 * speed
  );
}

function contribution(set: TeamSet, analysis: TeamAnalysis) {
  return {
    roles: detectRoles(set).filter(role => analysis.needs.missingRoles.includes(role)),
    covers: analysis.coverage
      .filter(row => row.hitters.length === 0 && superEffectiveMove(set, row.type) !== null)
      .map(row => row.type),
    resists: analysis.weakness
      .filter(row => row.pressure > 0 && defensiveMultiplier(row.type, set) < 1)
      .map(row => row.type),
  };
}

export function diffContribution(original: TeamSet, candidate: TeamSet, analysis: TeamAnalysis): Diff {
  const before = contribution(original, analysis);
  const after = contribution(candidate, analysis);
  const minus = <T,>(x: T[], y: T[]) => x.filter(value => !y.includes(value));
  const describe = (sign: '+' | '-', from: typeof before, to: typeof before) => [
    ...minus(from.roles, to.roles).map(role => `${sign} ${roleLabel(role)}`),
    ...minus(from.covers, to.covers).map(type => `${sign} copre ${type}`),
    ...minus(from.resists, to.resists).map(type => `${sign} resiste ${type}`),
  ];
  return { gains: describe('+', after, before), losses: describe('-', before, after) };
}

/** `pool`: se indicato, si valutano solo questi set (ricerca e filtri) invece dei candidati delle statistiche. */
function candidatesFor(team: TeamSet[], index: number, format: Format, data: EngineData, pool?: TeamSet[]) {
  const original = team[index];
  const rest = team.filter((_, i) => i !== index);
  const scored = (pool ? scoreSets(rest, format, data, pool) : scoreCandidates(rest, format, data))
    .filter(s => s.species !== original.species);
  // Se l'originale porta un meteo/campo di cui altri membri hanno bisogno, il sostituto deve portarlo anch'esso
  const needed = neededConditions(team, index);
  const keepers = needed.length ? scored.filter(s => providesAll(s.set, needed)) : scored;
  return { original, analysis: analyzeTeam(rest, data), scored: keepers.length ? keepers : scored };
}

export function improveReplacements(team: TeamSet[], index: number, format: Format, data: EngineData, limit = 20, pool?: TeamSet[]): Replacement[] {
  const { original, analysis, scored } = candidatesFor(team, index, format, data, pool);
  return scored.slice(0, limit).map(s => ({ ...s, diff: diffContribution(original, s.set, analysis) }));
}

export function similarReplacements(team: TeamSet[], index: number, format: Format, data: EngineData, limit = 20, pool?: TeamSet[]): Replacement[] {
  const { original, analysis, scored } = candidatesFor(team, index, format, data, pool);
  const rank = (r: Replacement) => 0.8 * (r.similarity ?? 0) + 0.2 * (r.score / 100);
  return scored
    .map(s => ({ ...s, similarity: similarity(original, s.set), diff: diffContribution(original, s.set, analysis) }))
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, limit);
}
