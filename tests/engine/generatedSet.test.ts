import { describe, expect, it } from 'vitest';
import { getMove } from '../../src/engine/dex';
import { generatedSet } from '../../src/engine/generatedSet';
import { legalMoves } from '../../src/engine/learnsets';
import { defaultSet } from '../../src/engine/sets';

const NO_DATA = { stats: null, sets: null, fallback: null };

describe('set generato per Pokémon senza dati', () => {
  it('4 mosse legali, STAB in testa, statistiche coerenti', () => {
    const set = generatedSet('Garchomp');
    expect(set.moves).toHaveLength(4);
    const legal = legalMoves('Garchomp', 9)!;
    expect(set.moves.every(m => legal.has(getMove(m)!.id))).toBe(true);
    expect(set.moves.slice(0, 2).map(m => getMove(m)!.type).sort()).toEqual(['Dragon', 'Ground']);
    expect(set.moves.map(getMove).filter(m => m!.category !== 'Status').every(m => m!.category === 'Physical')).toBe(true);
    expect(set).toMatchObject({ nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 }, ability: expect.any(String) });
  });

  it('nessuna mossa che si ricarica o esplode', () => {
    for (const name of ['Snorlax', 'Typhlosion', 'Electrode', 'Venusaur']) {
      expect(generatedSet(name).moves.map(m => getMove(m)!.id)).not.toEqual(expect.arrayContaining(['hyperbeam']));
      expect(generatedSet(name).moves.map(m => getMove(m)!.id)).not.toContain('explosion');
    }
  });

  it('non evoluti con Eviolite; Pokémon difensivi con natura e EV difensivi', () => {
    expect(generatedSet('Porygon2').item).toBe('Eviolite');
    expect(generatedSet('Shuckle')).toMatchObject({ evs: { hp: 252 } });
  });

  it('ogni Pokémon riceve un moveset anche senza nessun dato', () => {
    for (const name of ['Bulbasaur', 'Pikachu-Cosplay', 'Wigglytuff', 'Lopunny-Mega']) {
      expect(defaultSet(NO_DATA, name).moves.length).toBeGreaterThan(0);
    }
  });

  it('le Mega generate tengono la loro pietra', () => {
    expect(generatedSet('Lopunny-Mega').item).toBe('Lopunnite');
  });
});
