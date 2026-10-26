import type { Lang } from '../i18n';
import { analyzeTeam } from './analysis';
import { teamArchetype, type Archetype } from './archetype';
import { findProblems, type CoachProblem } from './coach';
import type { EngineData } from './data';
import { battleName, battleSpecies } from './dex';
import type { Format } from './format';
import { rulesOf } from './formatRules';
import { improveReplacements, type Replacement } from './replace';
import { suggest, type Suggestion } from './scoring';
import type { TeamSet } from './sets';
import { rankByTeamGain, SWAPS_PER_MEMBER, withCandidate, type SwapReport, type TeamGain } from './teamGain';

/** Un cambio proposto dal Coaching: sostituzione di un membro o aggiunta a un team incompleto. */
export interface CoachFix {
  kind: 'swap' | 'add';
  species: string;
  set: TeamSet;
  /** Membro sostituito (indice e nome); null per un'aggiunta. */
  index: number | null;
  member: string | null;
  /** Punti di voto in più: lo stesso numero che mostra Migliora team. */
  gain: number;
  /** Chiavi dei problemi che il cambio risolve del tutto. */
  solves: string[];
}

/**
 * Classifiche di Migliora team già calcolate: le usano il Coaching e la scheda Pokémon (vista per membro e Aggiungi,
 * senza filtri), così un team si valuta una volta sola. Chiave: team e dati (per identità), formato, lingua, tipo di team,
 * membro (o aggiunta) e quanti candidati. Oltre il limite si svuota.
 */
const rankings = new Map<string, { items: unknown[]; excluded: number }>();
const RANKING_LIMIT = 50;
const ids = new WeakMap<object, number>();
let lastId = 0;
const idOf = (value: object | null | undefined) => {
  if (!value) return 0;
  let id = ids.get(value);
  if (id === undefined) ids.set(value, (id = ++lastId));
  return id;
};
// I dati cambiano identità a ogni copia ({ ...data, formatId }): contano le parti
const dataKey = (data: EngineData) => [data.stats, data.sets, data.fallback, data.presets, data.fallbackPresets, data.fallbackStats, data.userLists]
  .map(idOf).join(',') + `|${data.formatId ?? ''}|${!!data.ignoreMeta}`;
let misses = 0;
/** Quante classifiche si sono calcolate davvero (per i test della cache). */
export const rankingMisses = () => misses;

function cachedRanking<T>(key: string, make: (report: SwapReport) => T[], report?: SwapReport): T[] {
  let entry = rankings.get(key);
  if (!entry) {
    misses += 1;
    const own: SwapReport = { excluded: 0 };
    entry = { items: make(own), excluded: own.excluded };
    if (rankings.size >= RANKING_LIMIT) rankings.clear();
    rankings.set(key, entry);
  }
  if (report) report.excluded += entry.excluded;
  return entry.items as T[];
}

const rankingKey = (kind: string, team: TeamSet[], format: Format, data: EngineData, lang: Lang, archetype: Archetype | undefined, pool: number) =>
  `${kind}|${idOf(team)}|${dataKey(data)}|${JSON.stringify(format)}|${lang}|${archetype ?? ''}|${pool}`;

/** I sostituti del membro `index` col voto che darebbero al team, dal più alto (come la vista per membro di Migliora team). */
export function rankedReplacements(team: TeamSet[], index: number, format: Format, data: EngineData, pool: number, lang: Lang, archetype?: Archetype, report?: SwapReport) {
  return cachedRanking<Replacement & { teamGain?: TeamGain }>(rankingKey(`swap${index}`, team, format, data, lang, archetype, pool),
    own => rankByTeamGain(improveReplacements(team, index, format, data, pool, undefined, lang, archetype), team, index, data, lang, true, archetype, own), report);
}

/** Le aggiunte col voto che darebbero al team, dal più alto (come la modalità Aggiungi). */
export function rankedAdditions(team: TeamSet[], format: Format, data: EngineData, pool: number, lang: Lang, archetype?: Archetype, report?: SwapReport) {
  return cachedRanking<Suggestion & { teamGain?: TeamGain }>(rankingKey('add', team, format, data, lang, archetype, pool),
    own => rankByTeamGain(suggest(team, format, data, pool, lang), team, null, data, lang, true, archetype, own), report);
}

/** Candidati per le aggiunte, come la modalità Aggiungi della scheda Pokémon. */
const ADD_POOL = 100;
/** Si tengono (e si rianalizzano) solo i cambi più forti: per membro sostituito… */
export const FIXES_PER_MEMBER = 5;
/** …e fra le aggiunte. */
export const MAX_ADDS = 15;

/** I più forti per voto in più, solo quelli che alzano il voto. */
const strongest = <T extends { teamGain?: { gain: number } }>(items: T[], limit: number) =>
  items.filter(c => (c.teamGain?.gain ?? 0) > 0).sort((a, b) => b.teamGain!.gain - a.teamGain!.gain).slice(0, limit);

/**
 * I cambi che alzano il voto, presi dalla classifica di Migliora team: per membro (stesso set e stesso +N della
 * vista per membro) e, con 2–5 membri, le aggiunte. Per ognuno i problemi che spariscono nel team col cambio.
 */
export function coachFixes(team: TeamSet[], format: Format, data: EngineData, problems: CoachProblem[], lang: Lang): CoachFix[] {
  if (!data.stats || team.length < 2) return [];
  // Tipo di team riconosciuto, come le impostazioni predefinite del pannello
  const archetype = team.length === 6 ? teamArchetype(team, rulesOf(data))?.archetype : undefined;
  const base = (set: TeamSet) => battleSpecies(set)?.baseSpecies ?? set.species;
  const forme = (set: TeamSet) => battleSpecies(set)?.name ?? set.species;
  const now = [...new Set(problems.map(p => p.key))];
  const solvedBy = (after: TeamSet[]) => {
    const left = new Set(findProblems(after, format, analyzeTeam(after, data), [], lang).map(p => p.key));
    return now.filter(key => !left.has(key));
  };

  const fixes: CoachFix[] = [];
  team.forEach((member, index) => {
    // I preferiti non si propongono come membri da sostituire; niente doppioni (stesse regole di bestSwaps)
    if (member.favorite) return;
    const others = new Set(team.filter((_, i) => i !== index).map(base));
    const ranked = rankedReplacements(team, index, format, data, SWAPS_PER_MEMBER, lang, archetype)
      .filter(c => !others.has(base(c.set)) && forme(c.set) !== forme(member));
    for (const c of strongest(ranked, FIXES_PER_MEMBER)) {
      fixes.push({ kind: 'swap', species: c.species, set: c.set, index, member: battleName(member), gain: c.teamGain!.gain, solves: solvedBy(withCandidate(team, c.set, index)) });
    }
  });
  if (team.length < 6) {
    for (const c of strongest(rankedAdditions(team, format, data, ADD_POOL, lang), MAX_ADDS)) {
      fixes.push({ kind: 'add', species: c.species, set: c.set, index: null, member: null, gain: c.teamGain!.gain, solves: solvedBy(withCandidate(team, c.set, null)) });
    }
  }
  return fixes.sort((a, b) => b.gain - a.gain);
}

/** "Prima di tutto": più problemi gravi risolti, poi più minori, poi voto in più; null se nessuno risolve qualcosa. */
export function firstMove(fixes: CoachFix[], problems: CoachProblem[]): CoachFix | null {
  const serious = new Set(problems.filter(p => p.severity === 'serious').map(p => p.key));
  const count = (fix: CoachFix) => {
    const grave = fix.solves.filter(key => serious.has(key)).length;
    return { grave, minor: fix.solves.length - grave };
  };
  let best: { fix: CoachFix; grave: number; minor: number } | null = null;
  for (const fix of fixes) {
    if (!fix.solves.length) continue;
    const c = { fix, ...count(fix) };
    if (!best || c.grave > best.grave || (c.grave === best.grave && (c.minor > best.minor || (c.minor === best.minor && fix.gain > best.fix.gain)))) best = c;
  }
  return best?.fix ?? null;
}

/** I cambi che risolvono un problema, dal voto più alto, ogni specie una volta. */
export function fixesForProblem(fixes: CoachFix[], key: string, limit = 3): CoachFix[] {
  const seen = new Set<string>();
  return fixes
    .filter(fix => fix.solves.includes(key))
    .sort((a, b) => b.gain - a.gain)
    .filter(fix => !seen.has(fix.species) && !!seen.add(fix.species))
    .slice(0, limit);
}
