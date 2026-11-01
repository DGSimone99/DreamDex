import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { describe, expect, it } from 'vitest';
import { cardRoles, weatherOf } from '../../src/engine/archetype';
import { emptySet, type TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });

describe('ruoli sulla carta: prima il ruolo principale, poi un supporto', () => {
  it('uno sweeper con setup: lo sweeper, non il setup (già implicito)', () => {
    const volcarona = set('Volcarona', 'Heavy-Duty Boots', 'Flame Body', ['Quiver Dance', 'Fiery Dance', 'Giga Drain', 'Roost']);
    expect(cardRoles(volcarona, DEFAULT_RULES)).toEqual(['specialSweeper']);
  });

  it('un attaccante con utilità: offensivo prima della rimozione', () => {
    const lando = set('Landorus-Therian', 'Choice Scarf', 'Intimidate', ['Earthquake', 'Stone Edge', 'U-turn', 'Defog']);
    expect(cardRoles(lando, DEFAULT_RULES)).toEqual(['physicalSweeper', 'removal']);
  });

  it('un muro da stall: il wall prima degli hazard (sulla carta gli hazard vengono prima di Anti-setup, non conta la famiglia)', () => {
    const tingLu = set('Ting-Lu', 'Leftovers', 'Vessel of Ruin', ['Earthquake', 'Ruination', 'Stealth Rock', 'Whirlwind']);
    expect(cardRoles(tingLu, DEFAULT_RULES)).toEqual(['physicalWall', 'hazards']);
  });

  it('un attaccante con poche mosse offensive non diventa "wall" (Kartana con Defog)', () => {
    const kartana = set('Kartana', 'Grassium Z', 'Beast Boost', ['Defog', 'Knock Off', 'Leaf Blade', 'Synthesis']);
    expect(cardRoles(kartana, DEFAULT_RULES)[0]).not.toBe('physicalWall');
  });

  it('senza attacco né muro: il principale viene da Support e Utility; il Recupero è solo secondario', () => {
    const clefable = set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast', 'Soft-Boiled', 'Stealth Rock', 'Thunder Wave']);
    expect(cardRoles(clefable, DEFAULT_RULES)).toEqual(['hazards', 'recovery']);
  });

  it('con i valori misurati del team la carta usa quelli (come il voto)', () => {
    const clefable = set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast', 'Soft-Boiled', 'Stealth Rock', 'Thunder Wave']);
    expect(cardRoles(clefable, DEFAULT_RULES, { specialWall: 1, recovery: 1, hazards: 1 })).toEqual(['specialWall', 'hazards']);
    // Un Taunt sotto 0,5 (meta per lo più più veloce) non compare
    expect(cardRoles(clefable, DEFAULT_RULES, { taunt: 0.3, recovery: 1 })).toEqual(['recovery']);
  });

  it('la famiglia principale va prima: Great Tusk offensivo attacca, Corviknight difensivo fa il muro', () => {
    const tusk = { ...set('Great Tusk', 'Heavy-Duty Boots', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin']), nature: 'Jolly', evs: { atk: 252, spe: 252 } };
    expect(cardRoles(tusk, DEFAULT_RULES, { physicalWall: 1, physicalBreaker: 1, removal: 1 })[0]).toBe('physicalBreaker');
    const corv = { ...set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense', 'Roost', 'Defog']), nature: 'Impish', evs: { hp: 252, def: 252 } };
    expect(cardRoles(corv, DEFAULT_RULES, { physicalWall: 1, physicalBreaker: 1, recovery: 1, removal: 1 })[0]).toBe('physicalWall');
  });

  it("il setup resta un'etichetta della carta per chi non è sweeper", () => {
    const corviknight = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense', 'Roost', 'Brave Bird']);
    expect(cardRoles({ ...corviknight, evs: { hp: 252, def: 252 }, nature: 'Impish' }, DEFAULT_RULES)).toEqual(['physicalWall', 'setup']);
  });
});

describe('meteo sulla carta', () => {
  it('chi porta il meteo lo mostra dopo il ruolo principale, prima degli altri supporti', () => {
    const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'Scald', 'U-turn', 'Roost']);
    // Il Recupero non è il ruolo principale: il Pivot lo è, poi il meteo
    expect(cardRoles(pelipper, DEFAULT_RULES)).toEqual(['pivot', 'weather']);
    const ttar = set('Tyranitar', 'Smooth Rock', 'Sand Stream', ['Stealth Rock', 'Stone Edge', 'Knock Off', 'Earthquake']);
    expect(cardRoles(ttar, DEFAULT_RULES)).toEqual(['physicalBreaker', 'weather']);
    expect(weatherOf(ttar)).toEqual({ condition: 'sand', via: 'Sand Stream' });
  });

  it('anche con una mossa (Rain Dance), non con la neve di passaggio di Chilly Reception', () => {
    expect(weatherOf(set('Pelipper', 'Damp Rock', 'Keen Eye', ['Rain Dance', 'U-turn']))).toEqual({ condition: 'rain', via: 'Rain Dance' });
    expect(weatherOf(set('Slowking-Galar', 'Heavy-Duty Boots', 'Regenerator', ['Chilly Reception', 'Sludge Bomb']))).toBeNull();
    expect(cardRoles(set('Slowking-Galar', 'Heavy-Duty Boots', 'Regenerator', ['Chilly Reception', 'Sludge Bomb']), DEFAULT_RULES)).not.toContain('weather');
  });
});

describe("abilità in battaglia per la velocità", () => {
  it('Mega Swampert (Swift Swim in battaglia) è sweeper anche se il set ha Torrent', () => {
    const swampert = set('Swampert', 'Swampertite', 'Torrent', ['Waterfall', 'Earthquake', 'Ice Punch', 'Superpower']);
    expect(cardRoles(swampert, DEFAULT_RULES)[0]).toBe('physicalSweeper');
  });
});
