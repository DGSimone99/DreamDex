import type { Lang } from '../i18n';
import type { EngineData } from './data';
import { battleSpecies } from './dex';
import { rateTeam } from './rating';
import type { TeamSet } from './sets';

/** Voto del team col candidato e quanto cambia rispetto a ora. */
export interface TeamGain {
  grade: string;
  overall: number;
  gain: number;
}

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
  items: T[], team: TeamSet[], replaceIndex: number | null, data: EngineData, lang: Lang, sort = true,
): (T & { teamGain?: TeamGain })[] {
  const others = replaceIndex === null ? team.length : team.length - 1;
  if (others === 0) return items;
  const before = rateTeam(team, data, lang);
  if (!before) return items;
  const rated: (T & { teamGain?: TeamGain })[] = items.map(item => {
    const after = rateTeam(withCandidate(team, item.set, replaceIndex), data, lang);
    return after ? { ...item, teamGain: { grade: after.grade, overall: after.overall, gain: after.overall - before.overall } } : item;
  });
  if (!sort) return rated;
  const overall = (item: { teamGain?: TeamGain }) => item.teamGain?.overall ?? -1;
  return rated.sort((a, b) => overall(b) - overall(a) || b.score - a.score);
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
  { similar = false, threshold = 0 }: { similar?: boolean; threshold?: number } = {},
): (T & { teamGain: TeamGain; replaces: number; alternatives: SwapOption[] })[] {
  const before = rateTeam(team, data, lang);
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
      const after = rateTeam(withCandidate(team, candidate.set, index), data, lang);
      if (!after) continue;
      const option = { index, gain: after.overall - before.overall };
      const current = best.get(candidate.species);
      if (!current || option.gain > current.teamGain.gain) {
        const alternatives = current ? [{ index: current.replaces, gain: current.teamGain.gain }, ...current.alternatives] : [];
        best.set(candidate.species, { ...candidate, teamGain: { grade: after.grade, overall: after.overall, gain: option.gain }, replaces: index, alternatives });
      } else {
        current.alternatives.push(option);
      }
    }
  });
  return [...best.values()]
    .filter(swap => !similar || swap.teamGain.gain > 0)
    .map(swap => ({ ...swap, alternatives: [...swap.alternatives].sort((a, b) => b.gain - a.gain) }))
    .sort((a, b) => b.teamGain.overall - a.teamGain.overall || b.score - a.score);
}
