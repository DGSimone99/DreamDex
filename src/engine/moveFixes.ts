import type { Lang } from '../i18n';
import { coreMoves, family, TUNE_MOVES } from './bestPreset';
import type { CoachProblem } from './coach';
import { problemChanges } from './coachFixes';
import { commonChoices } from './common';
import type { EngineData } from './data';
import { battleName } from './dex';
import type { Format } from './format';
import { bannedParts, pokedexOf } from './formats';
import { illegalParts } from './learnsets';
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
  /** Punti di voto in più, calcolati come il +N di Sostituisci. */
  gain: number;
  solves: string[];
  reduces: string[];
}

/** Si tengono (e si rianalizzano) solo i cambi di mossa più forti per membro. */
export const MOVE_FIXES_PER_MEMBER = 3;
/** Slot provati per ogni mossa: quelli con la mossa meno usata. */
export const MOVE_SLOTS = 2;
/** Cambi a pari voto rianalizzati al massimo per membro (ognuno costa una ricerca dei problemi). */
export const ZERO_GAIN_TRIES = 3;

type ProblemDelta = { solves: string[]; reduces: string[]; introduces: string[] };

/**
 * Quali cambi di un membro tenere, da `ranked` (dal voto più alto): chi alza il voto, e chi a pari voto risolve
 * un problema senza portarne di nuovi. Il limite vale dopo il filtro: prima chi risolve qualcosa (le tappe usano
 * solo quelli), poi dal voto più alto. I problemi si calcolano solo finché servono.
 */
export function keepMoveFixes<C extends { gain: number }>(ranked: C[], changes: (c: C) => ProblemDelta, limit: number): (C & ProblemDelta)[] {
  const kept: (C & ProblemDelta)[] = [];
  let zeroTries = 0;
  for (const c of ranked) {
    // Abbastanza cambi che risolvono, tutti con voto più alto di quelli che restano: inutile andare avanti
    if (kept.filter(k => k.solves.length).length >= limit) break;
    if (c.gain < 0) break;
    if (c.gain === 0 && zeroTries++ >= ZERO_GAIN_TRIES) break;
    const delta = changes(c);
    if (c.gain > 0 || (delta.solves.length > 0 && delta.introduces.length === 0)) kept.push({ ...c, ...delta });
  }
  return kept
    .sort((a, b) => Number(b.solves.length > 0) - Number(a.solves.length > 0) || b.gain - a.gain)
    .slice(0, limit);
}

/**
 * I cambi di una mossa che alzano il voto del team (o a pari voto risolvono un problema), per membro: le mosse più
 * usate del Pokémon (legali nel formato, tranne con Custom Skillset, e mai vietate dal formato) in uno slot vuoto o al
 * posto di una mossa non obbligatoria. Per ogni mossa si tiene lo slot migliore.
 */
export function moveFixes(team: TeamSet[], format: Format, data: EngineData, problems: CoachProblem[], lang: Lang): MoveFix[] {
  if (!data.stats || team.length < 2) return [];
  const changes = problemChanges(team, format, data, problems, lang);
  const pokedex = pokedexOf(format);
  const fixes: MoveFix[] = [];
  team.forEach((member, index) => {
    const core = coreMoves(member, data, format.genLimit).map(family);
    const choices = commonChoices(data, member).moves;
    const pool = choices.map(c => c.name);
    // Come il coach: niente mosse illegali nel formato (generazione, Pokédex) né vietate
    const probe = { ...member, moves: pool };
    const illegal = new Set(illegalParts(probe, format.genLimit, pokedex).moves);
    const banned = new Set(bannedParts(probe, format).moves);
    const moves = pool.filter(move => !illegal.has(move) && !banned.has(move)).slice(0, TUNE_MOVES);
    // Uno slot vuoto (il primo), altrimenti i due slot non obbligatori con la mossa meno usata (ogni prova costa un voto del team)
    const empty = [0, 1, 2, 3].find(i => !member.moves[i]);
    const share = (move: string) => choices.find(c => family(c.name) === family(move))?.share ?? 0;
    const slots = empty !== undefined ? [empty] : [0, 1, 2, 3]
      .filter(i => !core.includes(family(member.moves[i])))
      .sort((a, b) => share(member.moves[a]) - share(member.moves[b]) || a - b)
      .slice(0, MOVE_SLOTS);
    const candidates = moves.filter(move => !member.moves.some(m => family(m) === family(move))).flatMap(move => slots.map(slot => {
      const next = Array.from({ length: Math.max(member.moves.length, slot + 1) }, (_, k) => (k === slot ? move : member.moves[k] ?? ''));
      return { set: { ...member, moves: next }, score: 0, slot, to: move };
    }));
    if (!candidates.length) return;
    // Per ogni mossa lo slot migliore (la classifica è dal voto più alto)
    const best = new Map<string, { set: TeamSet; slot: number; to: string; gain: number }>();
    for (const c of rankByTeamGain(candidates, team, index, data, lang, true)) {
      if (c.teamGain && !best.has(c.to)) best.set(c.to, { set: c.set, slot: c.slot, to: c.to, gain: c.teamGain.gain });
    }
    for (const c of keepMoveFixes([...best.values()], c => changes(withCandidate(team, c.set, index)), MOVE_FIXES_PER_MEMBER)) {
      fixes.push({ index, member: battleName(member), slot: c.slot, from: member.moves[c.slot] ?? '', to: c.to, set: c.set, gain: c.gain,
        solves: c.solves, reduces: c.reduces });
    }
  });
  return fixes.sort((a, b) => b.gain - a.gain);
}
