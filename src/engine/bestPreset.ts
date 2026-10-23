import { commonChoices } from './common';
import type { EngineData } from './data';
import { battleSpecies, getSpecies, toID } from './dex';
import { isLearnable, legalAbilities, legalMoves } from './learnsets';
import { rateTeam } from './rating';
import { presetsForSet, type TeamSet } from './sets';

/** Modifiche al massimo per membro: il set resta riconoscibile. */
export const MAX_TUNES = 2;
/** Mosse più usate provate in ogni slot (le prime per quota). */
const TUNE_MOVES = 8;

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
  const legal = custom ? null : legalMoves(current.species, genLimit);
  const moves = common.moves.map(c => c.name).filter(move => !legal || isLearnable(legal, move)).slice(0, TUNE_MOVES);
  // Con la megapietra l'abilità è quella della Mega: non si tocca
  const forme = battleSpecies(current);
  const locked = !!forme && forme.name !== getSpecies(current.species)?.name;
  const allowed = custom ? null : legalAbilities(current.species, genLimit);
  const abilities = locked ? [] : common.abilities.map(c => c.name).filter(name => !allowed || allowed.includes(name));
  const grade = (set: TeamSet) => rateTeam(team.map((s, j) => (j === index ? set : s)), data, 'en')?.overall ?? -Infinity;
  let score = grade(current);
  for (let step = 0; step < MAX_TUNES; step++) {
    let best: TeamSet | null = null;
    let bestScore = score;
    const consider = (set: TeamSet) => {
      const value = grade(set);
      if (value > bestScore) { best = set; bestScore = value; }
    };
    const slots = Math.max(current.moves.length, Math.min(4, current.moves.filter(Boolean).length + 1));
    const family = (move: string) => (toID(move).startsWith('hiddenpower') ? 'hiddenpower' : toID(move));
    for (const move of moves) {
      if (current.moves.some(m => family(m) === family(move))) continue;
      for (let slot = 0; slot < Math.min(4, slots); slot++) {
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
function pickPreset(team: TeamSet[], index: number, data: EngineData, genLimit: number): BestPreset {
  const member = team[index];
  let best: BestPreset = { index: null, set: member, overall: -Infinity };
  presetsForSet(data, member, genLimit).forEach((preset, i) => {
    const set = presetSet(member, preset.set);
    const overall = rateTeam(team.map((s, j) => (j === index ? set : s)), data, 'en')?.overall ?? -Infinity;
    if (overall > best.overall) best = { index: i, set, overall };
  });
  return best;
}

/** Il preset col voto del team più alto, poi ritoccato tra le mosse e le abilità più usate. */
export function bestPreset(team: TeamSet[], index: number, data: EngineData, genLimit = 9): BestPreset {
  const best = pickPreset(team, index, data, genLimit);
  if (best.index === null) return best;
  // Poi il ritocco tra le mosse e le abilità più usate
  const tuned = tuneSet(team.map((s, j) => (j === index ? best.set : s)), index, data, genLimit);
  if (tuned === best.set) return best;
  return { ...best, set: tuned, overall: rateTeam(team.map((s, j) => (j === index ? tuned : s)), data, 'en')?.overall ?? best.overall };
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
