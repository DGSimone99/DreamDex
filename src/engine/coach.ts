import { analyzeTeam, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleName, battleSpecies, getSpecies, isDefined, isMega, isSelectable, toID, withinGen } from './dex';
import { formatLabel, isBannedIn, meetsTeamRules } from './formats';
import type { Format } from './format';
import { diffContribution, similarity, type Diff } from './replace';
import { detectRoles, ESSENTIAL_ROLES, ROLE_LABELS } from './roles';
import { scoreCandidates, type Suggestion } from './scoring';
import { roleAndTypeRedundancies, weatherClashes } from './rating';
import { benefits, CONDITION_LABELS, enables, neededConditions, providesAll, teamSynergies, unmetBeneficiaries, unusedEnablers } from './synergy';
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
export const PROBLEM_CATEGORIES = ['Regole', 'Difese', 'Coverage', 'Ruoli', 'Meteo e campi', 'Ridondanze'] as const;
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

function findStrengths(team: TeamSet[], analysis: TeamAnalysis): string[] {
  const strengths: string[] = [];
  const solid = analysis.weakness.filter(r => r.resist >= 2 && r.weak === 0).map(r => r.type);
  if (solid.length) strengths.push(`Gestisce bene ${list(solid)}`);
  const present = new Set(team.flatMap(detectRoles));
  const roles = ESSENTIAL_ROLES.filter(r => present.has(r)).map(r => ROLE_LABELS[r]);
  if (roles.length) strengths.push(`Ruoli coperti: ${list(roles)}`);
  const synergies = teamSynergies(team);
  if (synergies.length) strengths.push(`Sinergie: ${synergies.join('; ')}`);
  const covered = analysis.coverage.filter(r => r.hitters.length > 0).length;
  if (covered >= STRONG_COVERAGE) strengths.push(`Colpisce super efficace ${covered}/18 tipi`);
  return strengths;
}

/** Gravità di una debolezza difensiva: grave se ne soffrono in tanti senza chi resista. */
export function weaknessSeverity(row: TeamAnalysis['weakness'][number]): 'serious' | 'minor' | null {
  if (row.weak >= 3 || (row.weak >= 2 && row.resist === 0)) return 'serious';
  return row.pressure > 0 ? 'minor' : null;
}

function findProblems(team: TeamSet[], format: Format, analysis: TeamAnalysis, candidates: Suggestion[]): CoachProblem[] {
  const serious: CoachProblem[] = [];
  const minor: CoachProblem[] = [];
  const add = (category: ProblemCategory, isSerious: boolean, text: string, fixes: string[]) =>
    (isSerious ? serious : minor).push({ severity: isSerious ? 'serious' : 'minor', category, text, fixes });

  for (const row of analysis.weakness) {
    const severity = weaknessSeverity(row);
    if (!severity) continue;
    const isSerious = severity === 'serious';
    const text = `Debole a ${row.type}: ${row.weak} ${row.weak === 1 ? 'Debole' : 'Deboli'} – ${row.resist} ${row.resist === 1 ? 'Resiste' : 'Resistono'}`;
    const fixes = fixesFor(candidates, s => Number(defensiveMultiplier(row.type, s.set) < 1));
    add('Difese', isSerious, text, fixes);
  }

  for (const set of team) {
    const species = getSpecies(set.species);
    if (!species) continue;
    const forme = battleSpecies(set) ?? species;
    if (!isSelectable(species) || isBannedIn(forme, format)) add('Regole', true, `${set.species} non è legale in ${formatLabel(format)}`, []);
    else if (!meetsTeamRules(forme, format)) add('Regole', true, `${set.species} non è di tipo ${format.monotype}`, []);
    else if (!withinGen(species, format)) add('Regole', true, `${set.species} è oltre la Gen ${format.genLimit}`, []);
  }

  const megas = team.filter(isMega);
  if (!format.allowMultipleMegas && megas.length > 1) {
    add('Regole', true, `Più Mega nel team (${list(megas.map(m => m.species))}): in National Dex ne è ammessa una sola`, []);
  }

  const missing = analysis.needs.missingRoles.filter(r => ESSENTIAL_ROLES.includes(r));
  if (missing.length) {
    add('Ruoli', false, `Ruoli mancanti: ${list(missing.map(r => ROLE_LABELS[r]))}`,
      fixesFor(candidates, s => s.facts.roles.filled.filter(r => missing.includes(r)).length));
  }

  for (const item of roleAndTypeRedundancies(team)) add('Ridondanze', false, item.text, []);
  for (const item of weatherClashes(team)) add('Meteo e campi', false, item.text, []);

  for (const issue of unusedEnablers(team)) {
    add('Meteo e campi', false, issue.selfBoost
      ? `${issue.via} di ${issue.member} potenzia solo le sue mosse: nessun altro ne beneficia`
      : `${issue.via} di ${issue.member} non sfruttato: nessuno ne beneficia`,
      fixesFor(candidates, s => Number(benefits(s.set).some(b => b.condition === issue.condition && !['Weather Ball', 'Terrain Pulse'].includes(b.via)))));
  }
  for (const issue of unmetBeneficiaries(team)) {
    add('Meteo e campi', false, `${issue.member} ha ${issue.via} ma il team non porta ${CONDITION_LABELS[issue.condition]}`,
      fixesFor(candidates, s => Number(enables(s.set).some(e => e.condition === issue.condition))));
  }

  const gaps = analysis.coverage
    .filter(r => r.hitters.length === 0 && analysis.typeWeights[r.type] >= MIN_COVERAGE_WEIGHT)
    .map(r => r.type);
  if (gaps.length) {
    add('Coverage', false, `Nessuna mossa super efficace contro ${list(gaps)}`,
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
      member: option.member.species,
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
function verdictFor(team: TeamSet[], problems: CoachProblem[]): string {
  if (team.length < 6) return 'Team incompleto';
  const serious = problems.filter(p => p.severity === 'serious').length;
  return serious === 0 ? 'Team solido' : serious === 1 ? 'Buona base' : 'Da rivedere';
}

/** Voci del diff raggruppate per tipo: ruoli, "Forte contro X, Y", "Resistente a X, Y". */
function groupChanges(items: string[], gain: boolean): string[] {
  const plain = items.map(item => item.replace(/^[+-] /, ''));
  const covers = plain.filter(i => i.startsWith('copre ')).map(i => i.slice('copre '.length));
  const resists = plain.filter(i => i.startsWith('resiste ')).map(i => i.slice('resiste '.length));
  const roles = plain.filter(i => !i.startsWith('copre ') && !i.startsWith('resiste '));
  return [
    ...roles,
    covers.length ? `${gain ? 'Forte' : 'Non più forte'} contro ${covers.join(', ')}` : '',
    resists.length ? `${gain ? 'Resistente' : 'Non più resistente'} a ${resists.join(', ')}` : '',
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
export const describeDiff = (diff: Diff) => ({
  pros: groupChanges(diff.gains, true),
  cons: groupChanges(diff.losses, false),
});

export function describeSwap(swap: CoachSwap): SwapSummary {
  return { gain: swap.score - swap.fit, ...describeDiff(swap.diff) };
}

export function coachTeam(team: TeamSet[], format: Format, data: EngineData): Coaching {
  if (team.length < 2) {
    return { verdict: 'Aggiungi almeno 2 Pokémon per ricevere il coaching', strengths: [], problems: [], swaps: [], threatFixes: {} };
  }
  const analysis = analyzeTeam(team, data);
  const candidates = data.stats ? scoreCandidates(team, format, data) : [];
  const problems = findProblems(team, format, analysis, candidates);
  return {
    verdict: verdictFor(team, problems),
    strengths: findStrengths(team, analysis),
    problems,
    swaps: data.stats ? findSwaps(team, format, data) : [],
    threatFixes: Object.fromEntries(analysis.threats
      .filter(t => t.handledBy.length === 0)
      .map(t => [t.name, fixesFor(candidates, s => Number(s.facts.threats.checked.includes(t.name)))])),
  };
}
