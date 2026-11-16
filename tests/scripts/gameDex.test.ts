import { describe, expect, it } from 'vitest';
import { buildGameDex } from '../../scripts/gameDex';
import { loadGameDex } from '../../src/data/load';

const dexNumbers = [['species_id', 'pokedex_id', 'pokedex_number'], ['906', '31', '1'], ['122', '31', '90'], ['23', '32', '40'], ['906', '33', '5'], ['1', '2', '1']];
const species = [['id', 'identifier'], ['906', 'sprigatito'], ['122', 'mr-mime'], ['23', 'ekans'], ['1', 'bulbasaur']];

describe('Pokédex del gioco', () => {
  it('specie dei Pokédex scelti, con gli id di @pkmn', () => {
    expect(buildGameDex(dexNumbers, species, [31, 32, 33])).toEqual(['ekans', 'mrmime', 'sprigatito']);
  });

  it('un nome che @pkmn non conosce è un errore', () => {
    expect(() => buildGameDex([...dexNumbers, ['9999', '31', '2']], [...species, ['9999', 'pokemon-inventato']], [31])).toThrow(/pokemon-inventato/);
  });

  it('il file del gioco si legge, e senza file è null', async () => {
    const loaded = await loadGameDex({ '/data/_games/sv.json': async () => ({ dex: ['sprigatito'] }) });
    expect(loaded).toEqual({ sv: { dex: ['sprigatito'] } });
    expect(await loadGameDex({})).toBeNull();
  });
});
