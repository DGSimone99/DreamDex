import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Statistics } from 'smogon';
import type { EngineData } from '../src/engine/data';
import { buildFallbackSets, mergePresets, normalizeAnalysisPresets, normalizeAnalysisSets, type PresetsData, type SetsData } from '../src/engine/sets';
import { buildFallbackStats, reduceChaos, reducePkmnStats, type ChaosFile, type PkmnStatsFile, type StatsMeta } from '../src/engine/stats';
import { FALLBACK_SETS, FALLBACK_STATS, SOURCES } from './sources';
import { fetchItalianNames } from './pokeapi';
import { FORMATS_DATA_URL, parseTiers } from './showdown-tiers';
import { buildBans, FORMATS_URL, parseFormats, parseRulesets, RULESETS_URL } from './showdown-bans';

async function get(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} per ${url}`);
  return response;
}

/** Il mese dato e i due precedenti ("2026-09" → 2026-09, 2026-08, 2026-07). */
function recentMonths(latest: string): string[] {
  const [year, month] = latest.split('-').map(Number);
  return [0, 1, 2].map(back => {
    const date = new Date(Date.UTC(year, month - 1 - back, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** Statistiche "chaos" del formato: la soglia la sceglie la libreria (1695 per Gen 9 OU, 1630 per gli altri). */
async function fetchStats(source: string, months: string[]): Promise<{ meta: StatsMeta; chaos: ChaosFile }> {
  for (const month of months) {
    const url = Statistics.url(month, source);
    const response = await fetch(url);
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`HTTP ${response.status} per ${url}`);
    console.log(`[${source}] Scarico ${url.slice(Statistics.URL.length)}…`);
    const chaos = Statistics.process(await response.text()) as unknown as ChaosFile;
    return { meta: { month, cutoff: chaos.info.cutoff, battles: chaos.info['number of battles'] }, chaos };
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

/**
 * `--strict` (pubblicazione automatica): qualunque pezzo che non si scarica fa fallire tutto, così non va online un sito
 * con dati a metà (resta quello di prima). Senza, un errore salta solo quel pezzo (uso a mano).
 */
const STRICT = process.argv.includes('--strict');
const failures: string[] = [];
const soft = (what: string, error: unknown) => { failures.push(`${what}: ${(error as Error).message}`); };

async function main() {
  const months = recentMonths(Statistics.latest(await (await get(Statistics.URL)).text()));
  // `npm run fetch-data -- gen9ou`: scarica solo le fonti indicate, senza ricostruire i dati di riserva
  const only = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  if (only.length) {
    for (const source of only) await fetchSource(source, months);
    return;
  }
  const downloaded: EngineData[] = [];
  const downloadedFormats: string[] = [];
  // Una fonte che fallisce non blocca le altre
  for (const source of SOURCES) {
    try {
      downloaded.push(await fetchSource(source, months));
      downloadedFormats.push(source);
    } catch (error) {
      console.error(`[${source}] Errore: ${(error as Error).message}`);
      soft(source, error);
    }
  }
  if (downloaded.length === 0) process.exit(1);
  // Set di riserva: per ogni Pokémon, il set del formato in cui è in più squadre (anche fuori dal National Dex)
  const extraStats: EngineData[] = [];
  const extraFormats: string[] = [];
  for (const format of FALLBACK_STATS) {
    try {
      const file = (await (await get(`https://data.pkmn.cc/stats/${format}.json`)).json()) as PkmnStatsFile;
      const pokemon = reducePkmnStats(file);
      extraStats.push({ stats: { meta: { month: '', cutoff: 0, battles: file.battles }, pokemon }, sets: null });
      extraFormats.push(format);
      console.log(`[riserva] ${format}: ${Object.keys(pokemon).length} Pokémon`);
    } catch (error) {
      console.warn(`[riserva] ${format} non disponibile (${(error as Error).message})`);
      soft(`riserva ${format}`, error);
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
  // Statistiche di riserva: per i Pokémon senza dati nel formato scelto (es. i vietati), i "Più usati" vengono da qui
  // Prima i National Dex (stesse regole: Mega, Z), poi le altre generazioni per chi lì non è mai giocato
  const fallbackStats = buildFallbackStats(
    downloaded.flatMap((d, i) => (d.stats ? [{ format: downloadedFormats[i], stats: d.stats }] : [])),
    extraStats.map((d, i) => ({ format: extraFormats[i], stats: d.stats! })),
  );
  await writeFile(join('data', '_fallback', 'stats.json'), JSON.stringify(fallbackStats));
  console.log(`Statistiche di riserva: ${Object.keys(fallbackStats).length} Pokémon.`);
  console.log(`Preset Smogon di riserva: ${Object.keys(fallbackPresets).length} Pokémon.`);
  // Nomi e descrizioni italiane (mosse, abilità, strumenti, tipi, nature): un errore non blocca il resto
  try {
    const italian = await fetchItalianNames();
    await mkdir(join('data', '_i18n'), { recursive: true });
    await writeFile(join('data', '_i18n', 'it.json'), JSON.stringify(italian));
    console.log(`Nomi italiani: ${Object.keys(italian.moves).length} mosse, ${Object.keys(italian.abilities).length} abilità, ${Object.keys(italian.items).length} strumenti.`);
  } catch (error) {
    console.warn(`Nomi italiani non disponibili (${(error as Error).message}): l'italiano userà i nomi inglesi.`);
    soft('nomi italiani', error);
  }
  // Tier National Dex aggiornati da Showdown: un errore non blocca il resto (restano quelli della libreria)
  try {
    const tiers = parseTiers(await (await get(FORMATS_DATA_URL)).text());
    await mkdir(join('data', '_tiers'), { recursive: true });
    await writeFile(join('data', '_tiers', 'tiers.json'), JSON.stringify(tiers));
    console.log(`Tier da Showdown: ${Object.keys(tiers.natdex).length} specie National Dex, ${Object.keys(tiers.gen9).length} di Gen 9.`);
  } catch (error) {
    console.warn(`Tier di Showdown non disponibili (${(error as Error).message}): restano quelli della libreria.`);
    soft('tier di Showdown', error);
  }
  // Ban di mosse, abilità, strumenti e Pokémon per formato (Shed Tail, Moody, King's Rock…)
  try {
    const rules = [...parseFormats(await (await get(FORMATS_URL)).text()), ...parseRulesets(await (await get(RULESETS_URL)).text())];
    const bans = buildBans(rules);
    await mkdir(join('data', '_rules'), { recursive: true });
    await writeFile(join('data', '_rules', 'bans.json'), JSON.stringify(bans));
    console.log(`Ban per formato da Showdown: ${Object.entries(bans).map(([id, b]) => `${id} ${b.moves.length + b.abilities.length + b.items.length + b.species.length}`).join(', ')}.`);
  } catch (error) {
    console.warn(`Ban di Showdown non disponibili (${(error as Error).message}): si controllano solo i Pokémon vietati.`);
    soft('ban di Showdown', error);
  }
  await mkdir(join('data', '_fallback'), { recursive: true });
  await writeFile(join('data', '_fallback', 'sets.json'), JSON.stringify(fallback));
  console.log(`Set di riserva: ${Object.keys(fallback).length} Pokémon.`);
  if (STRICT && failures.length) {
    console.error(`Modalità --strict: ${failures.length} pezzi non scaricati, niente pubblicazione.`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
