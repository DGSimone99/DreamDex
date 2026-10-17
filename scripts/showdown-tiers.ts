/** Tier National Dex aggiornati da Showdown (`data/formats-data.ts`): la libreria @pkmn/dex resta indietro tra un rilascio e l'altro. */
export const FORMATS_DATA_URL = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/formats-data.ts';

/**
 * Dal sorgente di formats-data.ts: id della specie → tier National Dex.
 * Come in Showdown, natDexTier compare solo se diverso dal tier normale: altrimenti vale tier.
 */
export function parseNatDexTiers(source: string): Record<string, string> {
  const tiers: Record<string, string> = {};
  for (const block of source.matchAll(/^\t([a-z0-9]+): \{([\s\S]*?)^\t\},?$/gm)) {
    const tier = /natDexTier: "([^"]+)"/.exec(block[2])?.[1] ?? /\btier: "([^"]+)"/.exec(block[2])?.[1];
    if (tier) tiers[block[1]] = tier;
  }
  return tiers;
}
