import { describe, expect, it } from 'vitest';
import { battleAbility, battleName, battleSpecies } from '../../src/engine/dex';
import { memberOffense } from '../../src/engine/offense';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noStats = { stats: null, sets: null, formatId: 'ou' as const };

describe('forme che il Pokémon prende sempre in battaglia', () => {
  it('Terapagos entra già Terastal (Tera Shift), Palafin combatte Hero, Wishiwashi in banco (School)', () => {
    expect(battleSpecies(set('Terapagos', 'Leftovers', 'Tera Shift', [], 'Modest', {}))?.name).toBe('Terapagos-Terastal');
    expect(battleSpecies(set('Palafin', 'Choice Band', 'Zero to Hero', [], 'Jolly', {}))?.name).toBe('Palafin-Hero');
    expect(battleSpecies(set('Wishiwashi', 'Leftovers', 'Schooling', [], 'Bold', {}))?.name).toBe('Wishiwashi-School');
    expect(battleAbility(set('Terapagos', 'Leftovers', 'Tera Shift', [], 'Modest', {}))).toBe('Tera Shell');
  });

  it('nelle statistiche Smogon resta il nome base', () => {
    expect(battleName(set('Terapagos', 'Leftovers', 'Tera Shift', [], 'Modest', {}))).toBe('Terapagos');
    expect(battleName(set('Palafin', 'Choice Band', 'Zero to Hero', [], 'Jolly', {}))).toBe('Palafin');
  });

  it('Palafin con Choice Band colpisce come Hero (Attacco base 160)', () => {
    const palafin = set('Palafin', 'Choice Band', 'Zero to Hero', ['Wave Crash', 'Close Combat'], 'Jolly', { atk: 252, spe: 252 });
    const asHero = memberOffense({ ...palafin, species: 'Palafin-Hero' }, [{ ...palafin, species: 'Palafin-Hero' }], noStats)!.value;
    expect(memberOffense(palafin, [palafin], noStats)!.value).toBe(asHero);
  });
});
