import type { Lang } from '../i18n';
import { coreMoves, family, TUNE_MOVES } from './bestPreset';
import type { CoachProblem } from './coach';
import { problemChanges } from './coachFixes';
import { commonChoices } from './common';
import type { EngineData } from './data';
import { battleName } from './dex';
import type { Format } from './format';
import { isLearnable, legalMoves } from './learnsets';
import type { TeamSet } from './sets';
import { rankByTeamGain, withCandidate } from './teamGain';

/** Un cambio di mossa proposto dal Coaching: una mossa del set al posto di un'altra (o in uno slot vuoto). */
export interface MoveFix {
  /** Membro ritoccato: indice e nome in battaglia. */
  index: number;
  member: string;
  /** Slot cambiato (0–3), mossa tolta ('' se lo slot era vuoto) e mossa nuova. */
  slot: number;
  from: string;
  to: string;
  set: TeamSet;
  /** Punti di voto in più, calcolati come il +N di Migliora team. */
  gain: number;
  solves: string[];
  reduces: string[];
}

/** Si tengono (e si rianalizzano) solo i cambi di mossa più forti per membro. */
export const MOVE_FIXES_PER_MEMBER = 3;

/**
 * I cambi di una mossa che alzano il voto del team, per membro: le mosse più usate del Pokémon (legali, tranne con
 * Custom Skillset) in uno slot vuoto o al posto di una mossa non obbligatoria. Per ogni mossa si tiene lo slot migliore.
 */
export function moveFixes(team: TeamSet[], format: Format, data: EngineData, problems: CoachProblem[], lang: Lang): MoveFix[] {
  if (!data.stats || team.length < 2) return [];
  const changes = problemChanges(team, format, data, problems, lang);
  const fixes: MoveFix[] = [];
  team.forEach((member, index) => {
    const legal = member.customSkillset ? null : legalMoves(member.species, 9);
    const core = coreMoves(member, data, 9).map(family);
    const moves = commonChoices(data, member).moves.map(c => c.name).filter(move => !legal || isLearnable(legal, move)).slice(0, TUNE_MOVES);
    // Uno slot vuoto (il primo), altrimenti ogni slot non obbligatorio
    const empty = [0, 1, 2, 3].find(i => !member.moves[i]);
    const slots = empty !== undefined ? [empty] : [0, 1, 2, 3].filter(i => !core.includes(family(member.moves[i])));
    const candidates = moves.filter(move => !member.moves.some(m => family(m) === family(move))).flatMap(move => slots.map(slot => {
      const next = Array.from({ length: Math.max(member.moves.length, slot + 1) }, (_, k) => (k === slot ? move : member.moves[k] ?? ''));
      return { set: { ...member, moves: next }, score: 0, slot, to: move };
    }));
    if (!candidates.length) return;
    // Per ogni mossa lo slot migliore, poi le più forti che alzano il voto
    const ranked = rankByTeamGain(candidates, team, index, data, lang, true);
    const best = new Map<string, (typeof ranked)[number]>();
    for (const c of ranked) if (!best.has(c.to) && (c.teamGain?.gain ?? 0) > 0) best.set(c.to, c);
    for (const c of [...best.values()].slice(0, MOVE_FIXES_PER_MEMBER)) {
      fixes.push({ index, member: battleName(member), slot: c.slot, from: member.moves[c.slot] ?? '', to: c.to, set: c.set, gain: c.teamGain!.gain,
        ...changes(withCandidate(team, c.set, index)) });
    }
  });
  return fixes.sort((a, b) => b.gain - a.gain);
}
