import { Dex } from '@pkmn/dex';
import { toID } from '../src/engine/dex';
import { parseCsv } from './pokeapi';

const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';

/** Pokédex regionali di PokeAPI per ogni gioco (pokedexes.csv): Scarlatto e Violetto = Paldea, Kitakami, Mirtillo. */
export const GAME_POKEDEXES = { sv: [31, 32, 33] } as const;

/**
 * Specie dei Pokédex regionali indicati, con gli id di @pkmn, ordinate e senza doppioni.
 * Righe: pokemon_dex_numbers.csv (species_id, pokedex_id, …) e pokemon_species.csv (id, identifier, …).
 */
export function buildGameDex(dexNumbersCsv: string[][], speciesCsv: string[][], pokedexIds: readonly number[]): string[] {
  const names = new Map(speciesCsv.slice(1).map(row => [row[0], row[1]]));
  const wanted = new Set(pokedexIds.map(String));
  const dex = Dex.forGen(9);
  const ids = new Set<string>();
  for (const row of dexNumbersCsv.slice(1)) {
    if (!wanted.has(row[1])) continue;
    const identifier = names.get(row[0]);
    const species = identifier ? dex.species.get(toID(identifier)) : null;
    if (!species?.exists) throw new Error(`Specie di PokeAPI sconosciuta a @pkmn: ${identifier ?? `id ${row[0]}`}`);
    ids.add(species.id);
  }
  return [...ids].sort();
}

/** Scarica i CSV di PokeAPI e costruisce il Pokédex di Scarlatto e Violetto. */
export async function fetchGameDex(): Promise<{ dex: string[] }> {
  const read = async (file: string) => {
    const response = await fetch(`${BASE}${file}.csv`);
    if (!response.ok) throw new Error(`HTTP ${response.status} per ${file}.csv`);
    return parseCsv(await response.text());
  };
  const [dexNumbers, species] = await Promise.all([read('pokemon_dex_numbers'), read('pokemon_species')]);
  return { dex: buildGameDex(dexNumbers, species, GAME_POKEDEXES.sv) };
}
