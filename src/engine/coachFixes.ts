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
import { rulesOf } from './formatRules';
import { dataKey, idOf, isCollectingGains, rankByTeamGain, swapsPerMember, withCandidate, type AreaSnapshot, type SwapReport, type TeamGain } from './teamGain';

/** Un cambio proposto dal Coaching: sostituzione di un membro o aggiunta a un team incompleto. */
export interface CoachFix {
  kind: 'swap' | 'add';
  species: string;
  set: TeamSet;
  /** Membro sostituito (indice e nome); null per un'aggiunta. */
  index: number | null;
  member: string | null;
  /** Punti di voto in più: lo stesso numero che mostra Sostituisci. */
  gain: number;
  /** Chiavi dei problemi che il cambio risolve del tutto. */
  solves: string[];
  /** Chiavi dei problemi che restano ma più piccoli (meno tipi scoperti, da grave a minore…). */
  reduces: string[];
  /** I valori delle aree col cambio (assente senza voto): il "da → a" delle righe del Coaching. */
  after?: AreaSnapshot;
}

/**
 * Classifiche di Sostituisci già calcolate: le usano il Coaching e la scheda Pokémon (vista per membro e Aggiungi,
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
  // Mentre si raccolgono i voti da calcolare (collectGainJobs) la classifica è incompleta: non si salva
  if (!entry && isCollectingGains()) {
    const own: SwapReport = { excluded: 0 };
    return make(own);
  }
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

/** I sostituti del membro `index` col voto che darebbero al team, dal più alto (come la vista per membro di Sostituisci). */
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

/** Cambi a pari voto rianalizzati al massimo per membro (e fra le aggiunte): ognuno costa una ricerca dei problemi. */
export const ZERO_GAIN_SWAPS = 3;

/** I più forti per voto in più, solo quelli che alzano il voto. */
const strongest = <T extends { teamGain?: { gain: number } }>(items: T[], limit: number) =>
  items.filter(c => (c.teamGain?.gain ?? 0) > 0).sort((a, b) => b.teamGain!.gain - a.teamGain!.gain).slice(0, limit);

type ProblemDelta = { solves: string[]; reduces: string[]; introduces: string[] };

/**
 * Quali cambi tenere, coi problemi che risolvono o riducono: i `limit` più forti che alzano il voto e, come per le
 * mosse, quelli a pari voto (±0) che risolvono qualcosa senza portare problemi nuovi (provati al massimo `ZERO_GAIN_SWAPS`).
 */
export function keepSwaps<C extends { teamGain?: { gain: number } }>(ranked: C[], changes: (c: C) => ProblemDelta, limit: number) {
  const kept: (C & { solves: string[]; reduces: string[] })[] = [];
  const add = (c: C, { solves, reduces }: ProblemDelta) => kept.push({ ...c, solves, reduces });
  for (const c of strongest(ranked, limit)) add(c, changes(c));
  for (const c of ranked.filter(x => x.teamGain?.gain === 0).slice(0, ZERO_GAIN_SWAPS)) {
    const delta = changes(c);
    if (delta.solves.length > 0 && delta.introduces.length === 0) add(c, delta);
  }
  return kept;
}

/**
 * Come cambiano i problemi del team con un cambio: risolto = la chiave sparisce; ridotto = resta ma più piccola,
 * o da grave diventa minore; nuovo = la chiave prima non c'era. Calcola i problemi di partenza una volta e li confronta con ogni team "dopo".
 */
export function problemChanges(team: TeamSet[], format: Format, data: EngineData, problems: CoachProblem[], lang: Lang) {
  const now = new Map<string, CoachProblem>();
  for (const p of problems) if (!now.has(p.key)) now.set(p.key, p);
  return (after: TeamSet[]) => {
    const left = new Map<string, CoachProblem>();
    for (const p of findProblems(after, format, data, analyzeTeam(after, data), [], lang)) if (!left.has(p.key)) left.set(p.key, p);
    const solves: string[] = [];
    const reduces: string[] = [];
    for (const [key, was] of now) {
      const is = left.get(key);
      if (!is) solves.push(key);
      else if ((was.severity === 'serious' && is.severity === 'minor') || (was.size !== undefined && is.size !== undefined && is.size < was.size)) reduces.push(key);
    }
    const introduces = [...left.keys()].filter(key => !now.has(key));
    return { solves, reduces, introduces };
  };
}

/**
 * I cambi che alzano il voto (o a pari voto risolvono senza peggiorare), presi dalla classifica di Sostituisci: per
 * membro (stesso set e stesso +N della vista per membro) e, con 2–5 membri, le aggiunte. Per ognuno i problemi che spariscono o si riducono nel team col cambio.
 */
export function coachFixes(team: TeamSet[], format: Format, data: EngineData, problems: CoachProblem[], lang: Lang): CoachFix[] {
  if (!data.stats || team.length < 2) return [];
  // Tipo di team Qualunque, come l'impostazione predefinita del pannello: il voto vero del team
  const archetype: Archetype | undefined = undefined;
  const base = (set: TeamSet) => battleSpecies(set)?.baseSpecies ?? set.species;
  const forme = (set: TeamSet) => battleSpecies(set)?.name ?? set.species;
  const changes = problemChanges(team, format, data, problems, lang);

  // Membri con un problema di regole (specie, Mega, strumento… non legali nel formato)
  const illegal = new Set(problems.filter(p => p.category === 'rules').flatMap(p => p.subjects ?? []));
  const solvesRules = (c: { solves: string[] }) => c.solves.some(key => key.startsWith('rules:'));

  const fixes: CoachFix[] = [];
  team.forEach((member, index) => {
    // I preferiti non si propongono come membri da sostituire; niente doppioni (stesse regole di bestSwaps)
    if (member.favorite) return;
    const others = new Set(team.filter((_, i) => i !== index).map(base));
    const ranked = rankedReplacements(team, index, format, data, swapsPerMember(rulesOf(data)), lang, archetype)
      .filter(c => !others.has(base(c.set)) && forme(c.set) !== forme(member));
    const delta = (x: (typeof ranked)[number]) => changes(withCandidate(team, x.set, index));
    const kept = keepSwaps(ranked, delta, FIXES_PER_MEMBER);
    // Un membro illegale va sostituito comunque: se nessun cambio tenuto risolve le regole, il migliore che lo fa, anche a voto pari o più basso
    if (illegal.has(battleName(member)) && !kept.some(solvesRules)) {
      for (const c of ranked) {
        const d = delta(c);
        if (solvesRules(d)) { kept.push({ ...c, solves: d.solves, reduces: d.reduces }); break; }
      }
    }
    for (const c of kept) {
      fixes.push({ kind: 'swap', species: c.species, set: c.set, index, member: battleName(member), gain: c.teamGain?.gain ?? 0, solves: c.solves, reduces: c.reduces,
        ...(c.teamGain?.after && { after: c.teamGain.after }) });
    }
  });
  if (team.length < 6) {
    for (const c of keepSwaps(rankedAdditions(team, format, data, ADD_POOL, lang), x => changes(withCandidate(team, x.set, null)), MAX_ADDS)) {
      fixes.push({ kind: 'add', species: c.species, set: c.set, index: null, member: null, gain: c.teamGain!.gain, solves: c.solves, reduces: c.reduces,
        ...(c.teamGain?.after && { after: c.teamGain.after }) });
    }
  }
  return fixes.sort((a, b) => b.gain - a.gain);
}
