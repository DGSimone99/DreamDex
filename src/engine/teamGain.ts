import type { Lang } from '../i18n';
import type { EngineData } from './data';
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
