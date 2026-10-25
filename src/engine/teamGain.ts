import type { Lang } from '../i18n';
import { fitsArchetype, teamArchetype, type Archetype } from './archetype';
import { isPassive } from './roles';
import type { EngineData } from './data';
import { battleSpecies } from './dex';
import { rulesOf } from './formatRules';
import { rateTeam, type TeamRating } from './rating';
import type { TeamSet } from './sets';
import { lostResistances, lostRoles, rolePenalty, type LostRole } from './swapGuard';
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
}

/**
 * Il voto di un cambio, con l'archetipo scelto se c'è (pesi e livelli di quel tipo prima e dopo).
 * `'excluded'` se il team era già di quel tipo e il cambio lo fa uscire; `null` se non c'è un voto (dati mancanti).
 * La penalità per le voci perse vale solo dove conta l'ordine per voto (`penalize`).
 */
function swapEvaluator(team: TeamSet[], data: EngineData, lang: Lang, archetype: Archetype | undefined, penalize: boolean) {
  const opts = archetype ? { archetype } : {};
  const before = rateTeam(team, data, lang, opts);
  const rules = rulesOf(data);
  const guard = !!archetype && team.length === 6 && teamArchetype(team, rules)?.archetype === archetype;
  /**
   * Nel team già del tipo scelto anche chi entra deve essere adatto a quel tipo: nello stall un muro,
   * nel semi-stall un muro al posto di un muro, negli offense un attaccante adatto; il balance non chiede niente.
   */
  const fits = (candidate: TeamSet, original: TeamSet | null): boolean => {
    if (!guard) return true;
    if (archetype === 'stall') return fitsArchetype(candidate, 'stall', rules);
    if (archetype === 'semiStall') return !original || !isPassive(original, rules) || isPassive(candidate, rules);
    if (archetype === 'hyperOffense' || archetype === 'bulkyOffense') return fitsArchetype(candidate, archetype, rules);
    return true;
  };
  const evaluate = (after: TeamSet[], candidate?: TeamSet, original?: TeamSet | null): { rating: TeamRating; gain: TeamGain } | 'excluded' | null => {
    if (!before) return null;
    if (guard && teamArchetype(after, rules)?.archetype !== archetype) return 'excluded';
    if (candidate && !fits(candidate, original ?? null)) return 'excluded';
    const rating = rateTeam(after, data, lang, opts);
    if (!rating) return null;
    const lost = archetype ? lostRoles(before.needs, rating.needs) : undefined;
    return {
      rating,
      gain: {
        grade: rating.grade, overall: rating.overall, gain: rating.overall - before.overall,
        ...(lost ? { lost, penalty: penalize ? rolePenalty(lost) : 0 } : {}),
        lostResists: lostResistances(team, after),
      },
    };
  };
  return { before, evaluate };
}

/** Conta i cambi esclusi dal tipo di team scelto (per dire all'utente perché la lista è vuota). */
export interface SwapReport {
  excluded: number;
}

/** Chiave dell'ordine: il voto dopo il cambio, meno la penalità per le voci perse. */
export const rankKey = (gain: TeamGain | undefined) => (gain ? gain.overall - (gain.penalty ?? 0) : -1);

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
  if (others === 0) return items;
  const { before, evaluate } = swapEvaluator(team, data, lang, archetype, sort);
  if (!before) return items;
  const rated: (T & { teamGain?: TeamGain })[] = items.flatMap(item => {
    const result = evaluate(withCandidate(team, item.set, replaceIndex), item.set, replaceIndex === null ? null : team[replaceIndex]);
    // Escluso dall'archetipo scelto: non si propone; senza voto (dati mancanti) resta com'è
    if (result === 'excluded') {
      if (report) report.excluded += 1;
      return [];
    }
    return result ? [{ ...item, teamGain: result.gain }] : [item];
  });
  if (!sort) return rated;
  return rated.sort((a, b) => rankKey(b.teamGain) - rankKey(a.teamGain) || b.score - a.score);
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
  const { before, evaluate } = swapEvaluator(team, data, lang, archetype, !similar);
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
      if (!current || rankKey(result.gain) > rankKey(current.teamGain)) {
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
    .sort((a, b) => rankKey(b.teamGain) - rankKey(a.teamGain) || b.score - a.score);
}
