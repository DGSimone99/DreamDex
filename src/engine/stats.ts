import { getSpecies } from './dex';
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
      .filter(([key, value]) => !IGNORED_KEYS.has(key) && value > 0)
      .sort(byValueDesc)
      .slice(0, limit)
      .map(([key, value]) => [mapKey(key), value / total]),
  );
}

export function checkValueScore(value: CheckValue): number {
  const [, p, d] = Array.isArray(value) ? value : [value.n, value.p, value.d];
  return p - 4 * d;
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
      items: topShares(entry.Items, count, 5),
      moves: topShares(entry.Moves, count, 10),
      teraTypes: topShares(entry['Tera Types'], count, 3, capitalize),
      spreads: topShares(entry.Spreads, count, 3),
      teammates: topShares(entry.Teammates, count, 40),
      checks: Object.fromEntries(checks),
    };
  }
  return result;
}

export function usageOf(stats: StatsData | null, name: string): number {
  return stats?.pokemon[name]?.usage ?? 0;
}

export function teammatePct(stats: StatsData | null, member: string, candidate: string): number {
  return stats?.pokemon[member]?.teammates[candidate] ?? 0;
}

export function checkScore(stats: StatsData | null, threat: string, candidate: string): number | null {
  const entry = stats?.pokemon[threat];
  if (!entry || Object.keys(entry.checks).length === 0) return null;
  return entry.checks[candidate] ?? 0;
}

function byUsage(stats: StatsData): [string, SpeciesStats][] {
  return Object.entries(stats.pokemon).sort((a, b) => b[1].usage - a[1].usage);
}

export function topThreats(stats: StatsData | null, n: number, exclude: string[]): string[] {
  if (!stats) return [];
  return byUsage(stats)
    .map(([name]) => name)
    .filter(name => !exclude.includes(name) && getSpecies(name) !== null)
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
