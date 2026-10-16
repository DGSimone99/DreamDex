import { describe, expect, it } from 'vitest';
import { cardRoles, weatherOf } from '../../src/engine/archetype';
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

describe('meteo sulla carta', () => {
  it('chi porta il meteo lo mostra come supporto, dopo il ruolo principale', () => {
    const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Scald', 'U-turn', 'Roost']);
    expect(cardRoles(pelipper)).toEqual(['weather', 'pivot']);
    const ttar = set('Tyranitar', 'Smooth Rock', 'Sand Stream', ['Stealth Rock', 'Stone Edge', 'Knock Off', 'Earthquake']);
    expect(cardRoles(ttar)).toEqual(['wallbreaker', 'weather']);
    expect(weatherOf(ttar)).toEqual({ condition: 'sand', via: 'Sand Stream' });
  });

  it('anche con una mossa (Rain Dance), non con la neve di passaggio di Chilly Reception', () => {
    expect(weatherOf(set('Pelipper', 'Damp Rock', 'Keen Eye', ['Rain Dance', 'U-turn']))).toEqual({ condition: 'rain', via: 'Rain Dance' });
    expect(weatherOf(set('Slowking-Galar', 'Heavy-Duty Boots', 'Regenerator', ['Chilly Reception', 'Sludge Bomb']))).toBeNull();
    expect(cardRoles(set('Slowking-Galar', 'Heavy-Duty Boots', 'Regenerator', ['Chilly Reception', 'Sludge Bomb']))).not.toContain('weather');
  });
});

describe("abilità in battaglia per la velocità", () => {
  it('Mega Swampert (Swift Swim in battaglia) è sweeper anche se il set ha Torrent', () => {
    const swampert = set('Swampert', 'Swampertite', 'Torrent', ['Waterfall', 'Earthquake', 'Ice Punch', 'Superpower']);
    expect(cardRoles(swampert)[0]).toBe('physicalSweeper');
  });
});
