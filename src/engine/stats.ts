import { getSpecies, toID } from './dex';
import { TYPES, type TypeName } from './types';

export interface SpeciesStats {
  usage: number;
  count: number;
  abilities: Record<string, number>;
  items: Record<string, number>;
  moves: Record<string, number>;
  teraTypes: Record<string, number>;
  spreads: Record<string, number>;
  teammates: Record<string, number>;
  checks: Record<string, number>;
}

export interface StatsMeta {
  month: string;
  cutoff: number;
  battles: number;
}

export interface StatsData {
  meta: StatsMeta;
  pokemon: Record<string, SpeciesStats>;
}

export type CheckValue = { n: number; p: number; d: number } | [number, number, number];

interface ChaosEntry {
  usage: number;
  Abilities: Record<string, number>;
  Items: Record<string, number>;
  Moves: Record<string, number>;
  Spreads: Record<string, number>;
  Teammates: Record<string, number>;
  'Checks and Counters': Record<string, CheckValue>;
  'Tera Types'?: Record<string, number>;
}

export interface ChaosFile {
  info: { metagame: string; cutoff: number; 'number of battles': number };
  data: Record<string, ChaosEntry>;
}

const IGNORED_KEYS = new Set(['', 'nothing']);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const byValueDesc = (a: [string, number], b: [string, number]) => b[1] - a[1];

function topShares(
  record: Record<string, number> | undefined,
  total: number,
  limit: number,
  mapKey: (key: string) => string = key => key,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record ?? {})
      .filter(([key, value]) => !IGNORED_KEYS.has(key.toLowerCase()) && value > 0)
      .sort(byValueDesc)
      .slice(0, limit)
      .map(([key, value]) => [mapKey(key), value / total]),
  );
}

export function checkValueScore(value: CheckValue): number {
  const [, p, d] = Array.isArray(value) ? value : [value.n, value.p, value.d];
  return p - 4 * d;
}

/** Statistiche già ridotte di data.pkmn.cc (frazioni per nome). */
export interface PkmnStatsFile {
  battles: number;
  pokemon: Record<string, {
    usage: { weighted: number };
    count: number;
    abilities?: Record<string, number>;
    items?: Record<string, number>;
    moves?: Record<string, number>;
    teraTypes?: Record<string, number>;
    spreads?: Record<string, number>;
    teammates?: Record<string, number>;
  }>;
}

/** Quanti strumenti e spread tenere per Pokémon (per i "Più usati" e gli spread pronti dell'editor). */
const TOP_ITEMS = 8;
const TOP_SPREADS = 6;

/** Converte le statistiche di data.pkmn.cc nello stesso formato di `reduceChaos`. */
export function reducePkmnStats(file: PkmnStatsFile, minUsage = 0.001): Record<string, SpeciesStats> {
  const result: Record<string, SpeciesStats> = {};
  for (const [name, entry] of Object.entries(file.pokemon)) {
    if (entry.usage.weighted < minUsage) continue;
    result[name] = {
      usage: entry.usage.weighted,
      count: entry.count,
      abilities: topShares(entry.abilities, 1, 3),
      items: topShares(entry.items, 1, TOP_ITEMS),
      moves: topShares(entry.moves, 1, 10),
      teraTypes: topShares(entry.teraTypes, 1, 3, capitalize),
      spreads: topShares(entry.spreads, 1, TOP_SPREADS),
      teammates: topShares(entry.teammates, 1, 40),
      checks: {},
    };
  }
  return result;
}

export function reduceChaos(chaos: ChaosFile, minUsage = 0.001): Record<string, SpeciesStats> {
  const result: Record<string, SpeciesStats> = {};
  for (const [name, entry] of Object.entries(chaos.data)) {
    if (entry.usage < minUsage) continue;
    const count = Object.values(entry.Abilities ?? {}).reduce((a, b) => a + b, 0) || 1;
    const checks = Object.entries(entry['Checks and Counters'] ?? {})
      .map(([checker, value]): [string, number] => [checker, checkValueScore(value)])
      .filter(([, score]) => score > 0)
      .sort(byValueDesc)
      .slice(0, 30);
    result[name] = {
      usage: entry.usage,
      count,
      abilities: topShares(entry.Abilities, count, 3),
      items: topShares(entry.Items, count, TOP_ITEMS),
      moves: topShares(entry.Moves, count, 10),
      teraTypes: topShares(entry['Tera Types'], count, 3, capitalize),
      spreads: topShares(entry.Spreads, count, TOP_SPREADS),
      teammates: topShares(entry.Teammates, count, 40),
      checks: Object.fromEntries(checks),
    };
  }
  return result;
}

/**
 * Cerca una chiave per nome esatto o per ID: Smogon scrive "Sirfetch'd",
 * @pkmn/dex "Sirfetch’d" (apostrofo tipografico).
 */
export function findByName<T>(record: Record<string, T> | undefined, name: string): T | undefined {
  if (!record) return undefined;
  if (name in record) return record[name];
  const id = toID(name);
  const key = Object.keys(record).find(k => toID(k) === id);
  return key === undefined ? undefined : record[key];
}

export function statsEntry(stats: StatsData | null, name: string): SpeciesStats | undefined {
  return findByName(stats?.pokemon, name);
}

export function usageOf(stats: StatsData | null, name: string): number {
  return statsEntry(stats, name)?.usage ?? 0;
}

export function teammatePct(stats: StatsData | null, member: string, candidate: string): number {
  return findByName(statsEntry(stats, member)?.teammates, candidate) ?? 0;
}

export function checkScore(stats: StatsData | null, threat: string, candidate: string): number | null {
  const entry = statsEntry(stats, threat);
  if (!entry || Object.keys(entry.checks).length === 0) return null;
  return findByName(entry.checks, candidate) ?? 0;
}

function byUsage(stats: StatsData): [string, SpeciesStats][] {
  return Object.entries(stats.pokemon).sort((a, b) => b[1].usage - a[1].usage);
}

export function topThreats(stats: StatsData | null, n: number, exclude: string[]): string[] {
  if (!stats) return [];
  const excluded = new Set(exclude.map(toID));
  return byUsage(stats)
    .map(([name]) => name)
    .filter(name => !excluded.has(toID(name)) && getSpecies(name) !== null)
    .slice(0, n);
}

export function metaTypeWeights(stats: StatsData | null, topN = 50): Record<TypeName, number> {
  const weights = Object.fromEntries(TYPES.map(type => [type, 0])) as Record<TypeName, number>;
  for (const [name, entry] of stats ? byUsage(stats).slice(0, topN) : []) {
    const species = getSpecies(name);
    if (!species) continue;
    for (const type of species.types) {
      if (type in weights) weights[type as TypeName] += entry.usage;
    }
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const type of TYPES) weights[type] = total === 0 ? 1 / TYPES.length : weights[type] / total;
  return weights;
}
