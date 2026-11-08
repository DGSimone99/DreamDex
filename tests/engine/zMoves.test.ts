import { describe, expect, it } from 'vitest';
import { calculate, Generations, Move, Pokemon } from '@smogon/calc';
import { bestHit, hasZMove } from '../../src/engine/damage';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const gen = Generations.get(9);
/** La media del danno vero della libreria, in frazione dei PS del bersaglio. */
const calcAvg = (attacker: TeamSet, move: string, defender: TeamSet) => {
  const a = new Pokemon(gen, attacker.species, { item: attacker.item, ability: attacker.ability, nature: attacker.nature, evs: attacker.evs });
  const d = new Pokemon(gen, defender.species, { item: defender.item, ability: defender.ability, nature: defender.nature, evs: defender.evs });
  const r = calculate(gen, a, d, new Move(gen, move, { useZ: true, item: attacker.item }));
  const rolls = (r.damage as number[]);
  return rolls.reduce((x, y) => x + y, 0) / rolls.length / d.maxHP();
};

const swampert = set('Swampert', 'Leftovers', 'Torrent', ['Earthquake'], 'Relaxed', { hp: 252, def: 252 });
const clefable = set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast'], 'Bold', { hp: 252, def: 252 });

describe('mosse Z', () => {
  it('non mancano mai: Fire Blast Z vale il danno pieno', () => {
    const volcarona = set('Volcarona', 'Firium Z', 'Flame Body', ['Fire Blast'], 'Timid', { spa: 252, spe: 252 });
    const z = bestHit(volcarona, clefable, { z: true })!;
    expect(z.expected).toBeCloseTo(calcAvg(volcarona, 'Fire Blast', clefable), 3);
  });

  it('Solar Beam Z (Bloom Doom) non carica', () => {
    const venusaur = set('Venusaur', 'Grassium Z', 'Overgrow', ['Solar Beam'], 'Modest', { spa: 252, spe: 252 });
    expect(bestHit(venusaur, swampert, { z: true })!.expected).toBeCloseTo(calcAvg(venusaur, 'Solar Beam', swampert), 3);
  });

  it('i cristalli unici contano solo con la loro mossa e il loro Pokémon', () => {
    const kommo = set('Kommo-o', 'Kommonium Z', 'Bulletproof', ['Clanging Scales', 'Focus Blast'], 'Timid', { spa: 252, spe: 252 });
    expect(hasZMove(kommo)).toBe(true);
    expect(bestHit(kommo, swampert, { z: true })!.move).toBe('Clanging Scales');
    expect(bestHit(kommo, swampert, { z: true })!.expected).toBeGreaterThan(bestHit(kommo, swampert)!.expected * 1.4);
    // Senza Clanging Scales, o su un altro Pokémon, il cristallo non fa niente
    expect(hasZMove({ ...kommo, moves: ['Focus Blast'] })).toBe(false);
    expect(hasZMove({ ...kommo, species: 'Hydreigon', moves: ['Clanging Scales'] })).toBe(false);
    // Un cristallo di tipo vale solo per le mosse di quel tipo
    expect(hasZMove(set('Darkrai', 'Fightinium Z', 'Bad Dreams', ['Dark Pulse'], 'Timid', {}))).toBe(false);
    expect(hasZMove(set('Darkrai', 'Fightinium Z', 'Bad Dreams', ['Focus Blast'], 'Timid', {}))).toBe(true);
  });
});
