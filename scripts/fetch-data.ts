import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeAnalysisSets, type SetsData } from '../src/engine/sets';
import { reduceChaos, type ChaosFile, type StatsMeta } from '../src/engine/stats';
import { listMonths, pickCutoff } from './smogon-index';

const FORMAT = 'gen9nationaldex';
const STATS_BASE = 'https://www.smogon.com/stats/';
const SETS_URL = `https://data.pkmn.cc/sets/${FORMAT}.json`;
const OUT_DIR = join('data', FORMAT);

async function get(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} per ${url}`);
  return response;
}

async function fetchStats(): Promise<{ meta: StatsMeta; chaos: ChaosFile }> {
  const months = listMonths(await (await get(STATS_BASE)).text());
  for (const month of months.slice(0, 3)) {
    const cutoff = pickCutoff(await (await get(`${STATS_BASE}${month}/chaos/`)).text(), FORMAT);
    if (cutoff === null) continue;
    console.log(`Scarico ${month}/chaos/${FORMAT}-${cutoff}.json…`);
    const chaos = (await (await get(`${STATS_BASE}${month}/chaos/${FORMAT}-${cutoff}.json`)).json()) as ChaosFile;
    return { meta: { month, cutoff, battles: chaos.info['number of battles'] }, chaos };
  }
  throw new Error(`Nessuna statistica per ${FORMAT} negli ultimi 3 mesi`);
}

async function fetchSets(): Promise<SetsData> {
  try {
    return normalizeAnalysisSets(await (await get(SETS_URL)).json());
  } catch (error) {
    console.warn(`Set delle analisi non disponibili (${(error as Error).message}): continuo senza.`);
    return {};
  }
}

async function main() {
  const [{ meta, chaos }, sets] = await Promise.all([fetchStats(), fetchSets()]);
  const pokemon = reduceChaos(chaos);
  await mkdir(OUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(join(OUT_DIR, 'stats.json'), JSON.stringify(pokemon)),
    writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2)),
    writeFile(join(OUT_DIR, 'sets.json'), JSON.stringify(sets)),
  ]);
  console.log(
    `Fatto: ${Object.keys(pokemon).length} Pokémon, ${Object.keys(sets).length} set, ` +
      `${meta.battles} battaglie (${meta.month}, rating ${meta.cutoff}+).`,
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
