import { describe, expect, it } from 'vitest';
import { memberPower, teamPower } from '../../src/engine/power';
import { emptySet, type TeamSet } from '../../src/engine/sets';

const set = (species: string, item = ''): TeamSet => ({ ...emptySet(species), item });

describe('forza dalle statistiche base', () => {
  it('offesa e robustezza sono percentili 0–100', () => {
    const tusk = memberPower(set('Great Tusk'))!;
    for (const v of [tusk.offense, tusk.bulk, tusk.power]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('un attaccante forte ha offesa alta, un wall ha robustezza alta', () => {
    expect(memberPower(set('Great Tusk'))!.offense).toBeGreaterThanOrEqual(75);
    expect(memberPower(set('Blissey'))!.bulk).toBeGreaterThanOrEqual(90);
    expect(memberPower(set('Blissey'))!.offense).toBeLessThan(25);
  });

  it('il lato forte pesa di più: un wall non affonda per l\'attacco basso', () => {
    const blissey = memberPower(set('Blissey'))!;
    expect(blissey.power).toBe(Math.round(0.65 * Math.max(blissey.offense, blissey.bulk) + 0.35 * Math.min(blissey.offense, blissey.bulk)));
    expect(blissey.power).toBeGreaterThan(60);
  });

  it('un Pokémon debole ha forza bassa', () => {
    expect(memberPower(set('Magikarp'))!.power).toBeLessThan(10);
  });

  it('una Mega usa le statistiche della forma Mega', () => {
    expect(memberPower(set('Lopunny', 'Lopunnite'))!.offense).toBeGreaterThan(memberPower(set('Lopunny'))!.offense);
  });

  it('Pokémon sconosciuto: nessun valore', () => {
    expect(memberPower(set('Fakemon-Xyz'))).toBeNull();
  });

  it('forza del team = media dei membri conosciuti', () => {
    const team = [set('Great Tusk'), set('Blissey'), set('Fakemon-Xyz')];
    const result = teamPower(team);
    const known = result.members.map(m => m.power);
    expect(result.members.map(m => m.species)).toEqual(['Great Tusk', 'Blissey']);
    expect(result.value).toBe(Math.round((known[0] + known[1]) / 2));
    expect(teamPower([set('Fakemon-Xyz')]).value).toBeNull();
  });
});
