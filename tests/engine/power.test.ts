import { describe, expect, it } from 'vitest';
import { hitQuality, memberPower, teamPower } from '../../src/engine/power';
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

describe('forza con membri passivi (stall)', () => {
  it('per i passivi conta solo la robustezza', () => {
    const team = [set('Blissey'), set('Great Tusk')];
    const blissey = memberPower(team[0])!;
    const tusk = memberPower(team[1])!;
    expect(teamPower(team, [true, false]).value).toBe(Math.round((blissey.bulk + tusk.power) / 2));
    expect(teamPower(team).value).toBe(Math.round((blissey.power + tusk.power) / 2));
  });
});

describe('forza dal tipo di attacchi del set', () => {
  const withMoves = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });

  it("l'offesa usa la statistica che il set sfrutta", () => {
    const special = memberPower(withMoves('Alakazam', ['Psychic', 'Focus Blast']))!;
    const physical = memberPower(withMoves('Alakazam', ['Close Combat', 'Body Slam']))!;
    expect(physical.offense).toBeLessThan(special.offense);
  });

  it('senza attacchi o con set misto conta la migliore delle due', () => {
    expect(memberPower(withMoves('Alakazam', ['Recover'])))
      .toEqual(memberPower(withMoves('Alakazam', ['Psychic', 'Close Combat'])));
  });
});

describe('qualità di un colpo', () => {
  const withMoves = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });
  const q = (species: string, move: string) => hitQuality(withMoves(species, [move]), move);

  it('piena per chi ha la statistica giusta, ridotta (mai sotto 0,4) per chi non ce l\'ha', () => {
    expect(q('Great Tusk', 'Close Combat')).toBe(1);
    expect(q('Alakazam', 'Close Combat')).toBeLessThan(1);
    expect(q('Alakazam', 'Close Combat')).toBeGreaterThanOrEqual(0.4);
  });

  it('Body Press usa la Difesa, Seismic Toss e Foul Play hanno valori fissi', () => {
    expect(q('Corviknight', 'Body Press')).toBe(1);
    expect(q('Blissey', 'Seismic Toss')).toBe(0.6);
    expect(q('Mandibuzz', 'Foul Play')).toBe(0.7);
  });
});
