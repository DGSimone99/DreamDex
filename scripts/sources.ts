/** Fonti di statistiche Smogon scaricate da `npm run fetch-data`, una cartella `data/<fonte>/` ciascuna. */
export const SOURCES = ['gen9nationaldex', 'gen9nationaldexubers', 'gen9nationaldexuu', 'gen9ou', 'gen9ubers', 'gen9uu', 'gen9anythinggoes'];

/**
 * Fonti del doppio: a parte, perché i loro set (Fake Out, Follow Me, Protect…) non devono mai diventare
 * set, preset o statistiche di riserva del singolo. Il doppio è acceso solo in sviluppo (features.ts).
 */
export const DOUBLES_SOURCES = ['gen9nationaldexdoubles'];

/** Le fonti del doppio da scaricare: nessuna per la pubblicazione (--strict), dove il doppio è spento; tutte a mano. */
export const doublesToFetch = (strict: boolean): string[] => (strict ? [] : DOUBLES_SOURCES);

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
