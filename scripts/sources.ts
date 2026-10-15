/** Fonti di statistiche Smogon scaricate da `npm run fetch-data`, una cartella `data/<fonte>/` ciascuna. */
export const SOURCES = ['gen9nationaldex', 'gen9nationaldexubers', 'gen9nationaldexuu', 'gen9nationaldexmonotype'];

/**
 * Altri formati usati solo per i set di riserva (Pokémon senza dati nel formato scelto),
 * da data.pkmn.cc. Statistiche: si sceglie il formato in cui il Pokémon è in più squadre.
 */
const TIERS = ['ubers', 'ou', 'uu', 'ru', 'nu', 'pu', 'zu', 'lc'];
export const FALLBACK_STATS = [
  ...TIERS.map(tier => `gen9${tier}`),
  'gen9nationaldexru', 'gen9nationaldexag',
  ...TIERS.map(tier => `gen8${tier}`),
  ...TIERS.map(tier => `gen7${tier}`),
];
/** Set delle analisi, dalla generazione più recente alla più vecchia: vince il primo trovato. */
export const FALLBACK_SETS = [9, 8, 7, 6, 5, 4, 3, 2, 1].flatMap(gen => TIERS.map(tier => `gen${gen}${tier}`));
