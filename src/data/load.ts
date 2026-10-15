import type { EngineData } from '../engine/data';
import type { SetsData } from '../engine/sets';
import type { SpeciesStats, StatsData, StatsMeta } from '../engine/stats';

type Loaders = Record<string, () => Promise<unknown>>;

const files: Loaders = import.meta.glob<unknown>('/data/*/*.json', { import: 'default' });

const EMPTY: EngineData = { stats: null, sets: null };

/** Legge i dati di una fonte (`data/<fonte>/`). Fonte assente o file corrotto: statistiche nulle. */
export async function readSource(loaders: Loaders, source: string): Promise<EngineData> {
  const read = async <T,>(name: string): Promise<T | null> => {
    const loader = loaders[`/data/${source}/${name}.json`];
    return loader ? ((await loader()) as T) : null;
  };
  try {
    const [pokemon, meta, sets] = await Promise.all([
      read<Record<string, SpeciesStats>>('stats'),
      read<StatsMeta>('meta'),
      read<SetsData>('sets'),
    ]);
    const stats: StatsData | null = pokemon && meta ? { meta, pokemon } : null;
    return stats || sets ? { stats, sets } : EMPTY;
  } catch (error) {
    console.error(`Dati Smogon di ${source} non leggibili, rilancia npm run fetch-data:`, error);
    return EMPTY;
  }
}

export const loadSource = (source: string): Promise<EngineData> => readSource(files, source);

/** Fonte iniziale (National Dex OU). */
export const loadDataOrEmpty = (): Promise<EngineData> => loadSource('gen9nationaldex');
