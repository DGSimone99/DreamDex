import type { Lang } from '../i18n';
import { analyzeTeam } from './analysis';
import type { Archetype } from './archetype';
import { findProblems, type CoachProblem } from './coach';
import type { EngineData } from './data';
import { battleName, battleSpecies } from './dex';
import type { Format } from './format';
import { improveReplacements, type Replacement } from './replace';
import { suggest, type Suggestion } from './scoring';
import type { TeamSet } from './sets';
import { dataKey, idOf, rankByTeamGain, SWAPS_PER_MEMBER, withCandidate, type SwapReport, type TeamGain } from './teamGain';

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
  /** Chiavi dei problemi che restano ma più piccoli (meno tipi scoperti, da grave a minore…). */
  reduces: string[];
}

/**
 * Classifiche di Migliora team già calcolate: le usano il Coaching e la scheda Pokémon (vista per membro e Aggiungi,
 * senza filtri), così un team si valuta una volta sola. Chiave: team e dati (per identità), formato, lingua, tipo di team,
 * membro (o aggiunta) e quanti candidati. Oltre il limite si svuota.
 */
const rankings = new Map<string, { items: unknown[]; excluded: number }>();
const RANKING_LIMIT = 50;
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
 * Come cambiano i problemi del team con un cambio: risolto = la chiave sparisce; ridotto = resta ma più piccola,
 * o da grave diventa minore. Calcola i problemi di partenza una volta e li confronta con ogni team "dopo".
 */
export function problemChanges(team: TeamSet[], format: Format, data: EngineData, problems: CoachProblem[], lang: Lang) {
  const now = new Map<string, CoachProblem>();
  for (const p of problems) if (!now.has(p.key)) now.set(p.key, p);
  return (after: TeamSet[]) => {
    const left = new Map<string, CoachProblem>();
    for (const p of findProblems(after, format, analyzeTeam(after, data), [], lang)) if (!left.has(p.key)) left.set(p.key, p);
    const solves: string[] = [];
    const reduces: string[] = [];
    for (const [key, was] of now) {
      const is = left.get(key);
      if (!is) solves.push(key);
      else if ((was.severity === 'serious' && is.severity === 'minor') || (was.size !== undefined && is.size !== undefined && is.size < was.size)) reduces.push(key);
    }
    return { solves, reduces };
  };
}

/**
 * I cambi che alzano il voto, presi dalla classifica di Migliora team: per membro (stesso set e stesso +N della
 * vista per membro) e, con 2–5 membri, le aggiunte. Per ognuno i problemi che spariscono o si riducono nel team col cambio.
 */
export function coachFixes(team: TeamSet[], format: Format, data: EngineData, problems: CoachProblem[], lang: Lang): CoachFix[] {
  if (!data.stats || team.length < 2) return [];
  // Tipo di team Qualunque, come l'impostazione predefinita del pannello: il voto vero del team
  const archetype: Archetype | undefined = undefined;
  const base = (set: TeamSet) => battleSpecies(set)?.baseSpecies ?? set.species;
  const forme = (set: TeamSet) => battleSpecies(set)?.name ?? set.species;
  const changes = problemChanges(team, format, data, problems, lang);

  const fixes: CoachFix[] = [];
  team.forEach((member, index) => {
    // I preferiti non si propongono come membri da sostituire; niente doppioni (stesse regole di bestSwaps)
    if (member.favorite) return;
    const others = new Set(team.filter((_, i) => i !== index).map(base));
    const ranked = rankedReplacements(team, index, format, data, SWAPS_PER_MEMBER, lang, archetype)
      .filter(c => !others.has(base(c.set)) && forme(c.set) !== forme(member));
    for (const c of strongest(ranked, FIXES_PER_MEMBER)) {
      fixes.push({ kind: 'swap', species: c.species, set: c.set, index, member: battleName(member), gain: c.teamGain!.gain, ...changes(withCandidate(team, c.set, index)) });
    }
  });
  if (team.length < 6) {
    for (const c of strongest(rankedAdditions(team, format, data, ADD_POOL, lang), MAX_ADDS)) {
      fixes.push({ kind: 'add', species: c.species, set: c.set, index: null, member: null, gain: c.teamGain!.gain, ...changes(withCandidate(team, c.set, null)) });
    }
  }
  return fixes.sort((a, b) => b.gain - a.gain);
}

/** I cambi che risolvono o riducono un problema: prima chi lo risolve, poi dal voto più alto, ogni specie una volta. */
export function fixesForProblem(fixes: CoachFix[], key: string, limit = 3): CoachFix[] {
  const seen = new Set<string>();
  const solves = (fix: CoachFix) => Number(fix.solves.includes(key));
  return fixes
    .filter(fix => fix.solves.includes(key) || fix.reduces.includes(key))
    .sort((a, b) => solves(b) - solves(a) || b.gain - a.gain)
    .filter(fix => !seen.has(fix.species) && !!seen.add(fix.species))
    .slice(0, limit);
}
