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

describe('precisione col meteo', () => {
  const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane'], 'Modest', { spa: 252, hp: 252 });
  const target = set('Ogerpon-Wellspring', 'Wellspring Mask', 'Water Absorb', ['Ivy Cudgel'], 'Jolly', { hp: 252 });
  it('Hurricane con la pioggia non manca, col sole fa 50%, con l\'Umbrella del bersaglio resta 70%', () => {
    const plain = bestHit(pelipper, target)!.expected;
    expect(bestHit(pelipper, target, { conditions: ['rain'] })!.expected).toBeCloseTo(plain / 0.7, 3);
    expect(bestHit(pelipper, target, { conditions: ['sun'] })!.expected).toBeCloseTo(plain / 0.7 * 0.5, 3);
    expect(bestHit(pelipper, { ...target, item: 'Utility Umbrella' }, { conditions: ['rain'] })!.expected).toBeCloseTo(plain, 3);
  });
  it('Blizzard con la neve non manca', () => {
    const ninetales = set('Ninetales-Alola', 'Light Clay', 'Snow Warning', ['Blizzard'], 'Timid', { spa: 252, spe: 252 });
    expect(bestHit(ninetales, swampert, { conditions: ['snow'] })!.expected / bestHit(ninetales, swampert)!.expected).toBeCloseTo(1 / 0.7, 2);
  });
});

describe('precisione con abilità e strumenti', () => {
  const butterfree = (ability: string, item = '') => set('Butterfree', item, ability, ['Hurricane'], 'Timid', { spa: 252, spe: 252 });
  it('Compound Eyes ×1,3, Wide Lens ×1,1, No Guard 100%, mai oltre il 100%', () => {
    const plain = bestHit(butterfree('Tinted Lens'), swampert)!.expected;
    // Tinted Lens non cambia il danno su Swampert (Volante neutro): 70% → 91% con Compound Eyes
    expect(bestHit(butterfree('Compound Eyes'), swampert)!.expected).toBeCloseTo(plain * 1.3, 3);
    expect(bestHit(butterfree('Tinted Lens', 'Wide Lens'), swampert)!.expected).toBeCloseTo(plain * 1.1, 3);
    expect(bestHit(butterfree('Compound Eyes', 'Wide Lens'), swampert)!.expected).toBeCloseTo(plain / 0.7, 3);
    const machamp = set('Machamp', 'Leftovers', 'No Guard', ['Dynamic Punch'], 'Adamant', { atk: 252 });
    const guts = { ...machamp, ability: 'Guts' };
    expect(bestHit(machamp, swampert)!.expected).toBeCloseTo(bestHit(guts, swampert)!.expected * 2, 3);
  });
  it('Hustle: le mosse fisiche mirano all\'80%', () => {
    const durant = (ability: string) => set('Durant', 'Leftovers', ability, ['Iron Head'], 'Jolly', { atk: 252 });
    expect(bestHit(durant('Hustle'), clefable)!.expected / bestHit(durant('Swarm'), clefable)!.expected).toBeCloseTo(1.5 * 0.8, 1);
  });
});

describe('blocco su una mossa', () => {
  it('Gorilla Tactics blocca come la Band: il 10% in meno una volta sola', () => {
    const toxapex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Recover'], 'Bold', { hp: 252, def: 252 });
    const darm = (item: string, ability: string) => set('Darmanitan-Galar', item, ability, ['Icicle Crash'], 'Jolly', { atk: 252, spe: 252 });
    const boots = bestHit(darm('Heavy-Duty Boots', 'Gorilla Tactics'), toxapex)!.expected;
    const plain = bestHit(darm('Heavy-Duty Boots', 'Zen Mode'), toxapex)!.expected;
    expect(boots / plain).toBeCloseTo(1.5 * 0.9, 1);
    const band = bestHit(darm('Choice Band', 'Gorilla Tactics'), toxapex)!.expected;
    expect(band / boots).toBeCloseTo(1.5, 1);
  });
});
