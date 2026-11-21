import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGame } from '../../scripts/fetch-games';

describe('parseGame su una partita di doppio', () => {
  const g = parseGame(readFileSync('tests/scripts/fixtures/doubles.log', 'utf8'))!;
  const mon = (side: 'p1' | 'p2', species: string) => g[side].find(r => r.species === species)!;

  it('legge tutti e due i Pokémon in campo per lato', () => {
    expect(g.p1).toHaveLength(6);
    expect(g.p2).toHaveLength(6);
    expect(mon('p1', 'Incineroar').moves).toEqual(['Fake Out']);
    expect(mon('p1', 'Charizard-Mega-Y').moves).toEqual(['Heat Wave']);
    expect(mon('p2', 'Rillaboom').moves).toEqual(['Grassy Glide']);
  });

  it("le abilità d'ingresso vanno a chi le ha, non al compagno o al bersaglio", () => {
    expect(mon('p1', 'Incineroar').ability).toBe('Intimidate');
    expect(mon('p1', 'Charizard-Mega-Y').ability).toBe('Drought');
    expect(mon('p2', 'Rillaboom').ability).toBe('Grassy Surge');
    expect(mon('p2', 'Flutter Mane').ability).toBeUndefined();
  });

  it('lo strumento consumato è di chi lo perde', () => {
    expect(mon('p2', 'Flutter Mane').item).toBe('Focus Sash');
    expect(mon('p2', 'Rillaboom').item).toBeUndefined();
  });

  it('il vincitore è il giocatore della riga win', () => {
    expect(g.winner).toBe(g.players.p1);
    expect(g.turns).toBe(6);
  });
});
