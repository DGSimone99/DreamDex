import { analyzeTeam, type TeamAnalysis } from './analysis';
import { teamArchetype, type Archetype, type TeamArchetype } from './archetype';
import type { EngineData } from './data';
import { rulesOf, type FormatRules } from './formatRules';
import { battleName, battleSpecies, getSpecies, isDefined, isMega, isSelectable, toID, withinGen } from './dex';
import { bannedParts, formatLabel, isLegalIn, pokedexOf } from './formats';
import type { Format } from './format';
import { diffContribution, similarity, type Contribution, type Diff } from './replace';
import { t, type Lang } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { illegalParts } from './learnsets';
import { isPassive, isStall, roleLabel } from './roles';
import { keyRoles, needLabel } from './needs';
import { LEVEL_KEYS } from './roleLevels';
import { bannedInPool, scoreCandidates, type Suggestion } from './scoring';
import { memberIssues, rateTeam, roleAndTypeRedundancies, weatherClashes } from './rating';
import { benefits, conditionLabel, viaName, enables, neededConditions, providesAll, teamSynergies, unmetBeneficiaries, unusedEnablers } from './synergy';
import type { TeamSet } from './sets';
import type { ScoredArea } from './teamGain';
import { defensiveMultiplier } from './types';

export const SWAP_MARGIN = 10;
export const SIMILAR_THRESHOLD = 0.6;
export const MAX_SWAPS = 2;
export const MIN_COVERAGE_WEIGHT = 0.05;
export const STRONG_COVERAGE = 15;
/** Alternative per membro rivalutate col voto del team (le meglio adattate). */
export const SWAP_CANDIDATES = 5;
/** Punti di voto che una sostituzione deve guadagnare per essere proposta… */
export const MIN_RATING_GAIN = 5;
/** …e per essere consigliata (gialla). */
export const RECOMMEND_RATING_GAIN = 10;

export type SwapLevel = 'recommended' | 'optional';

/** Livello di una sostituzione dai punti di voto guadagnati; un membro illegale va sempre sostituito. */
export const classifySwap = (ratingGain: number, illegal = false): SwapLevel | null =>
  illegal || ratingGain >= RECOMMEND_RATING_GAIN ? 'recommended' : ratingGain >= MIN_RATING_GAIN ? 'optional' : null;

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
  /** Punti di voto che il team guadagna con la sostituzione. */
  ratingGain: number;
  diff: Diff;
}

export interface Coaching {
  verdict: string;
  /** Archetipo e stili del team completo (solo descrittivo: non cambia voto né consigli). */
  teamType: TeamArchetype | null;
  strengths: string[];
  problems: CoachProblem[];
  swaps: CoachSwap[];
  /** Per ogni minaccia del meta senza check nel team: i candidati che la gestiscono. */
  threatFixes: Record<string, string[]>;
  /** Candidati esclusi perché bannati dall'utente (assente: nessuno). */
  bannedCount?: number;
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
  // Ruoli essenziali per l'archetipo del team, coperti
  const { levels, essentialMissing } = analysis.needs;
  const roles = LEVEL_KEYS.filter(key => levels[key] === 'essential' && !essentialMissing.includes(key)).map(need => needLabel(need, lang));
  if (roles.length) strengths.push(t(lang, 'coach.strength.roles', { roles: list(roles) }));
  const synergies = teamSynergies(team, lang);
  if (synergies.length) strengths.push(t(lang, 'coach.strength.synergies', { list: synergies.join('; ') }));
  const covered = analysis.coverage.filter(r => r.hitters.length > 0).length;
  if (covered >= STRONG_COVERAGE) strengths.push(t(lang, 'coach.strength.coverage', { n: covered }));
  return strengths;
}

/** Gravità di una debolezza difensiva, come nel voto: grave se i deboli superano di 2 chi resiste. */
export function weaknessSeverity(row: TeamAnalysis['weakness'][number]): 'serious' | 'minor' | null {
  if (row.pressure >= 2) return 'serious';
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
    if (!isSelectable(species) || !isLegalIn(forme, format)) add('rules', true, t(lang, 'coach.problem.illegal', { species: battleName(set), format: formatLabel(format, lang) }), []);
    else if (!withinGen(species, format)) add('rules', true, t(lang, 'coach.problem.gen', { species: battleName(set), gen: format.genLimit }), []);
    // Mosse e abilità che il Pokémon non può avere (senza Custom Skillset)
    const illegal = illegalParts(set, format.genLimit, pokedexOf(format));
    if (illegal.moves.length) {
      add('rules', true, `${battleName(set)}: ${t(lang, 'team.illegalMoves', { list: illegal.moves.map(m => gameName('move', m, lang)).join(', ') })}`, []);
    }
    if (illegal.ability) add('rules', true, `${battleName(set)}: ${t(lang, 'team.illegalAbility', { name: gameName('ability', illegal.ability, lang) })}`, []);
    // Mosse, abilità e strumenti vietati dal formato (Shed Tail, Moody, King's Rock…)
    for (const text of bannedTexts(set, format, lang)) add('rules', true, `${battleName(set)}: ${text}`, []);
  }

  const megas = team.filter(isMega);
  if (!format.allowMultipleMegas && megas.length > 1) {
    add('rules', true, t(lang, 'coach.problem.megas', { list: list(megas.map(battleName)) }), []);
  }

  // Si chiedono solo le voci essenziali per l'archetipo del team (uno stall non ha bisogno di attaccanti)
  const missing = analysis.needs.essentialMissing;
  if (missing.length) {
    add('roles', false, t(lang, 'coach.problem.missingRoles', { roles: list(missing.map(need => needLabel(need, lang))) }),
      fixesFor(candidates, s => missing.filter(need => keyRoles(need).some(role => s.facts.roles.filled.includes(role))).length));
  }
  // Le voci importanti mancanti: una riga a parte, dopo quella degli essenziali (abbassano il voto, non sono un requisito)
  const important = analysis.needs.importantMissing;
  if (important.length) {
    add('roles', false, t(lang, 'coach.problem.missingImportantRoles', { roles: list(important.map(need => needLabel(need, lang))) }),
      fixesFor(candidates, s => important.filter(need => keyRoles(need).some(role => s.facts.roles.filled.includes(role))).length));
  }

  for (const item of memberIssues(team, lang, analysis.needs)) add('roles', false, item.text, []);
  // Squilibrio degli attaccanti (nel voto è una mancanza essenziale dei Ruoli, solo a team finito)
  const style = analysis.needs.needStyle;
  if (style) add('roles', false, t(lang, 'rating.redundancy.oneStyle', { style: t(lang, `analysis.style.${style}`) }), []);
  for (const item of roleAndTypeRedundancies(team, lang, { sameType: true })) add('redundancy', false, item.text, []);
  for (const item of weatherClashes(team, lang)) add('conditions', false, item.text, []);

  for (const issue of unusedEnablers(team)) {
    add('conditions', false, t(lang, 'coach.problem.unused', { via: viaName(issue.via, lang), member: issue.member }),
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

/** Mosse, abilità e strumento del set vietati dal formato, come testi. */
export function bannedTexts(set: TeamSet, format: Format, lang: Lang = 'it'): string[] {
  const banned = bannedParts(set, format);
  const where = formatLabel(format, lang);
  return [
    banned.moves.length ? t(lang, 'team.bannedMoves', { list: banned.moves.map(m => gameName('move', m, lang)).join(', '), format: where }) : null,
    banned.ability ? t(lang, 'team.bannedAbility', { name: gameName('ability', banned.ability, lang), format: where }) : null,
    banned.item ? t(lang, 'team.bannedItem', { name: gameName('item', banned.item, lang), format: where }) : null,
  ].filter((x): x is string => !!x);
}

/** Il membro non può stare nel formato (specie vietata o fuori dalla generazione). */
function breaksRules(set: TeamSet, format: Format): boolean {
  const species = getSpecies(set.species);
  if (!species) return false;
  const forme = battleSpecies(set) ?? species;
  return !isSelectable(species) || !isLegalIn(forme, format) || !withinGen(species, format);
}

/**
 * Sostituzioni giudicate col voto: per ogni membro le alternative meglio adattate vengono messe nel team
 * e rivalutate; si propone solo chi alza il voto di almeno MIN_RATING_GAIN (consigliata da RECOMMEND_RATING_GAIN).
 * In uno stall un muro passivo si sostituisce solo con un altro passivo, e il team deve restare stall.
 */
function findSwaps(team: TeamSet[], format: Format, data: EngineData): CoachSwap[] {
  const current = rateTeam(team, data);
  if (!current) return [];
  const rules = rulesOf(data);
  const stall = isStall(team, rules);
  const archetype = archetypeLock(team, rules, current.grade);
  const options = team
    .map((member, index) => {
      if (member.favorite) return null;
      const rest = team.filter((_, i) => i !== index);
      const scored = scoreCandidates(rest, format, data, [member]);
      const self = scored.find(s => s.set === member);
      if (!self) return null;
      const own = toID(battleName(member));
      const needed = neededConditions(team, index);
      const illegal = breaksRules(member, format);
      const keepPassive = stall && isPassive(member, rules);
      const rated = scored
        .filter(s =>
          s.set !== member && toID(battleName(s.set)) !== own && (illegal || s.score - self.score >= SWAP_MARGIN)
          && (needed.length === 0 || providesAll(s.set, needed)) && (!keepPassive || isPassive(s.set, rules)))
        .slice(0, SWAP_CANDIDATES)
        .map(s => ({ s, rating: rateTeam(team.map((m, i) => (i === index ? s.set : m)), data)! }))
        .filter(x => !stall || x.rating.archetype === 'stall')
        .filter(x => !archetype || teamArchetype(team.map((m, i) => (i === index ? x.s.set : m)), rules)?.archetype === archetype)
        .map(x => ({ s: x.s, gain: x.rating.overall - current.overall, level: classifySwap(x.rating.overall - current.overall, illegal) }))
        .filter((x): x is { s: Suggestion; gain: number; level: SwapLevel } => x.level !== null)
        .sort((a, b) => b.gain - a.gain || b.s.score - a.s.score);
      if (!rated.length) return null;
      return { index, member, rest, fit: self.score, rated, illegal };
    })
    .filter(isDefined)
    // Prima i membri illegali, poi le consigliate, poi per punti di voto guadagnati
    .sort((a, b) => Number(b.illegal) - Number(a.illegal)
      || (a.rated[0].level === b.rated[0].level ? 0 : a.rated[0].level === 'recommended' ? -1 : 1)
      || b.rated[0].gain - a.rated[0].gain);

  // Ogni sostituzione propone un Pokémon diverso: due consigli con lo stesso nome si escludono a vicenda
  const used = new Set<string>();
  const swaps: CoachSwap[] = [];
  for (const option of options) {
    if (swaps.length === MAX_SWAPS) break;
    const pick = option.rated.find(x => !used.has(x.s.species));
    if (!pick) continue;
    used.add(pick.s.species);
    swaps.push({
      index: option.index,
      member: battleName(option.member),
      fit: option.fit,
      replacement: pick.s.species,
      set: pick.s.set,
      score: pick.s.score,
      similar: similarity(option.member, pick.s.set, rules) >= SIMILAR_THRESHOLD,
      level: pick.level,
      ratingGain: pick.gain,
      diff: diffContribution(option.member, pick.s.set, analyzeTeam(option.rest, data), option.rest),
    });
  }
  return swaps;
}

/**
 * Il tipo di team che i consigli devono mantenere, o undefined se possono cambiarlo.
 * In Ubers un consiglio non cambia il tipo di team (un HO resta HO), salvo per un team da C o D da ricostruire.
 */
export function archetypeLock(team: TeamSet[], rules: FormatRules, grade: string): Archetype | undefined {
  return rules.keepArchetype && !['C', 'D'].includes(grade) ? teamArchetype(team, rules)?.archetype : undefined;
}

/** Giudizio breve sul team, coerente col voto; un problema di regole lo porta sempre a "da rivedere". */
export function verdictFor(team: TeamSet[], problems: CoachProblem[], grade: string, lang: Lang): string {
  if (team.length < 6) return t(lang, 'coach.verdict.incomplete');
  if (problems.some(p => p.category === 'rules')) return t(lang, 'coach.verdict.review');
  return t(lang, grade === 'S' || grade === 'A' ? 'coach.verdict.solid' : grade === 'B' ? 'coach.verdict.good' : 'coach.verdict.review');
}

/** Voci del diff raggruppate per tipo: ruoli, "Forte contro X, Y", "Resistente a X, Y". */
/** I tipi in elenco; in italiano con la preposizione davanti ("a Fuoco", "ad Acqua"), in inglese senza. */
function typeList(list: string[], lang: Lang): { types: string } {
  const types = list.map(type => typeName(type, lang)).join(', ');
  return { types: lang === 'it' ? `${/^[aeiouàèéìòù]/i.test(types) ? 'ad' : 'a'} ${types}` : types };
}

function groupChanges(change: Contribution, gain: boolean, lang: Lang): string[] {
  return [
    ...change.roles.map(role => roleLabel(role, lang)),
    change.covers.length ? t(lang, gain ? 'diff.strong' : 'diff.notStrong', { types: change.covers.map(type => typeName(type, lang)).join(', ') }) : '',
    change.resists.length ? t(lang, gain ? 'diff.resists' : 'diff.notResists', typeList(change.resists, lang)) : '',
  ].filter(Boolean);
}

export interface SwapSummary {
  /** Punti di voto che il team guadagna con il sostituto (negativi se ne perde). */
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
  /** Punti di voto che il team guadagna (o perde) con questo sostituto. */
  ratingGain: number;
  diff: Diff;
}

export const previewSwap = (swap: CoachSwap, preview: SwapPreview | null): CoachSwap =>
  preview && preview.index === swap.index
    ? { ...swap, replacement: preview.replacement, set: preview.set, score: preview.score, similar: preview.similar, ratingGain: preview.ratingGain, diff: preview.diff }
    : swap;

/** Punti di voto che il team guadagna mettendo `set` al posto del membro `index` (negativi se ne perde). */
export function ratingGainOf(team: TeamSet[], index: number, set: TeamSet, data: EngineData): number {
  const before = rateTeam(team, data);
  const after = rateTeam(team.map((member, i) => (i === index ? set : member)), data);
  return before && after ? after.overall - before.overall : 0;
}

/** Cosa porta il sostituto e cosa perde il team, raggruppato per tipo. */
export const describeDiff = (diff: Diff, lang: Lang = 'it') => ({
  pros: groupChanges(diff.gains, true, lang),
  cons: [
    ...groupChanges(diff.losses, false, lang),
    ...(diff.lostResists.length ? [t(lang, 'diff.nobodyResists', typeList(diff.lostResists, lang))] : []),
  ],
});

/** Un pro o un contro con i punti di voto che vale (negativi per i contro). */
export interface WeightedChange {
  text: string;
  points: number;
}

/**
 * Pro e contro di un cambio, ognuno coi punti della sua area (ruoli → Ruoli, "Forte contro" → Offesa, resistenze → Difesa)
 * divisi fra le voci di quell'area dallo stesso lato; un pro in un'area che scende vale 0 (e un contro in una che sale).
 * Ordinati dal più pesante; a parità resta l'ordine di describeDiff.
 */
export function rankedChanges(diff: Diff, areaPoints: Partial<Record<ScoredArea, number>> | undefined, lang: Lang = 'it'): { pros: WeightedChange[]; cons: WeightedChange[] } {
  const side = (change: Contribution, gain: boolean, extra: { text: string; area: ScoredArea }[] = []) => {
    const items = [
      ...change.roles.map(role => ({ text: roleLabel(role, lang), area: 'roles' as const })),
      ...(change.covers.length ? [{ text: groupChanges({ roles: [], covers: change.covers, resists: [] }, gain, lang)[0], area: 'strength' as const }] : []),
      ...(change.resists.length ? [{ text: groupChanges({ roles: [], covers: [], resists: change.resists }, gain, lang)[0], area: 'defense' as const }] : []),
      ...extra,
    ];
    const count = (area: ScoredArea) => items.filter(i => i.area === area).length;
    return items
      .map(item => {
        const total = areaPoints?.[item.area] ?? 0;
        const share = (gain ? Math.max(0, total) : Math.min(0, total)) / count(item.area);
        return { text: item.text, points: Math.round(share * 10) / 10 + 0 };
      })
      .map((item, i) => ({ item, i }))
      .sort((a, b) => Math.abs(b.item.points) - Math.abs(a.item.points) || a.i - b.i)
      .map(({ item }) => item);
  };
  return {
    pros: side(diff.gains, true),
    cons: side(diff.losses, false, diff.lostResists.length ? [{ text: t(lang, 'diff.nobodyResists', typeList(diff.lostResists, lang)), area: 'defense' }] : []),
  };
}

export function describeSwap(swap: CoachSwap, lang: Lang = 'it'): SwapSummary {
  return { gain: swap.ratingGain, ...describeDiff(swap.diff, lang) };
}

export function coachTeam(team: TeamSet[], format: Format, data: EngineData, lang: Lang = 'it'): Coaching {
  if (team.length < 2) {
    return { verdict: t(lang, 'coach.addTwo'), teamType: null, strengths: [], problems: [], swaps: [], threatFixes: {} };
  }
  // Le regole del formato vengono dai dati: allineati al formato scelto
  if (data.formatId !== format.formatId) data = { ...data, formatId: format.formatId };
  const analysis = analyzeTeam(team, data);
  const candidates = data.stats ? scoreCandidates(team, format, data) : [];
  const problems = findProblems(team, format, analysis, candidates, lang);
  return {
    verdict: verdictFor(team, problems, rateTeam(team, data, lang)?.grade ?? 'D', lang),
    teamType: teamArchetype(team, analysis.needs.rules),
    strengths: findStrengths(team, analysis, lang),
    problems,
    swaps: data.stats ? findSwaps(team, format, data) : [],
    bannedCount: data.stats ? bannedInPool(team, format, data) : 0,
    threatFixes: Object.fromEntries(analysis.threats
      .filter(t => t.handledBy.length === 0)
      .map(t => [t.name, fixesFor(candidates, s => Number(s.facts.threats.checked.includes(t.name)))])),
  };
}
