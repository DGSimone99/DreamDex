import { describe, expect, it } from 'vitest';
import { buildGameNames, parseCsv } from '../../scripts/pokeapi';

const csv = {
  moves: 'id,identifier\n89,earthquake\n',
  moveNames: 'move_id,local_language_id,name\n89,8,Terremoto\n89,9,Earthquake\n',
  moveFlavor: 'move_id,version_group_id,language_id,flavor_text\n'
    + '89,18,8,Vecchio testo\n'
    + '89,20,8,"Un terremoto che colpisce\ntutti i Pokémon, vicini."\n'
    + '89,20,9,English text\n',
  abilities: 'id,identifier\n70,drought\n299,new-ability\n',
  abilityNames: 'ability_id,local_language_id,name\n70,8,Siccità\n299,9,New Ability\n',
  abilityFlavor: 'ability_id,version_group_id,language_id,flavor_text\n70,20,8,Il sole si fa più intenso.\n',
  items: 'id,identifier\n234,leftovers\n',
  itemNames: 'item_id,local_language_id,name\n234,8,Avanzi\n',
  itemFlavor: 'item_id,version_group_id,language_id,flavor_text\n234,20,8,"Ripristina­ i PS."\n',
  types: 'id,identifier\n10,fire\n',
  typeNames: 'type_id,local_language_id,name\n10,8,Fuoco\n',
  natures: 'id,identifier\n2,adamant\n',
  natureNames: 'nature_id,local_language_id,name\n2,8,Decisa\n',
};

describe('CSV di PokeAPI', () => {
  it('virgolette con virgole e a capo', () => {
    expect(parseCsv('a,b\n1,"x, y\nz"\n')).toEqual([['a', 'b'], ['1', 'x, y\nz']]);
  });

  it('nomi italiani per id Showdown, testo del version group più recente in una riga', () => {
    const names = buildGameNames(csv);
    expect(names.moves.earthquake).toEqual({ name: 'Terremoto', desc: 'Un terremoto che colpisce tutti i Pokémon, vicini.' });
    expect(names.abilities.drought).toEqual({ name: 'Siccità', desc: 'Il sole si fa più intenso.' });
    expect(names.items.leftovers).toEqual({ name: 'Avanzi', desc: 'Ripristina i PS.' });
    expect(names.types.fire).toBe('Fuoco');
    expect(names.natures.adamant).toBe('Decisa');
  });

  it('senza nome italiano la voce non c\'è', () => {
    expect(buildGameNames(csv).abilities.newability).toBeUndefined();
  });
});
