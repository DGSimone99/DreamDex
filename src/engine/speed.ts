import type { EngineData } from './data';
import { battleSpecies, dex, getSpecies, isLegal, toID } from './dex';
import { memberPower } from './power';
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

/** Velocità di un Pokémon del meta col suo spread e strumento più usati (0 se non ha statistiche). */
export function metaSpeed(data: EngineData, name: string): number {
  const entry = data.stats?.pokemon[name];
  if (!entry) return 0;
  const { nature, evs } = parseSpread(top(entry.spreads));
  return speedStat({ species: name, item: dex.items.get(top(entry.items) ?? '').name ?? '', nature, evs }).value;
}

/** Velocità massima (252 EV, natura che la alza) di tutti i completamente evoluti legali: il riferimento senza meta. */
let maxSpeeds: number[] | null = null;
function referenceSpeeds(): number[] {
  maxSpeeds ??= dex.species.all()
    .filter(s => s.exists && !s.nfe && isLegal(s))
    .map(s => Math.floor((2 * s.baseStats.spe + 31 + 63 + 5) * 1.1))
    .sort((a, b) => a - b);
  return maxSpeeds;
}

/** Offesa (percentile) da cui un membro conta per la velocità del team: un Pokémon veloce che non fa danni non serve. */
export const SPEED_ATTACKER = 60;

/**
 * Velocità del team (0–1), dai suoi due attaccanti più veloci: vince chi si muove per primo e fa danno.
 * Col meta: quota delle minacce date (le più usate) che ognuno dei due supera; senza: quota di tutti i Pokémon più lenti.
 * Con meno di due attaccanti, il posto mancante vale zero.
 */
export function teamSpeed(team: TeamSet[], data: EngineData, threats: string[] | null): number {
  const fastest = team
    .filter(set => (memberPower(set)?.offense ?? 0) >= SPEED_ATTACKER)
    .map(set => speedStat(set).value)
    .sort((a, b) => b - a)
    .slice(0, 2);
  const share = threats?.length
    ? (speed: number) => { const rivals = threats.map(name => metaSpeed(data, name)); return rivals.filter(r => r < speed).length / rivals.length; }
    : (speed: number) => { const pool = referenceSpeeds(); return pool.filter(v => v < speed).length / pool.length; };
  return fastest.reduce((acc, speed) => acc + share(speed), 0) / 2;
}
