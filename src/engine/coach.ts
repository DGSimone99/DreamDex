import { analyzeTeam, type TeamAnalysis } from './analysis';
import { teamArchetype, type Archetype, type TeamArchetype } from './archetype';
import type { EngineData } from './data';
import type { FormatRules } from './formatRules';
import { battleName, battleSpecies, getSpecies, isMega, isSelectable, withinGen } from './dex';
import { bannedParts, formatLabel, isLegalIn, pokedexOf } from './formats';
import type { Format } from './format';
import type { Contribution, Diff } from './replace';
import { t, type Lang } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { illegalParts } from './learnsets';
import { roleLabel } from './roles';
import { keyRoles, needLabel } from './needs';
import { LEVEL_KEYS } from './roleLevels';
import { bannedInPool, scoreCandidates, type Suggestion } from './scoring';
import { memberIssues, rateTeam, roleAndTypeRedundancies, weatherClashes } from './rating';
import { benefits, conditionLabel, viaName, enables, teamSynergies, unmetBeneficiaries, unusedEnablers } from './synergy';
import type { TeamSet } from './sets';
import { coachFixes, type CoachFix } from './coachFixes';
import { buildSteps, type CoachStep } from './coachSteps';
import { moveFixes } from './moveFixes';
import type { ScoredArea } from './teamGain';
import { teamOffense } from './offense';
import { defensiveMultiplier, superEffectiveMove, type TypeName } from './types';
import { withUsableMoves } from './lockedMoves';

export const SIMILAR_THRESHOLD = 0.6;
export const MIN_COVERAGE_WEIGHT = 0.05;
export const STRONG_COVERAGE = 15;
/**
 * Un tipo del pacchetto dell'Offesa è coperto dal livello 50: tre membri al 66%, o uno che lo manda KO e uno al 66%.
 * Sotto è un problema; scoperto (grave se il tipo pesa) se nessuno lo manda KO in due colpi (HOLE_HIT, 50%).
 */
export const COVERED_LEVEL = 50;

/** Categorie dei problemi, nell'ordine in cui si mostrano. */
export const PROBLEM_CATEGORIES = ['rules', 'defense', 'coverage', 'roles', 'conditions', 'redundancy', 'meta'] as const;
export type ProblemCategory = typeof PROBLEM_CATEGORIES[number];

export interface CoachProblem {
  severity: 'serious' | 'minor';
  category: ProblemCategory;
  text: string;
  fixes: string[];
  /** Identifica il problema fra team diversi (niente conteggi): serve a vedere se uno scambio lo risolve */
  key: string;
  /** Quanto è grande (tipi scoperti, ruoli mancanti, pressione…): più basso con la stessa chiave = ridotto. */
  size?: number;
  /**
   * Di chi o di cosa parla, come dati non tradotti: il tipo per defense:, la specie per meta:,
   * il membro (nome in battaglia) per i problemi di regole di un membro, le voci per roles:essential / roles:important.
   */
  subjects?: string[];
  /** Solo per le debolezze (defense): quanti membri sono deboli e quanti resistono, per le pillole corte "Terra 3↓ 1↑". */
  counts?: { weak: number; resist: number };
}

/** I consigli del Coaching: a parte perché lenti, si calcolano solo con la scheda Coaching aperta. */
export interface CoachAdvice {
  /** Cambi dalla classifica di Migliora team che alzano il voto (o a pari voto risolvono), coi problemi che risolvono o riducono. */
  fixes: CoachFix[];
  /** Tutte le tappe, dalla più urgente: la UI ne mostra `MAX_STEPS`. */
  steps: CoachStep[];
}

export interface Coaching {
  verdict: string;
  /** Archetipo e stili del team completo (solo descrittivo: non cambia voto né consigli). */
  teamType: TeamArchetype | null;
  strengths: string[];
  problems: CoachProblem[];
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

/** Gravità di una debolezza difensiva, dalla Sicurezza del tipo: grave a 0% (saldo −2 o peggio), minore sotto il 50%. */
export function weaknessSeverity(row: TeamAnalysis['weakness'][number]): 'serious' | 'minor' | null {
  if (row.pressure >= 2) return 'serious';
  return row.pressure > 0 ? 'minor' : null;
}

export function findProblems(team: TeamSet[], format: Format, data: EngineData, analysis: TeamAnalysis, candidates: Suggestion[], lang: Lang): CoachProblem[] {
  const serious: CoachProblem[] = [];
  const minor: CoachProblem[] = [];
  // Chiave predefinita dal testo, senza numeri: un cambio che sposta solo un conteggio non "risolve" il problema
  const add = (category: ProblemCategory, isSerious: boolean, text: string, fixes: string[], key = `${category}:${text.replace(/\d+/g, '#')}`, size?: number, subjects?: string[], counts?: CoachProblem['counts']) =>
    (isSerious ? serious : minor).push({ severity: isSerious ? 'serious' : 'minor', category, text, fixes, key, ...(size === undefined ? {} : { size }), ...(subjects ? { subjects } : {}), ...(counts ? { counts } : {}) });

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
    add('defense', isSerious, text, fixes, `defense:${row.type}`, row.pressure, [row.type], { weak: row.weak, resist: row.resist });
  }

  for (const set of team) {
    const species = getSpecies(set.species);
    if (!species) continue;
    const forme = battleSpecies(set) ?? species;
    // Problema di regole di questo membro (la chiave resta quella dal testo)
    const rule = (text: string) => add('rules', true, text, [], undefined, undefined, [battleName(set)]);
    if (!isSelectable(species) || !isLegalIn(forme, format)) rule(t(lang, 'coach.problem.illegal', { species: battleName(set), format: formatLabel(format, lang) }));
    else if (!withinGen(species, format)) rule(t(lang, 'coach.problem.gen', { species: battleName(set), gen: format.genLimit }));
    // Mosse e abilità che il Pokémon non può avere (senza Custom Skillset)
    const illegal = illegalParts(set, format.genLimit, pokedexOf(format));
    if (illegal.moves.length) {
      rule(`${battleName(set)}: ${t(lang, 'team.illegalMoves', { list: illegal.moves.map(m => gameName('move', m, lang)).join(', ') })}`);
    }
    if (illegal.ability) rule(`${battleName(set)}: ${t(lang, 'team.illegalAbility', { name: gameName('ability', illegal.ability, lang) })}`);
    // Mosse, abilità e strumenti vietati dal formato (Shed Tail, Moody, King's Rock…)
    for (const text of bannedTexts(set, format, lang)) rule(`${battleName(set)}: ${text}`);
  }

  const megas = team.filter(isMega);
  if (!format.allowMultipleMegas && megas.length > 1) {
    add('rules', true, t(lang, 'coach.problem.megas', { list: list(megas.map(battleName)) }), [], 'rules:megas');
  }

  // Si chiedono solo le voci essenziali per l'archetipo del team (uno stall non ha bisogno di attaccanti)
  const missing = analysis.needs.essentialMissing;
  if (missing.length) {
    add('roles', false, t(lang, 'coach.problem.missingRoles', { roles: list(missing.map(need => needLabel(need, lang))) }),
      fixesFor(candidates, s => missing.filter(need => keyRoles(need).some(role => s.facts.roles.filled.includes(role))).length), 'roles:essential', missing.length, [...missing]);
  }
  // Le voci importanti mancanti: una riga a parte, dopo quella degli essenziali (abbassano il voto, non sono un requisito)
  const important = analysis.needs.importantMissing;
  if (important.length) {
    add('roles', false, t(lang, 'coach.problem.missingImportantRoles', { roles: list(important.map(need => needLabel(need, lang))) }),
      fixesFor(candidates, s => important.filter(need => keyRoles(need).some(role => s.facts.roles.filled.includes(role))).length), 'roles:important', important.length, [...important]);
  }

  for (const item of memberIssues(team, lang, analysis.needs)) add('roles', false, item.text, [], `roles:member:${item.text}`);
  // Squilibrio degli attaccanti (nel voto è una mancanza essenziale dei Ruoli, solo a team finito)
  // I punti crescono col conteggio: meno doppioni, problema ridotto
  for (const item of roleAndTypeRedundancies(team, lang)) add('redundancy', false, item.text, [], undefined, item.points);
  // Conflitti e mosse indebolite si riconoscono dalla condizione, non da chi la porta
  for (const item of weatherClashes(team, lang)) add('conditions', false, item.text, [], item.key && `conditions:${item.key}`);

  for (const issue of unusedEnablers(team)) {
    add('conditions', false, t(lang, 'coach.problem.unused', { via: viaName(issue.via, lang), member: issue.member }),
      fixesFor(candidates, s => Number(benefits(s.set).some(b => b.condition === issue.condition && !['Weather Ball', 'Terrain Pulse'].includes(b.via)))),
      `conditions:unused:${issue.member}:${issue.via}`);
  }
  for (const issue of unmetBeneficiaries(team)) {
    add('conditions', false, t(lang, 'coach.problem.unmet', { member: issue.member, via: viaName(issue.via, lang), condition: conditionLabel(issue.condition, lang) }),
      fixesFor(candidates, s => Number(enables(s.set).some(e => e.condition === issue.condition))),
      `conditions:unmet:${issue.member}:${issue.via}`);
  }

  // Coverage: lo stesso pacchetto dei tipi del voto, un problema per tipo sotto il livello 50 (COVERED_LEVEL).
  // Scoperto (nessuno lo manda KO in due colpi): grave se il tipo pesa; coperto poco (nessuno lo manda KO in un colpo, pochi lo colpiscono forte): minore.
  // Rimedi: i candidati col proprio set che ha una mossa super efficace contro il tipo (un'approssimazione, senza calcolo dei danni).
  // Cosa si risolve davvero lo dicono le tappe, con problemChanges.
  const coverage = teamOffense(team.map(withUsableMoves), data).types;
  for (const row of coverage.rows) {
    if (row.level >= COVERED_LEVEL) continue;
    const type = row.label;
    const hole = coverage.holes.includes(type);
    const text = hole
      ? t(lang, 'coach.problem.uncovered', { type: typeName(type, lang) })
      : t(lang, 'coach.problem.halfCovered', { type: typeName(type, lang) });
    add('coverage', hole && analysis.typeWeights[type as TypeName] >= MIN_COVERAGE_WEIGHT, text,
      fixesFor(candidates, s => Number(superEffectiveMove(s.set, type as TypeName) !== null)), `coverage:${type}`, hole ? 2 : 1, [type]);
  }

  // Minacce del meta senza check (la lista è vuota senza meta)
  for (const threat of analysis.threats) {
    if (threat.handledBy.length) continue;
    add('meta', false, t(lang, 'coach.problem.threat', { species: threat.name }),
      fixesFor(candidates, s => Number(s.facts.threats.checked.includes(threat.name))), `meta:${threat.name}`, undefined, [threat.name]);
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
  /** L'area del voto che la voce muove. */
  area: ScoredArea;
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
        return { text: item.text, points: Math.round(share * 10) / 10 + 0, area: item.area };
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

export function coachTeam(team: TeamSet[], format: Format, data: EngineData, lang: Lang = 'it'): Coaching {
  if (team.length < 2) {
    return { verdict: t(lang, 'coach.addTwo'), teamType: null, strengths: [], problems: [], threatFixes: {} };
  }
  // Le regole del formato vengono dai dati: allineati al formato scelto
  if (data.formatId !== format.formatId) data = { ...data, formatId: format.formatId };
  const analysis = analyzeTeam(team, data);
  const candidates = data.stats ? scoreCandidates(team, format, data) : [];
  const problems = findProblems(team, format, data, analysis, candidates, lang);
  return {
    verdict: verdictFor(team, problems.filter(p => p.category !== 'meta'), rateTeam(team, data, lang)?.grade ?? 'D', lang),
    teamType: teamArchetype(team, analysis.needs.rules),
    strengths: findStrengths(team, analysis, lang),
    problems,
    bannedCount: data.stats ? bannedInPool(team, format, data) : 0,
    threatFixes: Object.fromEntries(analysis.threats
      .filter(t => t.handledBy.length === 0)
      .map(t => [t.name, fixesFor(candidates, s => Number(s.facts.threats.checked.includes(t.name)))])),
  };
}

/** I cambi della classifica di Migliora team per i problemi di coachTeam, e le tappe. */
export function coachAdvice(team: TeamSet[], format: Format, data: EngineData, problems: CoachProblem[], lang: Lang = 'it'): CoachAdvice {
  if (team.length < 2) return { fixes: [], steps: [] };
  if (data.formatId !== format.formatId) data = { ...data, formatId: format.formatId };
  const fixes = coachFixes(team, format, data, problems, lang);
  const moves = data.stats ? moveFixes(team, format, data, problems, lang) : [];
  return { fixes, steps: buildSteps(problems, fixes, moves) };
}
