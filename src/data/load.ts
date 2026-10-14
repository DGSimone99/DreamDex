import type { EngineData } from '../engine/data';
import type { SetsData } from '../engine/sets';
import type { SpeciesStats, StatsData, StatsMeta } from '../engine/stats';

const files = import.meta.glob<unknown>('/data/gen9nationaldex/*.json', { import: 'default' });

async function read<T>(name: string): Promise<T | null> {
  const loader = files[`/data/gen9nationaldex/${name}.json`];
  return loader ? ((await loader()) as T) : null;
}

export async function loadData(): Promise<EngineData> {
  const [pokemon, meta, sets] = await Promise.all([
    read<Record<string, SpeciesStats>>('stats'),
    read<StatsMeta>('meta'),
    read<SetsData>('sets'),
  ]);
  const stats: StatsData | null = pokemon && meta ? { meta, pokemon } : null;
  return { stats, sets };
}
