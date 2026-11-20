import { contradictorySet } from './coherence';
import { commonChoices } from './common';
import type { EngineData } from './data';
import { battleSpecies, getSpecies, toID } from './dex';
import { isLearnable, legalAbilities, legalMoves } from './learnsets';
import { rateTeam } from './rating';
import { presetsForSet, type TeamSet } from './sets';
import type { GameId } from './games';

/** Modifiche al massimo per membro: il set resta riconoscibile. */
export const MAX_TUNES = 2;
/** Mosse più usate provate in ogni slot (le prime per quota). */
export const TUNE_MOVES = 8;
/** Quota d'uso oltre la quale una mossa è quasi obbligatoria (Surging Strikes su Urshifu-Rapid-Strike): resta sempre nel set. */
export const CORE_MOVE_SHARE = 0.95;

export const family = (move: string) => (toID(move).startsWith('hiddenpower') ? 'hiddenpower' : toID(move));

/**
 * Le mosse quasi obbligatorie del Pokémon (quota d'uso almeno CORE_MOVE_SHARE), solo se legali (tranne con Custom Skillset).
 * `game` solo da chi propone i set nel gioco: il Coaching (moveFixes) non lo passa, così resta uguale con e senza gioco.
 */
export function coreMoves(set: TeamSet, data: EngineData, genLimit: number, game: GameId | null = null): string[] {
  if (!data.stats) return [];
  const legal = set.customSkillset ? null : legalMoves(set.species, genLimit, game);
  return commonChoices(data, set).moves
    .filter(c => (c.share ?? 0) >= CORE_MOVE_SHARE && (!legal || isLearnable(legal, c.name)))
    .map(c => c.name);
}

/** Il set con le mosse quasi obbligatorie che gli mancano, ognuna al posto della mossa meno usata (o in uno slot vuoto). */
export function withCoreMoves(set: TeamSet, data: EngineData, genLimit = 9): TeamSet {
  const core = coreMoves(set, data, genLimit, data.game ?? null);
  const missing = core.filter(move => !set.moves.some(m => family(m) === family(move)));
  if (!missing.length) return set;
  const share = new Map(commonChoices(data, set).moves.map(c => [family(c.name), c.share ?? 0]));
  const moves = [...set.moves];
  for (const move of missing) {
    const empty = moves.findIndex(m => !m);
    if (empty >= 0 || moves.length < 4) {
      if (empty >= 0) moves[empty] = move; else moves.push(move);
      continue;
    }
    // La mossa meno usata fra quelle non obbligatorie lascia il posto
    const free = moves.map((m, i) => ({ i, share: share.get(family(m)) ?? 0, core: core.some(c => family(c) === family(m)) })).filter(x => !x.core);
    if (!free.length) break;
    moves[free.reduce((a, b) => (b.share < a.share ? b : a)).i] = move;
  }
  return { ...set, moves };
}

/**
 * Il set di team[index] ritoccato: fino a MAX_TUNES sostituzioni di una mossa con una delle più usate del Pokémon,
 * o dell'abilità con una delle più usate, scegliendo ogni volta quella che alza di più il voto del team.
 * Solo mosse e abilità legali (tranne con Custom Skillset); senza statistiche il set resta com'è.
 */
export function tuneSet(team: TeamSet[], index: number, data: EngineData, genLimit = 9): TeamSet {
  let current = team[index];
  if (!data.stats) return current;
  const common = commonChoices(data, current);
  const custom = !!current.customSkillset;
  const legal = custom ? null : legalMoves(current.species, genLimit, data.game ?? null);
  const moves = common.moves.map(c => c.name).filter(move => !legal || isLearnable(legal, move)).slice(0, TUNE_MOVES);
  // Con la megapietra l'abilità è quella della Mega: non si tocca
  const forme = battleSpecies(current);
  const locked = !!forme && forme.name !== getSpecies(current.species)?.name;
  const allowed = custom ? null : legalAbilities(current.species, genLimit);
  const abilities = locked ? [] : common.abilities.map(c => c.name).filter(name => !allowed || allowed.includes(name));
  const grade = (set: TeamSet) => rateTeam(team.map((s, j) => (j === index ? set : s)), data, 'en')?.overall ?? -Infinity;
  // Le mosse quasi obbligatorie non si toccano, anche se il voto preferirebbe altro (Surging Strikes col sole del team)
  const core = coreMoves(current, data, genLimit, data.game ?? null).map(family);
  let score = grade(current);
  for (let step = 0; step < MAX_TUNES; step++) {
    let best: TeamSet | null = null;
    let bestScore = score;
    const consider = (set: TeamSet) => {
      const value = grade(set);
      if (value > bestScore) { best = set; bestScore = value; }
    };
    const slots = Math.max(current.moves.length, Math.min(4, current.moves.filter(Boolean).length + 1));
    for (const move of moves) {
      if (current.moves.some(m => family(m) === family(move))) continue;
      for (let slot = 0; slot < Math.min(4, slots); slot++) {
        if (current.moves[slot] && core.includes(family(current.moves[slot]))) continue;
        const next = [...current.moves];
        next[slot] = move;
        consider({ ...current, moves: next });
      }
    }
    for (const ability of abilities) if (ability !== current.ability) consider({ ...current, ability });
    if (!best) break;
    current = best;
    score = bestScore;
  }
  return current;
}

/** Il set del preset al posto del membro: specie, preferito, Custom Skillset e IV (i preset non li hanno) restano quelli del membro. */
export function presetSet(member: TeamSet, preset: TeamSet): TeamSet {
  return { ...preset, species: member.species, favorite: member.favorite, customSkillset: member.customSkillset,
    ...(member.ivs ? { ivs: member.ivs } : {}) };
}

export interface BestPreset {
  /** Posizione del preset nella lista di presetsForSet (null se il membro non ne ha). */
  index: number | null;
  set: TeamSet;
  /** Voto del team con quel preset. */
  overall: number;
}

/** Il preset con il voto del team più alto per il membro `index`; a pari voto vince il primo in ordine. */
/** Solo la scelta tra i preset (senza ritocco), resi legali fino a `genLimit`. */
/** Con `accept`, i preset scartati non si considerano (il migliore fra i rimasti è "il successivo"). */
function pickPreset(team: TeamSet[], index: number, data: EngineData, genLimit: number, accept: (set: TeamSet) => boolean = () => true): BestPreset {
  const member = team[index];
  let best: BestPreset = { index: null, set: member, overall: -Infinity };
  presetsForSet(data, member, genLimit).forEach((preset, i) => {
    const set = presetSet(member, preset.set);
    if (!accept(set)) return;
    const overall = rateTeam(team.map((s, j) => (j === index ? set : s)), data, 'en')?.overall ?? -Infinity;
    if (overall > best.overall) best = { index: i, set, overall };
  });
  return best;
}

/** Solo quale preset dà al team il voto più alto (posizione in presetsForSet), senza completarlo né ritoccarlo: null se non ce ne sono. */
export function bestPresetIndex(team: TeamSet[], index: number, data: EngineData, genLimit = 9): number | null {
  return pickPreset(team, index, data, genLimit).index;
}

/** Il preset col voto del team più alto, poi ritoccato tra le mosse e le abilità più usate. */
export function bestPreset(team: TeamSet[], index: number, data: EngineData, genLimit = 9): BestPreset {
  const picked = pickPreset(team, index, data, genLimit);
  if (picked.index === null) return picked;
  // Il preset scelto con le mosse quasi obbligatorie che gli mancano
  const complete = withCoreMoves(picked.set, data, genLimit);
  const best = complete === picked.set ? picked
    : { ...picked, set: complete, overall: rateTeam(team.map((s, j) => (j === index ? complete : s)), data, 'en')?.overall ?? picked.overall };
  // Poi il ritocco tra le mosse e le abilità più usate
  const tuned = tuneSet(team.map((s, j) => (j === index ? best.set : s)), index, data, genLimit);
  if (tuned === best.set) return best;
  return { ...best, set: tuned, overall: rateTeam(team.map((s, j) => (j === index ? tuned : s)), data, 'en')?.overall ?? best.overall };
}

/**
 * Come bestPreset, ma senza set contraddittori (Choice con mosse di stato, Gilet d'assalto con mosse di stato):
 * i preset contraddittori si saltano e si prova il successivo; se il completamento o il ritocco rendono il set
 * contraddittorio, si tiene il passo prima. Se nessun preset va bene, il membro resta com'è.
 */
export function bestCoherentPreset(team: TeamSet[], index: number, data: EngineData, genLimit = 9): TeamSet {
  const fine = (set: TeamSet) => !contradictorySet(set);
  const picked = pickPreset(team, index, data, genLimit, fine);
  if (picked.index === null) return team[index];
  const completed = withCoreMoves(picked.set, data, genLimit);
  const complete = fine(completed) ? completed : picked.set;
  const tuned = tuneSet(team.map((s, j) => (j === index ? complete : s)), index, data, genLimit);
  return fine(tuned) ? tuned : complete;
}

/**
 * Il preset migliore per ogni membro, uno dopo l'altro: ogni scelta tiene conto di quelle già fatte.
 * Un secondo giro corregge le scelte dei primi membri alla luce degli ultimi (si ferma se non cambia nulla).
 */
export function bestPresets(team: TeamSet[], data: EngineData, genLimit = 9): TeamSet[] {
  let current = team;
  for (let round = 0; round < 2; round++) {
    let changed = false;
    current.forEach((_, i) => {
      const best = pickPreset(current, i, data, genLimit);
      if (best.index !== null && best.set !== current[i]) {
        const before = JSON.stringify(current[i]);
        current = current.map((s, j) => (j === i ? best.set : s));
        if (JSON.stringify(best.set) !== before) changed = true;
      }
    });
    if (!changed) break;
  }
  // Un solo ritocco per membro, alla fine, con i preset degli altri già scelti
  current.forEach((_, i) => {
    if (!presetsForSet(data, current[i]).length) return;
    const tuned = tuneSet(current, i, data, genLimit);
    if (tuned !== current[i]) current = current.map((s, j) => (j === i ? tuned : s));
  });
  return current;
}

/** Un membro in Migliora i set: il set di adesso, quello proposto e quanto sale il voto del team cambiando solo lui. */
export interface SetChange {
  before: TeamSet;
  after: TeamSet;
  /** Il set proposto è diverso da quello di adesso. */
  changed: boolean;
  /** Voto del team con solo questo cambio, meno il voto di adesso (0 se non cambia o senza voto). */
  gain: number;
}

const sameSet = (a: TeamSet, b: TeamSet) => JSON.stringify(a) === JSON.stringify(b);

/** Le mosse di `after` nell'ordine di `before`: chi resta tiene il suo posto, le nuove prendono i posti liberati. */
export function alignMoves(before: string[], after: string[]): string[] {
  const left = after.filter(Boolean);
  const out: string[] = before.map(move => {
    const i = move ? left.findIndex(m => family(m) === family(move)) : -1;
    return i >= 0 ? left.splice(i, 1)[0] : '';
  });
  for (let i = 0; i < out.length && left.length; i++) if (!out[i]) out[i] = left.shift()!;
  return [...out, ...left].filter(Boolean);
}

/**
 * Migliora i set: i set proposti per tutto il team (bestPresets) e, per ogni membro, il suo cambio da solo.
 * I guadagni dei singoli possono non sommarsi al totale: i set lavorano insieme.
 */
export function improveSets(team: TeamSet[], data: EngineData, genLimit = 9): SetChange[] {
  const after = bestPresets(team, data, genLimit);
  const base = rateTeam(team, data, 'en')?.overall ?? null;
  return team.map((before, i) => {
    const proposed = after[i] ?? before;
    const next = { ...proposed, moves: alignMoves(before.moves, proposed.moves) };
    const changed = !sameSet(before, next);
    const overall = changed && base !== null ? rateTeam(team.map((s, j) => (j === i ? next : s)), data, 'en')?.overall ?? base : base;
    return { before, after: next, changed, gain: overall === null || base === null ? 0 : overall - base };
  });
}
