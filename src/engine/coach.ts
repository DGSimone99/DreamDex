import { analyzeTeam, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleName, battleSpecies, getSpecies, isDefined, isMega, isSelectable, toID, withinGen } from './dex';
import { formatLabel, isBannedIn, meetsTeamRules } from './formats';
import type { Format } from './format';
import { diffContribution, similarity, type Contribution, type Diff } from './replace';
import { t, type Lang } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { illegalParts } from './learnsets';
import { detectRoles, ESSENTIAL_ROLES, isStall, roleLabel, STALL_ROLES } from './roles';
import { scoreCandidates, type Suggestion } from './scoring';
import { roleAndTypeRedundancies, weatherClashes } from './rating';
import { benefits, conditionLabel, viaName, enables, neededConditions, providesAll, teamSynergies, unmetBeneficiaries, unusedEnablers } from './synergy';
import type { TeamSet } from './sets';
import { defensiveMultiplier } from './types';

export const SWAP_MARGIN = 10;
export const SIMILAR_THRESHOLD = 0.6;
export const MAX_SWAPS = 2;
export const MIN_COVERAGE_WEIGHT = 0.05;
export const STRONG_COVERAGE = 15;
/** Oltre questa quota di alternative che si adattano meglio, la sostituzione è consigliata (gialla). */
export const RECOMMEND_SHARE = 0.5;
/** …oppure se la migliore alternativa si adatta meglio di almeno questi punti. */
export const RECOMMEND_GAIN = 25;

export type SwapLevel = 'recommended' | 'optional';

export const classifySwap = (betterShare: number, gain: number): SwapLevel =>
  betterShare > RECOMMEND_SHARE || gain >= RECOMMEND_GAIN ? 'recommended' : 'optional';

/** Categorie dei problemi, nell'ordine in cui si mostrano. */
export const PROBLEM_CATEGORIES = ['rules', 'defense', 'coverage', 'roles', 'conditions', 'redundancy'] as const;
export type ProblemCategory = typeof PROBLEM_CATEGORIES[number];

export interface CoachProblem {
  severity: 'serious' | 'minor';
  category: ProblemCategory;
  text: string;
  fixes: string[];
}

export interface CoachSwap {
  index: number;
  member: string;
  fit: number;
  replacement: string;
  /** Il set del sostituto, pronto da mettere nel team. */
  set: TeamSet;
  score: number;
  similar: boolean;
  level: SwapLevel;
  diff: Diff;
}

export interface Coaching {
  verdict: string;
  strengths: string[];
  problems: CoachProblem[];
  swaps: CoachSwap[];
  /** Per ogni minaccia del meta senza check nel team: i candidati che la gestiscono. */
  threatFixes: Record<string, string[]>;
}

const list = (items: string[]) => items.join(', ');

function fixesFor(candidates: Suggestion[], rank: (s: Suggestion) => number): string[] {
  return candidates
    .map(s => ({ s, hits: rank(s) }))
    .filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map(x => x.s.species);
}

function findStrengths(team: TeamSet[], analysis: TeamAnalysis, lang: Lang): string[] {
  const strengths: string[] = [];
  const solid = analysis.weakness.filter(r => r.resist >= 2 && r.weak === 0).map(r => r.type);
  if (solid.length) strengths.push(t(lang, 'coach.strength.handles', { types: list(solid.map(type => typeName(type, lang))) }));
  const present = new Set(team.flatMap(detectRoles));
  const roles = ESSENTIAL_ROLES.filter(r => present.has(r)).map(r => roleLabel(r, lang));
  if (roles.length) strengths.push(t(lang, 'coach.strength.roles', { roles: list(roles) }));
  const synergies = teamSynergies(team, lang);
  if (synergies.length) strengths.push(t(lang, 'coach.strength.synergies', { list: synergies.join('; ') }));
  const covered = analysis.coverage.filter(r => r.hitters.length > 0).length;
  if (covered >= STRONG_COVERAGE) strengths.push(t(lang, 'coach.strength.coverage', { n: covered }));
  return strengths;
}

/** Gravità di una debolezza difensiva: grave se ne soffrono in tanti senza chi resista. */
export function weaknessSeverity(row: TeamAnalysis['weakness'][number]): 'serious' | 'minor' | null {
  if (row.weak >= 3 || (row.weak >= 2 && row.resist === 0)) return 'serious';
  return row.pressure > 0 ? 'minor' : null;
}

function findProblems(team: TeamSet[], format: Format, analysis: TeamAnalysis, candidates: Suggestion[], lang: Lang): CoachProblem[] {
  const serious: CoachProblem[] = [];
  const minor: CoachProblem[] = [];
  const add = (category: ProblemCategory, isSerious: boolean, text: string, fixes: string[]) =>
    (isSerious ? serious : minor).push({ severity: isSerious ? 'serious' : 'minor', category, text, fixes });

  for (const row of analysis.weakness) {
    const severity = weaknessSeverity(row);
    if (!severity) continue;
    const isSerious = severity === 'serious';
    const text = t(lang, 'coach.problem.weak', {
      type: typeName(row.type, lang), weak: row.weak, resist: row.resist,
      weakWord: t(lang, row.weak === 1 ? 'coach.word.weakOne' : 'coach.word.weakMany'),
      resistWord: t(lang, row.resist === 1 ? 'coach.word.resistOne' : 'coach.word.resistMany'),
    });
    const fixes = fixesFor(candidates, s => Number(defensiveMultiplier(row.type, s.set) < 1));
    add('defense', isSerious, text, fixes);
  }

  for (const set of team) {
    const species = getSpecies(set.species);
    if (!species) continue;
    const forme = battleSpecies(set) ?? species;
    if (!isSelectable(species) || isBannedIn(forme, format)) add('rules', true, t(lang, 'coach.problem.illegal', { species: battleName(set), format: formatLabel(format, lang) }), []);
    else if (!meetsTeamRules(forme, format)) add('rules', true, t(lang, 'coach.problem.monotype', { species: battleName(set), type: typeName(format.monotype ?? '', lang) }), []);
    else if (!withinGen(species, format)) add('rules', true, t(lang, 'coach.problem.gen', { species: battleName(set), gen: format.genLimit }), []);
    // Mosse e abilità che il Pokémon non può avere (senza Custom Skillset)
    const illegal = illegalParts(set, format.genLimit);
    if (illegal.moves.length) {
      add('rules', true, `${battleName(set)}: ${t(lang, 'team.illegalMoves', { list: illegal.moves.map(m => gameName('move', m, lang)).join(', ') })}`, []);
    }
    if (illegal.ability) add('rules', true, `${battleName(set)}: ${t(lang, 'team.illegalAbility', { name: gameName('ability', illegal.ability, lang) })}`, []);
  }

  const megas = team.filter(isMega);
  if (!format.allowMultipleMegas && megas.length > 1) {
    add('rules', true, t(lang, 'coach.problem.megas', { list: list(megas.map(battleName)) }), []);
  }

  // Uno stall non ha bisogno di pivot, priorità o velocità: si chiedono i suoi ruoli
  const memberRoles = team.map(detectRoles);
  const present = new Set(memberRoles.flat());
  const missing = isStall(memberRoles)
    ? STALL_ROLES.filter(r => !present.has(r))
    : analysis.needs.missingRoles.filter(r => ESSENTIAL_ROLES.includes(r));
  if (missing.length) {
    add('roles', false, t(lang, 'coach.problem.missingRoles', { roles: list(missing.map(r => roleLabel(r, lang))) }),
      fixesFor(candidates, s => s.facts.roles.filled.filter(r => missing.includes(r)).length));
  }

  for (const item of roleAndTypeRedundancies(team, lang)) add('redundancy', false, item.text, []);
  for (const item of weatherClashes(team, lang)) add('conditions', false, item.text, []);

  for (const issue of unusedEnablers(team)) {
    add('conditions', false, t(lang, issue.selfBoost ? 'coach.problem.selfBoost' : 'coach.problem.unused', { via: viaName(issue.via, lang), member: issue.member }),
      fixesFor(candidates, s => Number(benefits(s.set).some(b => b.condition === issue.condition && !['Weather Ball', 'Terrain Pulse'].includes(b.via)))));
  }
  for (const issue of unmetBeneficiaries(team)) {
    add('conditions', false, t(lang, 'coach.problem.unmet', { member: issue.member, via: viaName(issue.via, lang), condition: conditionLabel(issue.condition, lang) }),
      fixesFor(candidates, s => Number(enables(s.set).some(e => e.condition === issue.condition))));
  }

  const gaps = analysis.coverage
    .filter(r => r.hitters.length === 0 && analysis.typeWeights[r.type] >= MIN_COVERAGE_WEIGHT)
    .map(r => r.type);
  if (gaps.length) {
    add('coverage', false, t(lang, 'coach.problem.noCoverage', { types: list(gaps.map(type => typeName(type, lang))) }),
      fixesFor(candidates, s => s.facts.coverage.types.filter(t => gaps.includes(t)).length));
  }

  return [...serious, ...minor];
}

function findSwaps(team: TeamSet[], format: Format, data: EngineData): CoachSwap[] {
  const options = team
    .map((member, index) => {
      if (member.favorite) return null;
      const rest = team.filter((_, i) => i !== index);
      const scored = scoreCandidates(rest, format, data, [member]);
      const self = scored.find(s => s.set === member);
      if (!self) return null;
      const own = toID(battleName(member));
      const needed = neededConditions(team, index);
      const better = scored.filter(s =>
        s.set !== member && toID(battleName(s.set)) !== own && s.score - self.score >= SWAP_MARGIN
        && (needed.length === 0 || providesAll(s.set, needed)));
      const others = scored.length - 1;
      if (!better.length) return null;
      const share = others > 0 ? scored.filter(s => s.score > self.score).length / others : 0;
      const level = classifySwap(share, better[0].score - self.score);
      return { index, member, rest, fit: self.score, better, level };
    })
    .filter(isDefined)
    .sort((a, b) =>
      (a.level === b.level ? 0 : a.level === 'recommended' ? -1 : 1)
      || b.better[0].score - b.fit - (a.better[0].score - a.fit));

  // Ogni sostituzione propone un Pokémon diverso: due consigli con lo stesso nome si escludono a vicenda
  const used = new Set<string>();
  const swaps: CoachSwap[] = [];
  for (const option of options) {
    if (swaps.length === MAX_SWAPS) break;
    const pick = option.better.find(s => !used.has(s.species));
    if (!pick) continue;
    used.add(pick.species);
    swaps.push({
      index: option.index,
      member: battleName(option.member),
      fit: option.fit,
      replacement: pick.species,
      set: pick.set,
      score: pick.score,
      similar: similarity(option.member, pick.set) >= SIMILAR_THRESHOLD,
      level: option.level,
      diff: diffContribution(option.member, pick.set, analyzeTeam(option.rest, data)),
    });
  }
  return swaps;
}

/** Giudizio breve sul team; i conteggi dei problemi li mostra l'interfaccia. */
function verdictFor(team: TeamSet[], problems: CoachProblem[], lang: Lang): string {
  if (team.length < 6) return t(lang, 'coach.verdict.incomplete');
  const serious = problems.filter(p => p.severity === 'serious').length;
  return t(lang, serious === 0 ? 'coach.verdict.solid' : serious === 1 ? 'coach.verdict.good' : 'coach.verdict.review');
}

/** Voci del diff raggruppate per tipo: ruoli, "Forte contro X, Y", "Resistente a X, Y". */
function groupChanges(change: Contribution, gain: boolean, lang: Lang): string[] {
  const types = (list: string[]) => list.map(type => typeName(type, lang)).join(', ');
  return [
    ...change.roles.map(role => roleLabel(role, lang)),
    change.covers.length ? t(lang, gain ? 'diff.strong' : 'diff.notStrong', { types: types(change.covers) }) : '',
    change.resists.length ? t(lang, gain ? 'diff.resists' : 'diff.notResists', { types: types(change.resists) }) : '',
  ].filter(Boolean);
}

export interface SwapSummary {
  /** Quanto il sostituto si adatta meglio del membro attuale. */
  gain: number;
  /** Cosa porta il sostituto. */
  pros: string[];
  /** Cosa perde il team. */
  cons: string[];
}

/** Un sostituto scelto a mano tra i "Altri sostituti": prende il posto di quello proposto dal coaching. */
export interface SwapPreview {
  index: number;
  replacement: string;
  set: TeamSet;
  score: number;
  similar: boolean;
  diff: Diff;
}

export const previewSwap = (swap: CoachSwap, preview: SwapPreview | null): CoachSwap =>
  preview && preview.index === swap.index
    ? { ...swap, replacement: preview.replacement, set: preview.set, score: preview.score, similar: preview.similar, diff: preview.diff }
    : swap;

/** Cosa porta il sostituto e cosa perde il team, raggruppato per tipo. */
export const describeDiff = (diff: Diff, lang: Lang = 'it') => ({
  pros: groupChanges(diff.gains, true, lang),
  cons: groupChanges(diff.losses, false, lang),
});

export function describeSwap(swap: CoachSwap, lang: Lang = 'it'): SwapSummary {
  return { gain: swap.score - swap.fit, ...describeDiff(swap.diff, lang) };
}

export function coachTeam(team: TeamSet[], format: Format, data: EngineData, lang: Lang = 'it'): Coaching {
  if (team.length < 2) {
    return { verdict: t(lang, 'coach.addTwo'), strengths: [], problems: [], swaps: [], threatFixes: {} };
  }
  const analysis = analyzeTeam(team, data);
  const candidates = data.stats ? scoreCandidates(team, format, data) : [];
  const problems = findProblems(team, format, analysis, candidates, lang);
  return {
    verdict: verdictFor(team, problems, lang),
    strengths: findStrengths(team, analysis, lang),
    problems,
    swaps: data.stats ? findSwaps(team, format, data) : [],
    threatFixes: Object.fromEntries(analysis.threats
      .filter(t => t.handledBy.length === 0)
      .map(t => [t.name, fixesFor(candidates, s => Number(s.facts.threats.checked.includes(t.name)))])),
  };
}
