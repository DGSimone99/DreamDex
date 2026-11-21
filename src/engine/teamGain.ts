import type { Lang } from '../i18n';
import { fitsArchetype, fitsTeamType, teamArchetype, type Archetype } from './archetype';
import { isPassive } from './roles';
import type { EngineData } from './data';
import { battleSpecies } from './dex';
import { isOneType, rulesOf, type FormatRules } from './formatRules';
import { rateTeam, type TeamRating } from './rating';
import { rolesTally } from './rolesArea';
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
  /**
   * Le aree che salgono col cambio, dalla più grande, come le righe del dettaglio ("Offesa +13"), e quanto cambiano
   * problemi e bonus: dicono cosa porta un candidato che migliora il voto senza una ragione da mostrare.
   */
  areaGains?: { label: string; change: number }[];
  /** Quanto cambia Bonus/Malus senza i ruoli, e quanto cambiano i punti dei Ruoli: due righe separate come nel voto. */
  extras?: number;
  roles?: number;
  /** Come cambia il voto tipo per tipo (Offesa e Difesa): le righe "Forte contro / Resiste a" restano solo se il voto è d'accordo. */
  typeShift?: TypeShift;
  /** I valori delle aree col cambio (Offesa, Difesa, Velocità, Bonus/Malus, Ruoli): il Coaching li mostra come "da → a". */
  after?: AreaSnapshot;
  /** Il bonus "Pivot sfruttato" che il cambio fa guadagnare o perdere al team (assente se non cambia). */
  pivot?: 'gained' | 'lost';
}

/**
 * I valori delle aree di un voto come li mostra l'app: Offesa, Difesa e Velocità (0–100, null senza valore), il netto di
 * Bonus/Malus senza i ruoli (come la scheda Bonus/Malus) e il conteggio dei Ruoli (coperti sul totale e i loro punti, come
 * "8/8 +2"). Per il "da → a" delle proposte del Coaching: si legge dal voto già calcolato, non costa un voto in più.
 */
export interface AreaSnapshot {
  strength: number | null;
  defense: number | null;
  speed: number | null;
  bonusMalus: number;
  roles: { covered: number; total: number; points: number };
}

export function areaSnapshot(rating: TeamRating): AreaSnapshot {
  const value = (key: ScoredArea) => rating.areas.find(a => a.key === key)?.value ?? null;
  const { covered, total, points } = rolesTally(rating.roles);
  return { strength: value('strength'), defense: value('defense'), speed: value('speed'), bonusMalus: bonusMalusNet(rating), roles: { covered, total, points } };
}

/** Variazione per tipo delle righe di Offesa e Difesa del voto, e la Difesa dopo il cambio (per "Nessuno resiste più a X"). */
export interface TypeShift {
  offense: Record<string, number>;
  defense: Record<string, number>;
  defenseAfter: Record<string, number>;
  /** Tipi che dopo il cambio nessuno regge (buco in Difesa). */
  weakAfter: string[];
}

export function typeShiftOf(before: TeamRating, after: TeamRating): TypeShift {
  const delta = (was: { key: string; level: number }[], now: { key: string; level: number }[]) =>
    Object.fromEntries(now.map(row => [row.key, row.level - (was.find(r => r.key === row.key)?.level ?? row.level)]));
  const off = (r: TeamRating) => r.offense.types.rows.map(row => ({ key: row.label, level: row.level }));
  const def = (r: TeamRating) => r.defense.coverageTypes.rows.map(row => ({ key: row.type, level: row.level }));
  return {
    offense: delta(off(before), off(after)),
    defense: delta(def(before), def(after)),
    defenseAfter: Object.fromEntries(def(after).map(row => [row.key, row.level])),
    weakAfter: after.defense.coverageTypes.weak,
  };
}

export type ScoredArea = 'defense' | 'strength' | 'roles' | 'speed';
const SCORED_AREAS: ScoredArea[] = ['defense', 'strength', 'roles', 'speed'];

/** Le voci dei ruoli fra bonus e malus del voto: hanno i loro punti nei Ruoli, non in Bonus/Malus. */
const ROLE_CATALOG = new Set(['essentialRole', 'importantRole', 'minorRole']);
const notRole = (item: { catalog?: string }) => !item.catalog || !ROLE_CATALOG.has(item.catalog);

const hasPivotBonus = (rating: TeamRating) => rating.bonus.items.some(i => i.catalog === 'pivotLink');

/** Il netto di Bonus/Malus senza i ruoli, come la scheda Bonus/Malus e la carta del voto. */
const bonusMalusNet = (rating: TeamRating) =>
  rating.bonus.items.filter(notRole).reduce((n, i) => n + i.points, 0) - rating.penalty.items.filter(notRole).reduce((n, i) => n + i.points, 0);

/** I punti dei Ruoli: le mancanze di essenziali e importanti (in doppio più i minori coperti), come la sottoscheda Ruoli. */
export const rolesNet = (rating: TeamRating) =>
  rating.roles.bonuses.reduce((a, i) => a + i.points, 0) - rating.roles.failures.reduce((a, i) => a + i.points, 0);

/**
 * Quanto cambiano bonus e malus (problemi risolti o nuovi, meteo, Tera) SENZA i ruoli: la parte del voto che le aree non
 * spiegano, come la scheda Bonus/Malus. I punti dei ruoli sono a parte (rolesDelta).
 */
export const extrasDelta = (before: TeamRating, after: TeamRating): number => bonusMalusNet(after) - bonusMalusNet(before);

/** Quanto cambiano i punti dei Ruoli col cambio. */
export const rolesDelta = (before: TeamRating, after: TeamRating): number => rolesNet(after) - rolesNet(before);

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

/** Le aree che salgono col cambio, dalla più grande (stessi conti delle righe del dettaglio). */
export function areaGains(before: TeamRating, after: TeamRating): { label: string; change: number }[] {
  return after.areas
    .flatMap(area => {
      const prev = before.areas.find(a => a.key === area.key);
      if (area.value === null || prev?.value == null || area.inactive || prev.inactive) return [];
      const change = area.value - prev.value;
      return change > 0 ? [{ label: area.label, change }] : [];
    })
    .sort((a, b) => b.change - a.change);
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
  // I Ruoli non sono più un'area del voto: i loro punti sono i malus delle mancanze (in doppio anche il bonus dei minori coperti)
  points.roles = rolesDelta(before, after);
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
        areaGains: areaGains(before, rating),
        extras: extrasDelta(before, rating),
        roles: rolesDelta(before, rating),
        typeShift: typeShiftOf(before, rating),
        after: areaSnapshot(rating),
        ...(hasPivotBonus(rating) !== hasPivotBonus(before) && { pivot: hasPivotBonus(rating) ? 'gained' as const : 'lost' as const }),
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
 * Voti dei singoli candidati già calcolati: il Coaching valuta i primi sostituti di un membro (swapsPerMember), la vista per membro
 * i primi 100; così la seconda valuta solo quelli in più. Chiave: team (per identità), membro, dati, lingua, tipo di
 * team, ordine e il set del candidato. Oltre il limite si svuota.
 */
const evaluations = new Map<string, TeamGain | 'excluded' | null>();
const EVALUATION_LIMIT = 5000;
let evaluationMisses = 0;
/** Quante valutazioni si sono calcolate davvero (per i test della cache). */
export const teamGainMisses = () => evaluationMisses;

type GainValue = TeamGain | 'excluded' | null;

/** Un voto da calcolare: il team, il membro sostituito (null: aggiunta) e il candidato; `key` è la sua chiave in cache. */
export interface GainJob {
  key: string;
  team: TeamSet[];
  replaceIndex: number | null;
  set: TeamSet;
}

/**
 * Raccolta dei voti da calcolare (per dividerli fra più calcoli in parallelo, rankingPool.ts): mentre è attiva le
 * classifiche girano senza calcolare i voti dei candidati (ne segnano solo la richiesta) e senza salvare niente in
 * cache; dopo si calcolano i voti altrove, si mettono in cache con `primeGains` e la classifica vera li trova tutti.
 */
let recording: GainJob[] | null = null;
export const isCollectingGains = () => recording !== null;
export function collectGainJobs(run: () => void): GainJob[] {
  const jobs: GainJob[] = [];
  recording = jobs;
  try {
    run();
  } finally {
    recording = null;
  }
  // Lo stesso voto chiesto due volte si calcola una volta
  return [...new Map(jobs.map(job => [job.key, job])).values()];
}

const storeGain = (key: string, value: GainValue) => {
  if (evaluations.size >= EVALUATION_LIMIT) evaluations.clear();
  evaluations.set(key, value);
};

/** I voti calcolati altrove, nella cache: la classifica che li chiede non li ricalcola. */
export function primeGains(results: [string, GainValue][]): void {
  for (const [key, value] of results) storeGain(key, value);
}

/** I voti di una lista di richieste (lo stesso calcolo della classifica), nell'ordine. */
export function computeGains(jobs: GainJob[], data: EngineData, lang: Lang, archetype: Archetype | undefined): GainValue[] {
  const evaluators = new Map<string, ReturnType<typeof swapEvaluator>>();
  return jobs.map(job => {
    // Team vuoto: il voto del Pokémon da solo (aloneGains)
    if (job.team.length === 0 && job.replaceIndex === null) return aloneGain(job.set, data, lang);
    const teamKey = JSON.stringify(job.team);
    let evaluator = evaluators.get(teamKey);
    if (!evaluator) evaluators.set(teamKey, (evaluator = swapEvaluator(job.team, data, lang, archetype)));
    const result = evaluator.evaluate(withCandidate(job.team, job.set, job.replaceIndex), job.set, job.replaceIndex === null ? null : job.team[job.replaceIndex]);
    return result && result !== 'excluded' ? result.gain : result;
  });
}

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
/** Il voto del team col solo Pokémon, come "+N" da zero (il primo Pokémon "mette" N punti). */
function aloneGain(set: TeamSet, data: EngineData, lang: Lang): TeamGain | null {
  const rating = rateTeam([set], data, lang);
  return rating ? { grade: rating.grade, overall: rating.overall, gain: rating.overall } : null;
}

/**
 * A team vuoto, il voto che ogni candidato darebbe da solo (per la scelta del primo Pokémon nel gioco). Stessa cache e
 * stessa raccolta dei voti della classifica, così si dividono fra i calcoli in parallelo; l'ordine resta quello dato.
 */
export function aloneGains<T extends { set: TeamSet }>(items: T[], data: EngineData, lang: Lang): (T & { teamGain?: TeamGain })[] {
  const prefix = `alone|${dataKey(data)}|${lang}|`;
  return items.map(item => {
    const key = prefix + JSON.stringify(item.set);
    let value: GainValue | undefined = evaluations.get(key);
    if (value === undefined && !evaluations.has(key)) {
      if (recording) {
        recording.push({ key, team: [], replaceIndex: null, set: item.set });
        return item;
      }
      evaluationMisses += 1;
      value = aloneGain(item.set, data, lang);
      storeGain(key, value);
    }
    return value && value !== 'excluded' ? { ...item, teamGain: value } : item;
  });
}

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
    if (recording) {
      recording.push({ key, team, replaceIndex, set });
      return null;
    }
    evaluationMisses += 1;
    const result = evaluate(withCandidate(team, set, replaceIndex), set, replaceIndex === null ? null : team[replaceIndex]);
    const value = result && result !== 'excluded' ? result.gain : result;
    storeGain(key, value);
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
 * In doppio se ne valutano di più: il punteggio veloce che li ordina è tarato sul singolo, e su 40 team veri di doppio
 * il migliore per voto restava fuori dai primi 15 più di una volta su tre (2026-11-21). Con 30 si perdeva molto meno
 * ma l'attesa della lista quasi raddoppiava: 20 è la via di mezzo scelta dall'utente.
 */
export const DOUBLES_SWAPS_PER_MEMBER = 20;
/** Quanti sostituti per membro si valutano col voto nel formato. */
export const swapsPerMember = (rules: FormatRules): number => (isOneType(rules) ? DOUBLES_SWAPS_PER_MEMBER : SWAPS_PER_MEMBER);

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
  // Lo stesso voto di rankByTeamGain (stessa chiave): così si può calcolare in parallelo e riusare
  const prefix = `${idOf(team)}|${dataKey(data)}|${lang}|${archetype ?? ''}|swap|`;
  const gainOf = (index: number, set: TeamSet): GainValue | undefined => {
    const key = `${prefix}${index}|${JSON.stringify(set)}`;
    if (evaluations.has(key)) return evaluations.get(key)!;
    if (recording) {
      recording.push({ key, team, replaceIndex: index, set });
      return undefined;
    }
    const result = evaluate(withCandidate(team, set, index), set, team[index]);
    const value = result && result !== 'excluded' ? result.gain : result;
    storeGain(key, value);
    return value;
  };
  team.forEach((member, index) => {
    if (member.favorite) return;
    const others = new Set(team.filter((_, i) => i !== index).map(base));
    const candidates = candidatesFor(index)
      .filter(c => !others.has(base(c.set)) && forme(c.set) !== forme(member))
      .filter(c => !similar || (c.similarity ?? 0) >= threshold)
      .slice(0, swapsPerMember(rulesOf(data)));
    for (const candidate of candidates) {
      const gain = gainOf(index, candidate.set);
      if (gain === 'excluded' && report) report.excluded += 1;
      if (!gain || gain === 'excluded') continue;
      const option = { index, gain: gain.gain };
      const current = best.get(candidate.species);
      // Fra gli slot possibili vince quello con la chiave d'ordine più alta (voto meno penalità)
      if (!current || compareGains(gain, current.teamGain) < 0) {
        const alternatives = current ? [{ index: current.replaces, gain: current.teamGain.gain }, ...current.alternatives] : [];
        best.set(candidate.species, { ...candidate, teamGain: gain, replaces: index, alternatives });
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
