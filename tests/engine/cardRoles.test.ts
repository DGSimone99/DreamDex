import { describe, expect, it } from 'vitest';
import { cardRoles } from '../../src/engine/archetype';
import { emptySet, type TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });

describe('ruoli sulla carta: prima il ruolo principale, poi un supporto', () => {
  it('uno sweeper con setup: lo sweeper, non il setup (già implicito)', () => {
    const volcarona = set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Fiery Dance', 'Giga Drain', 'Roost']);
    expect(cardRoles(volcarona)).toEqual(['specialSweeper']);
  });

  it('un attaccante con utilità: offensivo prima della rimozione', () => {
    const lando = set('Landorus-Therian', 'Choice Scarf', 'Intimidate', ['Earthquake', 'Stone Edge', 'U-turn', 'Defog']);
    expect(cardRoles(lando)).toEqual(['physicalSweeper', 'removal']);
  });

  it('un muro da stall: il wall prima degli hazard', () => {
    const tingLu = set('Ting-Lu', 'Leftovers', 'Vessel of Ruin', ['Earthquake', 'Ruination', 'Stealth Rock', 'Whirlwind']);
    expect(cardRoles(tingLu)).toEqual(['physicalWall', 'hazards']);
  });

  it('un attaccante con poche mosse offensive non diventa "wall" (Kartana con Defog)', () => {
    const kartana = set('Kartana', 'Grassium Z', 'Beast Boost', ['Defog', 'Knock Off', 'Leaf Blade', 'Synthesis']);
    expect(cardRoles(kartana)[0]).not.toBe('physicalWall');
  });

  it('senza ruolo principale: due ruoli di supporto', () => {
    const clefable = set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast', 'Soft-Boiled', 'Stealth Rock', 'Thunder Wave']);
    expect(cardRoles(clefable)).toEqual(['hazards', 'speed']);
  });
});
