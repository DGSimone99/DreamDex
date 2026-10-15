import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EngineData } from '../src/engine/data';
import { buildFallbackSets, mergePresets, normalizeAnalysisPresets, normalizeAnalysisSets, type PresetsData, type SetsData } from '../src/engine/sets';
import { reduceChaos, reducePkmnStats, type ChaosFile, type PkmnStatsFile, type StatsMeta } from '../src/engine/stats';
import { listMonths, pickCutoff } from './smogon-index';
import { FALLBACK_SETS, FALLBACK_STATS, SOURCES } from './sources';

const STATS_BASE = 'https://www.smogon.com/stats/';

async function get(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} per ${url}`);
  return response;
}

async function fetchStats(source: string, months: string[]): Promise<{ meta: StatsMeta; chaos: ChaosFile }> {
  for (const month of months.slice(0, 3)) {
    const cutoff = pickCutoff(await (await get(`${STATS_BASE}${month}/chaos/`)).text(), source);
    if (cutoff === null) continue;
    console.log(`[${source}] Scarico ${month}/chaos/${source}-${cutoff}.json…`);
    const chaos = (await (await get(`${STATS_BASE}${month}/chaos/${source}-${cutoff}.json`)).json()) as ChaosFile;
    return { meta: { month, cutoff, battles: chaos.info['number of battles'] }, chaos };
  }
  throw new Error(`Nessuna statistica per ${source} negli ultimi 3 mesi`);
}

/** Set delle analisi: il primo per Pokémon (set di riferimento) e tutti quelli con nome (preset). */
async function fetchSets(source: string): Promise<{ sets: SetsData; presets: PresetsData }> {
  try {
    const raw = await (await get(`https://data.pkmn.cc/sets/${source}.json`)).json();
    return { sets: normalizeAnalysisSets(raw), presets: mergePresets([normalizeAnalysisPresets(raw, source)]) };
  } catch (error) {
    console.warn(`[${source}] Set delle analisi non disponibili (${(error as Error).message}): continuo senza.`);
    return { sets: {}, presets: {} };
  }
}

async function fetchSource(source: string, months: string[]): Promise<EngineData> {
  const [{ meta, chaos }, { sets, presets }] = await Promise.all([fetchStats(source, months), fetchSets(source)]);
  const pokemon = reduceChaos(chaos);
  const outDir = join('data', source);
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(join(outDir, 'stats.json'), JSON.stringify(pokemon)),
    writeFile(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2)),
    writeFile(join(outDir, 'sets.json'), JSON.stringify(sets)),
    writeFile(join(outDir, 'presets.json'), JSON.stringify(presets)),
  ]);
  console.log(
    `[${source}] Fatto: ${Object.keys(pokemon).length} Pokémon, ${Object.keys(sets).length} set, ` +
      `${meta.battles} battaglie (${meta.month}, rating ${meta.cutoff}+).`,
  );
  return { stats: { meta, pokemon }, sets, presets };
}

async function main() {
  const months = listMonths(await (await get(STATS_BASE)).text());
  const downloaded: EngineData[] = [];
  // Una fonte che fallisce non blocca le altre
  for (const source of SOURCES) {
    try {
      downloaded.push(await fetchSource(source, months));
    } catch (error) {
      console.error(`[${source}] Errore: ${(error as Error).message}`);
    }
  }
  if (downloaded.length === 0) process.exit(1);
  // Set di riserva: per ogni Pokémon, il set del formato in cui è in più squadre (anche fuori dal National Dex)
  const extraStats: EngineData[] = [];
  for (const format of FALLBACK_STATS) {
    try {
      const file = (await (await get(`https://data.pkmn.cc/stats/${format}.json`)).json()) as PkmnStatsFile;
      const pokemon = reducePkmnStats(file);
      extraStats.push({ stats: { meta: { month: '', cutoff: 0, battles: file.battles }, pokemon }, sets: null });
      console.log(`[riserva] ${format}: ${Object.keys(pokemon).length} Pokémon`);
    } catch (error) {
      console.warn(`[riserva] ${format} non disponibile (${(error as Error).message})`);
    }
  }
  const analyses: SetsData[] = [];
  const otherPresets: PresetsData[] = [];
  for (const format of FALLBACK_SETS) {
    try {
      const raw = await (await get(`https://data.pkmn.cc/sets/${format}.json`)).json();
      analyses.push(normalizeAnalysisSets(raw));
      otherPresets.push(normalizeAnalysisPresets(raw, format));
    } catch {
      // Non tutti i formati hanno analisi: si salta
    }
  }
  const fallback = buildFallbackSets([...downloaded, ...extraStats], analyses);
  // Preset degli altri formati: prima i National Dex, poi le generazioni dalla più recente
  const fallbackPresets = mergePresets([...downloaded.map(d => d.presets), ...otherPresets]);
  await mkdir(join('data', '_fallback'), { recursive: true });
  await writeFile(join('data', '_fallback', 'presets.json'), JSON.stringify(fallbackPresets));
  console.log(`Preset Smogon di riserva: ${Object.keys(fallbackPresets).length} Pokémon.`);
  await mkdir(join('data', '_fallback'), { recursive: true });
  await writeFile(join('data', '_fallback', 'sets.json'), JSON.stringify(fallback));
  console.log(`Set di riserva: ${Object.keys(fallback).length} Pokémon.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
