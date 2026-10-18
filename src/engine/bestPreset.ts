import type { EngineData } from './data';
import { rateTeam } from './rating';
import { presetsForSet, type TeamSet } from './sets';

/** Il set del preset al posto del membro: specie, preferito e Custom Skillset restano quelli del membro. */
export function presetSet(member: TeamSet, preset: TeamSet): TeamSet {
  return { ...preset, species: member.species, favorite: member.favorite, customSkillset: member.customSkillset };
}

export interface BestPreset {
  /** Posizione del preset nella lista di presetsForSet (null se il membro non ne ha). */
  index: number | null;
  set: TeamSet;
  /** Voto del team con quel preset. */
  overall: number;
}

/** Il preset con il voto del team più alto per il membro `index`; a pari voto vince il primo in ordine. */
export function bestPreset(team: TeamSet[], index: number, data: EngineData): BestPreset {
  const member = team[index];
  let best: BestPreset = { index: null, set: member, overall: -Infinity };
  presetsForSet(data, member).forEach((preset, i) => {
    const set = presetSet(member, preset.set);
    const overall = rateTeam(team.map((s, j) => (j === index ? set : s)), data, 'en')?.overall ?? -Infinity;
    if (overall > best.overall) best = { index: i, set, overall };
  });
  return best;
}

/**
 * Il preset migliore per ogni membro, uno dopo l'altro: ogni scelta tiene conto di quelle già fatte.
 * Un secondo giro corregge le scelte dei primi membri alla luce degli ultimi (si ferma se non cambia nulla).
 */
export function bestPresets(team: TeamSet[], data: EngineData): TeamSet[] {
  let current = team;
  for (let round = 0; round < 2; round++) {
    let changed = false;
    current.forEach((_, i) => {
      const best = bestPreset(current, i, data);
      if (best.index !== null && best.set !== current[i]) {
        const before = JSON.stringify(current[i]);
        current = current.map((s, j) => (j === i ? best.set : s));
        if (JSON.stringify(best.set) !== before) changed = true;
      }
    });
    if (!changed) break;
  }
  return current;
}
