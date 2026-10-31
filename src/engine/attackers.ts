import { usesMeta } from './analysis';
import type { EngineData } from './data';
import { getMove } from './dex';
import { mostCommonSet, type TeamSet } from './sets';
import { topThreats, usageOf } from './stats';

/** Quante minacce del meta misurano la Coverage difensiva meta. */
const THREATS = 40;

const damaging = (set: TeamSet) => set.moves.filter(m => (getMove(m)?.category ?? 'Status') !== 'Status').length;

const threatsCache = new Map<string, { set: TeamSet; weight: number }[]>();

/** Le minacce del meta per la Coverage difensiva: i 40 più usati con almeno una mossa d'attacco, pesati per uso. */
export function metaThreats(data: EngineData): { set: TeamSet; weight: number }[] {
  if (!usesMeta(data)) return [];
  const key = data.formatId ?? 'ou';
  const cachedThreats = threatsCache.get(key);
  if (cachedThreats) return cachedThreats;
  const sets = topThreats(data.stats, THREATS, [])
    .map(name => mostCommonSet(data.stats, name))
    .filter((set): set is TeamSet => !!set && damaging(set) > 0);
  const total = sets.reduce((acc, set) => acc + usageOf(data.stats, set.species), 0);
  const threats = sets.map(set => ({ set, weight: total ? usageOf(data.stats, set.species) / total : 1 / sets.length }));
  threatsCache.set(key, threats);
  return threats;
}
