import { analyzeTeam, type TeamAnalysis } from './analysis';
import type { Archetype } from './archetype';
import type { EngineData } from './data';
import { battleName, battleSpecies } from './dex';
import type { Format } from './format';
import { formatRules, type FormatRules } from './formatRules';
import { detectRoles, type Role } from './roles';
import type { Lang } from '../i18n';
import { scoreCandidates, scoreSets, type Suggestion } from './scoring';
import type { TeamSet } from './sets';
import { neededConditions, providesAll } from './synergy';
import { lostResistances } from './swapGuard';
import { defensiveMultiplier, superEffectiveMove, type TypeName } from './types';

/** Cosa un membro porta al team: ruoli mancanti, tipi scoperti che colpisce, debolezze che resiste. */
export interface Contribution {
  roles: Role[];
  covers: TypeName[];
  resists: TypeName[];
}

export interface Diff {
  gains: Contribution;
  losses: Contribution;
  /** Tipi a cui nessuno nel team resiste più dopo il cambio (fra le perdite non si ripetono). */
  lostResists: TypeName[];
}

export interface Replacement extends Suggestion {
  diff: Diff;
  similarity?: number;
  /** Solo se il membro porta un meteo/campo di cui altri hanno bisogno: vero se anche il sostituto lo porta. */
  keeps?: boolean;
}

/** Chi porta la condizione necessaria in cima, gli altri dopo; dentro ogni gruppo l'ordine resta quello dato (per voto). */
export function keepersFirst<T extends object>(list: T[]): T[] {
  const keeps = (item: T) => 'keeps' in item && item.keeps === true;
  return [...list.filter(keeps), ...list.filter(item => !keeps(item))];
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

export function similarity(a: TeamSet, b: TeamSet, rules: FormatRules): number {
  const sa = battleSpecies(a);
  const sb = battleSpecies(b);
  if (!sa || !sb) return 0;
  const vector = (s: typeof sa) => [s.baseStats.hp, s.baseStats.atk, s.baseStats.def, s.baseStats.spa, s.baseStats.spd, s.baseStats.spe];
  const speedGap = Math.abs(sa.baseStats.spe - sb.baseStats.spe);
  const speed = speedGap <= 10 ? 1 : speedGap <= 25 ? 0.5 : 0;
  return (
    0.35 * jaccard(sa.types, sb.types) +
    0.35 * jaccard(detectRoles(a, rules), detectRoles(b, rules)) +
    0.2 * cosine(vector(sa), vector(sb)) +
    0.1 * speed
  );
}

function contribution(set: TeamSet, analysis: TeamAnalysis): Contribution {
  return {
    roles: detectRoles(set, analysis.needs.rules).filter(role => analysis.needs.missingRoles.includes(role)),
    covers: analysis.coverage
      .filter(row => row.hitters.length === 0 && superEffectiveMove(set, row.type) !== null)
      .map(row => row.type),
    resists: analysis.weakness
      .filter(row => row.pressure > 0 && defensiveMultiplier(row.type, set) < 1)
      .map(row => row.type),
  };
}

/** `rest`: gli altri membri del team, per le resistenze che dopo il cambio nessuno ha più. */
export function diffContribution(original: TeamSet, candidate: TeamSet, analysis: TeamAnalysis, rest: TeamSet[]): Diff {
  const before = contribution(original, analysis);
  const after = contribution(candidate, analysis);
  const minus = <T,>(x: T[], y: T[]) => x.filter(value => !y.includes(value));
  const minusAll = (from: Contribution, to: Contribution): Contribution => ({
    roles: minus(from.roles, to.roles),
    covers: minus(from.covers, to.covers),
    resists: minus(from.resists, to.resists),
  });
  const lostResists = lostResistances([...rest, original], [...rest, candidate]);
  const losses = minusAll(before, after);
  return { gains: minusAll(after, before), losses: { ...losses, resists: minus(losses.resists, lostResists) }, lostResists };
}

/** `pool`: se indicato, si valutano solo questi set (ricerca e filtri) invece dei candidati delle statistiche. */
function candidatesFor(team: TeamSet[], index: number, format: Format, data: EngineData, pool: TeamSet[] | undefined, lang: Lang, archetype?: Archetype) {
  const original = team[index];
  const rest = team.filter((_, i) => i !== index);
  const scored = (pool ? scoreSets(rest, format, data, pool, lang) : scoreCandidates(rest, format, data, [], lang))
    // Lo stesso Pokémon del membro non è un sostituto: si confronta la forma in battaglia (Gardevoir con la Gardevoirite è Gardevoir-Mega)
    .filter(s => battleName(s.set) !== battleName(original));
  // Se l'originale è l'unico a portare un meteo/campo di cui altri hanno bisogno, chi lo porta va in cima (gli altri restano)
  const needed = neededConditions(team, index);
  const marked = needed.length
    ? keepersFirst(scored.map(s => ({ ...s, keeps: providesAll(s.set, needed) })))
    : scored;
  // Col tipo di team scelto, i ruoli che mancano (e quindi guadagni e perdite) sono quelli di quel tipo
  return { original, rest, analysis: analyzeTeam(rest, data, archetype), scored: marked };
}

export function improveReplacements(team: TeamSet[], index: number, format: Format, data: EngineData, limit = 20, pool?: TeamSet[], lang: Lang = 'it', archetype?: Archetype): Replacement[] {
  const { original, rest, analysis, scored } = candidatesFor(team, index, format, data, pool, lang, archetype);
  return scored.slice(0, limit).map(s => ({ ...s, diff: diffContribution(original, s.set, analysis, rest) }));
}

export function similarReplacements(team: TeamSet[], index: number, format: Format, data: EngineData, limit = 20, pool?: TeamSet[], lang: Lang = 'it', archetype?: Archetype): Replacement[] {
  const { original, rest, analysis, scored } = candidatesFor(team, index, format, data, pool, lang, archetype);
  const rank = (r: Replacement) => 0.8 * (r.similarity ?? 0) + 0.2 * (r.score / 100);
  return keepersFirst(scored
    .map(s => ({ ...s, similarity: similarity(original, s.set, formatRules(format.formatId)), diff: diffContribution(original, s.set, analysis, rest) }))
    .sort((a, b) => rank(b) - rank(a)))
    .slice(0, limit);
}
