/** Tier aggiornati da Showdown (`data/formats-data.ts`): la libreria @pkmn/dex resta indietro tra un rilascio e l'altro. */
export const FORMATS_DATA_URL = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/formats-data.ts';

/**
 * Dal sorgente di formats-data.ts: id della specie → tier National Dex e tier di Gen 9.
 * Come in Showdown, natDexTier compare solo se diverso dal tier normale: altrimenti vale tier.
 */
export function parseTiers(source: string): { natdex: Record<string, string>; gen9: Record<string, string> } {
  const natdex: Record<string, string> = {};
  const gen9: Record<string, string> = {};
  for (const block of source.matchAll(/^\t([a-z0-9]+): \{([\s\S]*?)^\t\},?$/gm)) {
    const tier = /\btier: "([^"]+)"/.exec(block[2])?.[1];
    const natDexTier = /natDexTier: "([^"]+)"/.exec(block[2])?.[1] ?? tier;
    if (natDexTier) natdex[block[1]] = natDexTier;
    if (tier) gen9[block[1]] = tier;
  }
  return { natdex, gen9 };
}
