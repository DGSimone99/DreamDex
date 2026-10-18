import { battleSpecies, dex } from './dex';
import { STAT_IDS, type StatID, type TeamSet } from './sets';

/** Tetto degli EV totali di un set. */
export const EV_TOTAL = 510;

export interface StatLine {
  stat: StatID;
  base: number;
  ev: number;
  /** Valore finale al livello 100 (IV 31), natura compresa. */
  value: number;
  nature: 'up' | 'down' | null;
}

/** Statistiche finali del set nella forma in battaglia (la Mega con la sua pietra). */
export function statLines(set: Pick<TeamSet, 'species' | 'item' | 'nature' | 'evs'>): StatLine[] {
  const base = battleSpecies(set)?.baseStats;
  const nature = dex.natures.get(set.nature);
  return STAT_IDS.map(stat => {
    const b = base?.[stat] ?? 0;
    const ev = set.evs[stat] ?? 0;
    const core = Math.floor((2 * b + 31 + Math.floor(ev / 4)) * 100 / 100);
    const mood = nature.plus === stat && nature.minus !== stat ? 'up' : nature.minus === stat && nature.plus !== stat ? 'down' : null;
    const value = stat === 'hp'
      ? (b === 1 ? 1 : core + 100 + 10)
      : Math.floor((core + 5) * (mood === 'up' ? 1.1 : mood === 'down' ? 0.9 : 1));
    return { stat, base: b, ev, value, nature: stat === 'hp' ? null : mood };
  });
}

export const evTotal = (evs: TeamSet['evs']) => STAT_IDS.reduce((sum, stat) => sum + (evs[stat] ?? 0), 0);
