import { battleSpecies, dex } from './dex';
import { STAT_IDS, type StatID, type TeamSet } from './sets';

/** Tetto degli EV totali di un set. */
export const EV_TOTAL = 510;

export interface StatLine {
  stat: StatID;
  base: number;
  ev: number;
  /** Valore finale al livello scelto, con IV e natura. */
  value: number;
  nature: 'up' | 'down' | null;
}

/** IV della statistica: 31 se il set non dice altro. */
export const ivOf = (set: Pick<TeamSet, 'ivs'>, stat: StatID) => set.ivs?.[stat] ?? 31;

/** Statistiche finali del set nella forma in battaglia (la Mega con la sua pietra), al livello indicato. */
export function statLines(set: Pick<TeamSet, 'species' | 'item' | 'nature' | 'evs' | 'ivs'>, level = 100): StatLine[] {
  const base = battleSpecies(set)?.baseStats;
  const nature = dex.natures.get(set.nature);
  return STAT_IDS.map(stat => {
    const b = base?.[stat] ?? 0;
    const ev = set.evs[stat] ?? 0;
    const core = Math.floor((2 * b + ivOf(set, stat) + Math.floor(ev / 4)) * level / 100);
    const mood = nature.plus === stat && nature.minus !== stat ? 'up' : nature.minus === stat && nature.plus !== stat ? 'down' : null;
    const value = stat === 'hp'
      ? (b === 1 ? 1 : core + level + 10)
      : Math.floor((core + 5) * (mood === 'up' ? 1.1 : mood === 'down' ? 0.9 : 1));
    return { stat, base: b, ev, value, nature: stat === 'hp' ? null : mood };
  });
}

export const evTotal = (evs: TeamSet['evs']) => STAT_IDS.reduce((sum, stat) => sum + (evs[stat] ?? 0), 0);
