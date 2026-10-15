import type { EngineData } from '../engine/data';
import { DEFAULT_FORMAT } from '../engine/format';
import { dataSource } from '../engine/formats';
import type { PresetsData, SetsData } from '../engine/sets';
import type { SpeciesStats, StatsData, StatsMeta } from '../engine/stats';
import type { GameNames } from '../i18n/game';

type Loaders = Record<string, () => Promise<unknown>>;

const files: Loaders = import.meta.glob<unknown>('/data/*/*.json', { import: 'default' });

const EMPTY: EngineData = { stats: null, sets: null, fallback: null, presets: null, fallbackPresets: null };

/** Cartella dei set di riserva comuni a tutti i formati. */
export const FALLBACK_DIR = '_fallback';

/** Legge i dati di una fonte (`data/<fonte>/`). Fonte assente o file corrotto: statistiche nulle. */
export async function readSource(loaders: Loaders, source: string): Promise<EngineData> {
  const read = async <T,>(dir: string, name: string): Promise<T | null> => {
    const loader = loaders[`/data/${dir}/${name}.json`];
    return loader ? ((await loader()) as T) : null;
  };
  try {
    const [pokemon, meta, sets, fallback, presets, fallbackPresets] = await Promise.all([
      read<Record<string, SpeciesStats>>(source, 'stats'),
      read<StatsMeta>(source, 'meta'),
      read<SetsData>(source, 'sets'),
      read<SetsData>(FALLBACK_DIR, 'sets').catch(() => null),
      read<PresetsData>(source, 'presets').catch(() => null),
      read<PresetsData>(FALLBACK_DIR, 'presets').catch(() => null),
    ]);
    const stats: StatsData | null = pokemon && meta ? { meta, pokemon } : null;
    return { ...(stats || sets ? { stats, sets } : { stats: null, sets: null }), fallback, presets, fallbackPresets };
  } catch (error) {
    console.error(`Dati Smogon di ${source} non leggibili, rilancia npm run fetch-data:`, error);
    return EMPTY;
  }
}

export const loadSource = (source: string): Promise<EngineData> => readSource(files, source);

/** Fonte iniziale (National Dex OU). */
export const loadDataOrEmpty = (): Promise<EngineData> => loadSource(dataSource(DEFAULT_FORMAT));

/** Nomi italiani del gioco (`data/_i18n/it.json`), o null se non scaricati. */
export async function loadItalianNames(loaders: Loaders = files): Promise<GameNames | null> {
  const loader = loaders['/data/_i18n/it.json'];
  if (!loader) return null;
  try {
    return (await loader()) as GameNames;
  } catch {
    return null;
  }
}
