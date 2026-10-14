import { analyzeTeam, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleName, isDefined, isMega, toID } from './dex';
import type { Format } from './format';
import { diffContribution, similarity, type Diff } from './replace';
import { detectRoles, ESSENTIAL_ROLES, ROLE_LABELS } from './roles';
import { scoreCandidates, type Suggestion } from './scoring';
import type { TeamSet } from './sets';
import { defensiveMultiplier } from './types';

export const SERIOUS_THREAT_USAGE = 0.1;
export const SWAP_MARGIN = 10;
export const SIMILAR_THRESHOLD = 0.6;
export const MAX_SWAPS = 2;
export const MIN_COVERAGE_WEIGHT = 0.05;
export const STRONG_COVERAGE = 15;

export interface CoachProblem {
  severity: 'serious' | 'minor';
  text: string;
  fixes: string[];
}

export interface CoachSwap {
  index: number;
  member: string;
  fit: number;
  replacement: string;
  score: number;
  similar: boolean;
  diff: Diff;
}

export interface Coaching {
  verdict: string;
  strengths: string[];
  problems: CoachProblem[];
  swaps: CoachSwap[];
}

const list = (items: string[]) => items.join(', ');
const pct = (usage: number) => `${(usage * 100).toFixed(1)}%`;

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
  const handled = analysis.threats.filter(t => t.handledBy.length > 0).slice(0, 5).map(t => t.name);
  if (handled.length) strengths.push(`Ferma ${list(handled)}`);
  const covered = analysis.coverage.filter(r => r.hitters.length > 0).length;
  if (covered >= STRONG_COVERAGE) strengths.push(`Colpisce super efficace ${covered}/18 tipi`);
  return strengths;
}

function findProblems(team: TeamSet[], format: Format, analysis: TeamAnalysis, candidates: Suggestion[]): CoachProblem[] {
  const serious: CoachProblem[] = [];
  const minor: CoachProblem[] = [];
  const add = (isSerious: boolean, text: string, fixes: string[]) =>
    (isSerious ? serious : minor).push({ severity: isSerious ? 'serious' : 'minor', text, fixes });

  for (const row of analysis.weakness) {
    const isSerious = row.weak >= 3 || (row.weak >= 2 && row.resist === 0);
    if (!isSerious && row.pressure === 0) continue;
    const text = isSerious
      ? `Debole a ${row.type}: ${row.weak} membri su ${team.length} subiscono danni super efficaci${row.resist === 0 ? ' e nessuno resiste' : ''}`
      : `Debole a ${row.type}: ${row.weak} ${row.weak === 1 ? 'debole' : 'deboli'} contro ${row.resist} che resistono`;
    const fixes = fixesFor(candidates, s => Number(defensiveMultiplier(row.type, s.set) < 1));
    add(isSerious, text, fixes);
  }

  const megas = team.filter(isMega);
  if (!format.allowMultipleMegas && megas.length > 1) {
    add(true, `Più Mega nel team (${list(megas.map(m => m.species))}): in National Dex ne è ammessa una sola`, []);
  }

  const open = analysis.threats.filter(t => t.handledBy.length === 0);
  for (const threat of open.filter(t => t.usage >= SERIOUS_THREAT_USAGE)) {
    add(true, `Nessun check per ${threat.name} (${pct(threat.usage)} di uso)`,
      fixesFor(candidates, s => Number(s.facts.threats.checked.includes(threat.name))));
  }
  const minorThreats = open.filter(t => t.usage < SERIOUS_THREAT_USAGE).map(t => t.name);
  if (minorThreats.length) {
    add(false, `Minacce minori non gestite: ${list(minorThreats)}`,
      fixesFor(candidates, s => s.facts.threats.checked.filter(n => minorThreats.includes(n)).length));
  }

  const missing = analysis.needs.missingRoles.filter(r => ESSENTIAL_ROLES.includes(r));
  if (missing.length) {
    add(false, `Ruoli mancanti: ${list(missing.map(r => ROLE_LABELS[r]))}`,
      fixesFor(candidates, s => s.facts.roles.filled.filter(r => missing.includes(r)).length));
  }

  const gaps = analysis.coverage
    .filter(r => r.hitters.length === 0 && analysis.typeWeights[r.type] >= MIN_COVERAGE_WEIGHT)
    .map(r => r.type);
  if (gaps.length) {
    add(false, `Nessuna mossa super efficace contro ${list(gaps)}`,
      fixesFor(candidates, s => s.facts.coverage.types.filter(t => gaps.includes(t)).length));
  }

  return [...serious, ...minor];
}

function findSwaps(team: TeamSet[], format: Format, data: EngineData): CoachSwap[] {
  const options = team
    .map((member, index) => {
      const rest = team.filter((_, i) => i !== index);
      const scored = scoreCandidates(rest, format, data, [member]);
      const self = scored.find(s => s.set === member);
      if (!self) return null;
      const own = toID(battleName(member));
      const better = scored.filter(s =>
        s.set !== member && toID(battleName(s.set)) !== own && s.score - self.score >= SWAP_MARGIN);
      return better.length ? { index, member, rest, fit: self.score, better } : null;
    })
    .filter(isDefined)
    .sort((a, b) => b.better[0].score - b.fit - (a.better[0].score - a.fit));

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
      score: pick.score,
      similar: similarity(option.member, pick.set) >= SIMILAR_THRESHOLD,
      diff: diffContribution(option.member, pick.set, analyzeTeam(option.rest, data)),
    });
  }
  return swaps;
}

function verdictFor(team: TeamSet[], problems: CoachProblem[]): string {
  const serious = problems.filter(p => p.severity === 'serious').length;
  const minor = problems.length - serious;
  const counts = `${serious} ${serious === 1 ? 'problema serio' : 'problemi seri'}, ${minor} ${minor === 1 ? 'minore' : 'minori'}`;
  if (team.length < 6) {
    const missing = 6 - team.length;
    return `Team incompleto: ${missing === 1 ? 'manca 1 membro' : `mancano ${missing} membri`} · ${counts}`;
  }
  const label = serious === 0 ? 'Team solido' : serious === 1 ? 'Buona base' : 'Da rivedere';
  return `${label} · ${counts}`;
}

export function describeSwap(swap: CoachSwap): string {
  const unsign = (items: string[]) => items.map(item => item.replace(/^[+-] /, '')).join(', ');
  const changes = [
    swap.diff.gains.length ? `porta ${unsign(swap.diff.gains)}` : '',
    swap.diff.losses.length ? `perdi ${unsign(swap.diff.losses)}` : '',
  ].filter(Boolean).join('; ');
  const head = swap.similar
    ? `${swap.replacement} (${swap.score}) fa un lavoro simile a ${swap.member} (${swap.fit}) ma si adatta meglio al team`
    : `Valuta di sostituire ${swap.member} (${swap.fit}): ${swap.replacement} (${swap.score})`;
  if (!changes) return head;
  return swap.similar ? `${head}; ${changes}` : `${head} ${changes}`;
}

export function coachTeam(team: TeamSet[], format: Format, data: EngineData): Coaching {
  if (team.length < 2) {
    return { verdict: 'Aggiungi almeno 2 Pokémon per ricevere il coaching', strengths: [], problems: [], swaps: [] };
  }
  const analysis = analyzeTeam(team, data);
  const candidates = data.stats ? scoreCandidates(team, format, data) : [];
  const problems = findProblems(team, format, analysis, candidates);
  return {
    verdict: verdictFor(team, problems),
    strengths: findStrengths(team, analysis),
    problems,
    swaps: data.stats ? findSwaps(team, format, data) : [],
  };
}
