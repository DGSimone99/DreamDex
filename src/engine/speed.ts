import type { EngineData } from './data';
import { battleSpecies, dex, getSpecies, toID } from './dex';
import { parseSpread, type TeamSet } from './sets';

/** Velocità finale al livello 100 (IV 31); `scarf` se la Sciarpa Scelta la moltiplica per 1,5. */
export interface Speed {
  value: number;
  scarf: boolean;
}

/** Quanti Pokémon del meta (i più usati) si confrontano. */
export const SPEED_POOL = 40;
/** Quanti vicini mostrare sopra e sotto. */
const NEIGHBOURS = 3;

export function speedStat(set: Pick<TeamSet, 'species' | 'item' | 'nature' | 'evs'>): Speed {
  const base = battleSpecies(set)?.baseStats.spe ?? 0;
  const ev = set.evs.spe ?? 0;
  const raw = Math.floor((2 * base + 31 + Math.floor(ev / 4)) * 100 / 100) + 5;
  const nature = dex.natures.get(set.nature);
  const withNature = Math.floor(raw * (nature.plus === 'spe' ? 1.1 : nature.minus === 'spe' ? 0.9 : 1));
  const scarf = toID(set.item) === 'choicescarf';
  return { value: scarf ? Math.floor(withNature * 1.5) : withNature, scarf };
}

export interface SpeedRival extends Speed {
  species: string;
}

export interface SpeedTier {
  speed: number;
  /** Pokémon del meta confrontati (la specie stessa esclusa). */
  total: number;
  /** Quota di quei Pokémon più lenti del set. */
  outspeeds: number;
  /** I più vicini sopra (dal più vicino) e sotto (dal più vicino); a pari velocità si va in "ties". */
  faster: SpeedRival[];
  slower: SpeedRival[];
  ties: SpeedRival[];
}

const top = (shares: Record<string, number>) => Object.entries(shares).sort((a, b) => b[1] - a[1])[0]?.[0];

/** Velocità del set rispetto ai più usati del formato, ognuno col suo spread e strumento più comuni. */
export function speedTier(set: TeamSet, data: EngineData): SpeedTier | null {
  if (!data.stats) return null;
  const own = getSpecies(set.species)?.baseSpecies;
  const speed = speedStat(set).value;
  const rivals: SpeedRival[] = Object.entries(data.stats.pokemon)
    .sort((a, b) => b[1].usage - a[1].usage)
    .filter(([name]) => getSpecies(name)?.baseSpecies !== own)
    .slice(0, SPEED_POOL)
    .map(([name, entry]) => {
      const { nature, evs } = parseSpread(top(entry.spreads));
      return { species: name, ...speedStat({ species: name, item: dex.items.get(top(entry.items) ?? '').name ?? '', nature, evs }) };
    });
  if (!rivals.length) return null;
  return {
    speed,
    total: rivals.length,
    outspeeds: rivals.filter(r => r.value < speed).length / rivals.length,
    faster: rivals.filter(r => r.value > speed).sort((a, b) => a.value - b.value).slice(0, NEIGHBOURS),
    slower: rivals.filter(r => r.value < speed).sort((a, b) => b.value - a.value).slice(0, NEIGHBOURS),
    ties: rivals.filter(r => r.value === speed),
  };
}
