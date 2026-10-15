import { analyzeTeam, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleName, isDefined, isMega, toID } from './dex';
import type { Format } from './format';
import { diffContribution, similarity, type Diff } from './replace';
import { detectRoles, ESSENTIAL_ROLES, ROLE_LABELS } from './roles';
import { scoreCandidates, type Suggestion } from './scoring';
import { roleAndTypeRedundancies, weatherClashes } from './rating';
import { benefits, CONDITION_LABELS, enables, teamSynergies, unmetBeneficiaries, unusedEnablers, weatherMitigations } from './synergy';
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
  for (const m of weatherMitigations(team)) {
    const label = CONDITION_LABELS[m.condition];
    strengths.push(`${label.charAt(0).toUpperCase()}${label.slice(1)} di ${m.source.split(' (')[0]} smorza la debolezza a ${m.type} di ${m.members.map(x => x.species).join(', ')}`);
  }
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

  const missing = analysis.needs.missingRoles.filter(r => ESSENTIAL_ROLES.includes(r));
  if (missing.length) {
    add(false, `Ruoli mancanti: ${list(missing.map(r => ROLE_LABELS[r]))}`,
      fixesFor(candidates, s => s.facts.roles.filled.filter(r => missing.includes(r)).length));
  }

  for (const item of roleAndTypeRedundancies(team)) add(false, `Ridondanza: ${item.text}`, []);
  for (const item of weatherClashes(team)) add(false, item.text, []);

  for (const issue of unusedEnablers(team)) {
    add(false, issue.selfBoost
      ? `${issue.via} di ${issue.member} potenzia solo le sue mosse: nessun altro ne beneficia`
      : `${issue.via} di ${issue.member} non sfruttato: nessuno ne beneficia`,
      fixesFor(candidates, s => Number(benefits(s.set).some(b => b.condition === issue.condition && !['Weather Ball', 'Terrain Pulse'].includes(b.via)))));
  }
  for (const issue of unmetBeneficiaries(team)) {
    add(false, `${issue.member} ha ${issue.via} ma il team non porta ${CONDITION_LABELS[issue.condition]}`,
      fixesFor(candidates, s => Number(enables(s.set).some(e => e.condition === issue.condition))));
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
      if (member.favorite) return null;
      const rest = team.filter((_, i) => i !== index);
      const scored = scoreCandidates(rest, format, data, [member]);
      const self = scored.find(s => s.set === member);
      if (!self) return null;
      const own = toID(battleName(member));
      const better = scored.filter(s =>
        s.set !== member && toID(battleName(s.set)) !== own && s.score - self.score >= SWAP_MARGIN);
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
      score: pick.score,
      similar: similarity(option.member, pick.set) >= SIMILAR_THRESHOLD,
      level: option.level,
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

/** Raggruppa le voci del diff: ruoli, "copre X, Y", "resiste X, Y". */
function describeChanges(diff: Diff): string {
  const group = (items: string[], sign: '+' | '-') => {
    const plain = items.map(item => item.replace(/^[+-] /, ''));
    const covers = plain.filter(i => i.startsWith('copre ')).map(i => i.slice('copre '.length));
    const resists = plain.filter(i => i.startsWith('resiste ')).map(i => i.slice('resiste '.length));
    const roles = plain.filter(i => !i.startsWith('copre ') && !i.startsWith('resiste '));
    const gain = sign === '+';
    return [
      roles.length ? `${gain ? 'porta' : 'perdi'} ${roles.join(', ')}` : '',
      covers.length ? `${gain ? 'copre' : 'non copre più'} ${covers.join(', ')}` : '',
      resists.length ? `${gain ? 'resiste' : 'non resiste più'} ${resists.join(', ')}` : '',
    ].filter(Boolean);
  };
  return [...group(diff.gains, '+'), ...group(diff.losses, '-')].join('; ');
}

export function describeSwap(swap: CoachSwap): string {
  const gain = `(+${swap.score - swap.fit})`;
  const head = swap.similar
    ? `${swap.replacement} fa un lavoro simile a ${swap.member} ma si adatta meglio ${gain}`
    : swap.level === 'optional'
      ? `${swap.member} va già bene · in alternativa ${swap.replacement} si adatta meglio ${gain}`
      : `Valuta di sostituire ${swap.member} · ${swap.replacement} si adatta meglio ${gain}`;
  const changes = describeChanges(swap.diff);
  return changes ? `${head}: ${changes}` : head;
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
