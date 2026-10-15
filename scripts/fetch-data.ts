import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EngineData } from '../src/engine/data';
import { buildFallbackSets, normalizeAnalysisSets, type SetsData } from '../src/engine/sets';
import { reduceChaos, type ChaosFile, type StatsMeta } from '../src/engine/stats';
import { listMonths, pickCutoff } from './smogon-index';
import { SOURCES } from './sources';

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

async function fetchSets(source: string): Promise<SetsData> {
  try {
    return normalizeAnalysisSets(await (await get(`https://data.pkmn.cc/sets/${source}.json`)).json());
  } catch (error) {
    console.warn(`[${source}] Set delle analisi non disponibili (${(error as Error).message}): continuo senza.`);
    return {};
  }
}

async function fetchSource(source: string, months: string[]): Promise<EngineData> {
  const [{ meta, chaos }, sets] = await Promise.all([fetchStats(source, months), fetchSets(source)]);
  const pokemon = reduceChaos(chaos);
  const outDir = join('data', source);
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(join(outDir, 'stats.json'), JSON.stringify(pokemon)),
    writeFile(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2)),
    writeFile(join(outDir, 'sets.json'), JSON.stringify(sets)),
  ]);
  console.log(
    `[${source}] Fatto: ${Object.keys(pokemon).length} Pokémon, ${Object.keys(sets).length} set, ` +
      `${meta.battles} battaglie (${meta.month}, rating ${meta.cutoff}+).`,
  );
  return { stats: { meta, pokemon }, sets };
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
  // Set di riserva: per ogni Pokémon, il set del formato in cui è più usato
  const fallback = buildFallbackSets(downloaded);
  await mkdir(join('data', '_fallback'), { recursive: true });
  await writeFile(join('data', '_fallback', 'sets.json'), JSON.stringify(fallback));
  console.log(`Set di riserva: ${Object.keys(fallback).length} Pokémon.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
