import type { Lang } from '../i18n';
import { fitsArchetype, fitsTeamType, teamArchetype, type Archetype } from './archetype';
import { isPassive } from './roles';
import type { EngineData } from './data';
import { battleSpecies } from './dex';
import { rulesOf } from './formatRules';
import { rateTeam, type TeamRating } from './rating';
import type { TeamSet } from './sets';
import { lostResistances, type LostRole } from './swapGuard';
import type { TypeName } from './types';

/** Voto del team col candidato e quanto cambia rispetto a ora. */
export interface TeamGain {
  grade: string;
  overall: number;
  gain: number;
  /** Con un archetipo scelto: voci essenziali o importanti che il cambio fa perdere al team. */
  lost?: LostRole[];
  /** Quanto il cambio scende in classifica per le voci perse (solo l'ordine, non il voto). */
  penalty?: number;
  /** Tipi a cui nessuno resiste più dopo il cambio. */
  lostResists?: TypeName[];
  /** Con un tipo scelto e un team di 6 non ancora di quel tipo: il cambio lo porta a quel tipo. */
  reaches?: boolean;
  /** Punti di voto per area: variazione dell'area per il suo peso nel voto (servono a pesare pro e contro). */
  areaPoints?: Partial<Record<ScoredArea, number>>;
}

export type ScoredArea = 'defense' | 'strength' | 'roles' | 'speed';
const SCORED_AREAS: ScoredArea[] = ['defense', 'strength', 'roles', 'speed'];

/** Quanto cambiano insieme penalità e bonus (problemi risolti o nuovi, meteo, Tera): la parte del voto che le aree non spiegano. */
export const extrasDelta = (before: TeamRating, after: TeamRating): number =>
  (after.bonus.total - after.penalty.total) - (before.bonus.total - before.penalty.total);

/** Le aree che calano col cambio, dalla più grande; le aree che non contano o senza valore non si contano. */
export function areaDrops(before: TeamRating, after: TeamRating): { key: string; label: string; change: number }[] {
  return after.areas
    .flatMap(area => {
      const prev = before.areas.find(a => a.key === area.key);
      if (area.value === null || prev?.value == null || area.inactive || prev.inactive) return [];
      const change = area.value - prev.value;
      return change < 0 ? [{ key: area.key, label: area.label, change }] : [];
    })
    .sort((a, b) => a.change - b.change);
}

/** Variazione di ogni area per il suo peso nel voto (i pesi sommano a 1), arrotondata a un decimale; i Ruoli coi loro punti. */
export function areaPointsOf(before: TeamRating, after: TeamRating): Partial<Record<ScoredArea, number>> {
  const value = (rating: TeamRating, key: ScoredArea) => rating.areas.find(a => a.key === key)?.value ?? null;
  const points: Partial<Record<ScoredArea, number>> = {};
  for (const key of SCORED_AREAS) {
    const was = value(before, key);
    const now = value(after, key);
    if (was === null || now === null) continue;
    points[key] = Math.round((now - was) * (after.weights[key] ?? 0) * 10) / 10;
  }
  // I Ruoli non sono più un'area del voto: i loro punti sono i malus e i bonus dei ruoli (mancanze e minori coperti)
  const rolesNet = (rating: TeamRating) =>
    rating.roles.bonuses.reduce((a, i) => a + i.points, 0) - rating.roles.failures.reduce((a, i) => a + i.points, 0);
  points.roles = rolesNet(after) - rolesNet(before);
  return points;
}

/**
 * Il voto vero di un cambio. Col tipo scelto `'excluded'` se il team col cambio non è di quel tipo
 * (a team incompleto: se il candidato non aiuta a costruirlo); `null` se non c'è un voto (dati mancanti).
 */
function swapEvaluator(team: TeamSet[], data: EngineData, lang: Lang, archetype: Archetype | undefined) {
  // Il voto è sempre quello vero del team (lo stesso della card del voto): il tipo scelto decide solo chi compare
  const before = rateTeam(team, data, lang);
  const rules = rulesOf(data);
  const already = !!archetype && team.length === 6 && teamArchetype(team, rules)?.archetype === archetype;
  /**
   * Col tipo scelto compare solo chi rende il team di quel tipo; a team incompleto, chi aiuta a costruirlo.
   * Nel team già di quel tipo anche chi entra deve esserne adatto: nello stall un muro, nel semi-stall un muro
   * al posto di un muro, negli offense un attaccante adatto (Kyurem al posto di Blissey lascerebbe lo stall solo sulla carta).
   */
  const fits = (after: TeamSet[], candidate: TeamSet | undefined, original: TeamSet | null): boolean => {
    if (!archetype) return true;
    if (after.length < 6) return !candidate || fitsTeamType(candidate, archetype, rules);
    if (teamArchetype(after, rules)?.archetype !== archetype) return false;
    if (!already || !candidate) return true;
    if (archetype === 'stall') return fitsArchetype(candidate, 'stall', rules);
    if (archetype === 'semiStall') return !original || !isPassive(original, rules) || isPassive(candidate, rules);
    if (archetype === 'hyperOffense' || archetype === 'bulkyOffense') return fitsArchetype(candidate, archetype, rules);
    return true;
  };
  const evaluate = (after: TeamSet[], candidate?: TeamSet, original: TeamSet | null = null): { rating: TeamRating; gain: TeamGain } | 'excluded' | null => {
    if (!before) return null;
    if (!fits(after, candidate, original)) return 'excluded';
    const rating = rateTeam(after, data, lang);
    if (!rating) return null;
    return {
      rating,
      gain: {
        grade: rating.grade, overall: rating.overall, gain: rating.overall - before.overall,
        lostResists: lostResistances(team, after),
        areaPoints: areaPointsOf(before, rating),
      },
    };
  };
  return { before, evaluate };
}

const ids = new WeakMap<object, number>();
let lastId = 0;
/** Un numero per ogni oggetto (per identità): serve alle chiavi delle cache. */
export const idOf = (value: object | null | undefined) => {
  if (!value) return 0;
  let id = ids.get(value);
  if (id === undefined) ids.set(value, (id = ++lastId));
  return id;
};
/** Chiave dei dati per le cache: cambiano identità a ogni copia ({ ...data, formatId }), quindi contano le parti. */
export const dataKey = (data: EngineData) => [data.stats, data.sets, data.fallback, data.presets, data.fallbackPresets, data.fallbackStats, data.userLists]
  .map(idOf).join(',') + `|${data.formatId ?? ''}|${!!data.ignoreMeta}`;

/**
 * Voti dei singoli candidati già calcolati: il Coaching valuta i primi 15 sostituti di un membro, la vista per membro
 * i primi 100; così la seconda valuta solo quelli in più. Chiave: team (per identità), membro, dati, lingua, tipo di
 * team, ordine e il set del candidato. Oltre il limite si svuota.
 */
const evaluations = new Map<string, TeamGain | 'excluded' | null>();
const EVALUATION_LIMIT = 5000;
let evaluationMisses = 0;
/** Quante valutazioni si sono calcolate davvero (per i test della cache). */
export const teamGainMisses = () => evaluationMisses;

/** Conta i cambi esclusi dal tipo di team scelto (per dire all'utente perché la lista è vuota). */
export interface SwapReport {
  excluded: number;
}

/** Chiave dell'ordine: il voto dopo il cambio, meno la penalità per le voci perse. */
export const rankKey = (gain: TeamGain | undefined) => (gain ? gain.overall - (gain.penalty ?? 0) : -1);

/** Ordine fra due cambi: prima chi porta il team al tipo scelto, poi la chiave d'ordine più alta. */
export const compareGains = (a: TeamGain | undefined, b: TeamGain | undefined): number =>
  Number(!!b?.reaches) - Number(!!a?.reaches) || rankKey(b) - rankKey(a);

/** Il team col candidato: aggiunto in fondo, o al posto del membro `replaceIndex`. */
export function withCandidate(team: TeamSet[], set: TeamSet, replaceIndex: number | null): TeamSet[] {
  return replaceIndex === null ? [...team, set] : team.map((member, i) => (i === replaceIndex ? set : member));
}

/**
 * Candidati con il voto che darebbero al team. Senza nessun altro membro da valutare (primo Pokémon,
 * o sostituzione dell'unico membro) non c'è un voto da confrontare: restano come sono, senza `teamGain`.
 * `sort`: dal voto più alto (a parità, dal punteggio più alto); senza, si mantiene l'ordine (Sostituto simile).
 */
export function rankByTeamGain<T extends { set: TeamSet; score: number }>(
  items: T[], team: TeamSet[], replaceIndex: number | null, data: EngineData, lang: Lang, sort = true, archetype?: Archetype, report?: SwapReport,
): (T & { teamGain?: TeamGain })[] {
  const others = replaceIndex === null ? team.length : team.length - 1;
  if (others === 0) {
    // Primo Pokémon: niente voto da confrontare, ma il tipo scelto dice comunque chi aiuta a costruire il team
    if (!archetype || replaceIndex !== null) return items;
    const rules = rulesOf(data);
    const kept = items.filter(item => fitsTeamType(item.set, archetype, rules));
    if (report) report.excluded += items.length - kept.length;
    return kept;
  }
  const { before, evaluate } = swapEvaluator(team, data, lang, archetype);
  if (!before) return items;
  const prefix = `${idOf(team)}|${replaceIndex}|${dataKey(data)}|${lang}|${archetype ?? ''}|${sort}|`;
  const gainOf = (set: TeamSet) => {
    const key = prefix + JSON.stringify(set);
    if (evaluations.has(key)) return evaluations.get(key)!;
    evaluationMisses += 1;
    const result = evaluate(withCandidate(team, set, replaceIndex), set, replaceIndex === null ? null : team[replaceIndex]);
    const value = result && result !== 'excluded' ? result.gain : result;
    if (evaluations.size >= EVALUATION_LIMIT) evaluations.clear();
    evaluations.set(key, value);
    return value;
  };
  const rated: (T & { teamGain?: TeamGain })[] = items.flatMap(item => {
    const gain = gainOf(item.set);
    // Escluso dall'archetipo scelto: non si propone; senza voto (dati mancanti) resta com'è
    if (gain === 'excluded') {
      if (report) report.excluded += 1;
      return [];
    }
    return gain ? [{ ...item, teamGain: gain }] : [item];
  });
  if (!sort) return rated;
  return rated.sort((a, b) => compareGains(a.teamGain, b.teamGain) || b.score - a.score);
}

/** Un altro membro che il candidato potrebbe sostituire, e quanto cambierebbe il voto. */
export interface SwapOption {
  index: number;
  gain: number;
}

/** Candidati per membro su cui si calcola il voto: i migliori per punteggio. */
export const SWAPS_PER_MEMBER = 15;

/**
 * Raccomandazioni libere: per ogni membro (tranne i preferiti) i migliori sostituti per punteggio, valutati col voto
 * del team. Ogni candidato compare una volta, col membro che conviene di più sostituire (`replaces`); gli altri
 * membri possibili restano in `alternatives`, dal guadagno più alto.
 * `similar`: solo sostituti di ruolo simile (somiglianza ≥ `threshold`) che alzano il voto, così il team cambia poco.
 * Niente doppioni: un candidato della stessa specie di un altro membro, o lo stesso Pokémon del membro, si salta.
 * `candidatesFor(index)`: i sostituti del membro, già ordinati (per punteggio o per somiglianza).
 */
export function bestSwaps<T extends { species: string; set: TeamSet; score: number; similarity?: number }>(
  team: TeamSet[], data: EngineData, lang: Lang, candidatesFor: (index: number) => T[],
  { similar = false, threshold = 0, archetype, report }: { similar?: boolean; threshold?: number; archetype?: Archetype; report?: SwapReport } = {},
): (T & { teamGain: TeamGain; replaces: number; alternatives: SwapOption[] })[] {
  const { before, evaluate } = swapEvaluator(team, data, lang, archetype);
  if (!before || team.length < 2) return [];
  const best = new Map<string, T & { teamGain: TeamGain; replaces: number; alternatives: SwapOption[] }>();
  const base = (set: TeamSet) => battleSpecies(set)?.baseSpecies ?? set.species;
  const forme = (set: TeamSet) => battleSpecies(set)?.name ?? set.species;
  team.forEach((member, index) => {
    if (member.favorite) return;
    const others = new Set(team.filter((_, i) => i !== index).map(base));
    const candidates = candidatesFor(index)
      .filter(c => !others.has(base(c.set)) && forme(c.set) !== forme(member))
      .filter(c => !similar || (c.similarity ?? 0) >= threshold)
      .slice(0, SWAPS_PER_MEMBER);
    for (const candidate of candidates) {
      const result = evaluate(withCandidate(team, candidate.set, index), candidate.set, member);
      if (result === 'excluded' && report) report.excluded += 1;
      if (!result || result === 'excluded') continue;
      const option = { index, gain: result.gain.gain };
      const current = best.get(candidate.species);
      // Fra gli slot possibili vince quello con la chiave d'ordine più alta (voto meno penalità)
      if (!current || compareGains(result.gain, current.teamGain) < 0) {
        const alternatives = current ? [{ index: current.replaces, gain: current.teamGain.gain }, ...current.alternatives] : [];
        best.set(candidate.species, { ...candidate, teamGain: result.gain, replaces: index, alternatives });
      } else {
        current.alternatives.push(option);
      }
    }
  });
  return [...best.values()]
    .filter(swap => !similar || swap.teamGain.gain > 0)
    .map(swap => ({ ...swap, alternatives: [...swap.alternatives].sort((a, b) => b.gain - a.gain) }))
    .sort((a, b) => compareGains(a.teamGain, b.teamGain) || b.score - a.score);
}
