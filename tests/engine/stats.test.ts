import { describe, expect, it } from 'vitest';
import chaos from '../fixtures/chaos.json';
import {
  checkScore, checkValueScore, metaTypeWeights, reduceChaos, teammatePct, topThreats, usageOf,
  type ChaosFile, type StatsData,
} from '../../src/engine/stats';

const pokemon = reduceChaos(chaos as unknown as ChaosFile);
const stats: StatsData = { meta: { month: '2026-09', cutoff: 1695, battles: 1000 }, pokemon };

describe('reduceChaos', () => {
  it('scarta i Pokémon sotto lo 0.1% di uso', () => {
    expect(pokemon.Pikachu).toBeUndefined();
    expect(pokemon.Garchomp).toBeDefined();
  });

  it('normalizza le quote sul totale delle abilità', () => {
    expect(pokemon['Great Tusk'].count).toBe(1000);
    expect(pokemon['Great Tusk'].moves.headlongrush).toBeCloseTo(0.95);
    expect(pokemon['Great Tusk'].moves['']).toBeUndefined();
    expect(pokemon['Great Tusk'].teammates.Gholdengo).toBeCloseTo(0.3);
  });

  it('tipi Tera con iniziale maiuscola e senza "nothing"', () => {
    expect(pokemon['Great Tusk'].teraTypes.Steel).toBeCloseTo(0.6);
    expect(pokemon.Gholdengo.teraTypes).toEqual({});
  });

  it('punteggio checks = p - 4d, sia oggetto sia array', () => {
    expect(checkValueScore({ n: 40, p: 0.8, d: 0.03 })).toBeCloseTo(0.68);
    expect(checkValueScore([40, 0.8, 0.03])).toBeCloseTo(0.68);
    expect(pokemon['Great Tusk'].checks.Corviknight).toBeCloseTo(0.68);
  });
});

describe('accessi alle statistiche', () => {
  it('uso e compagni di team', () => {
    expect(usageOf(stats, 'Kingambit')).toBe(0.2);
    expect(usageOf(stats, 'Nessuno')).toBe(0);
    expect(usageOf(null, 'Kingambit')).toBe(0);
    expect(teammatePct(stats, 'Gholdengo', 'Great Tusk')).toBeCloseTo(0.375);
  });

  it('checkScore: null se la minaccia non ha dati di checks', () => {
    expect(checkScore(stats, 'Great Tusk', 'Corviknight')).toBeCloseTo(0.68);
    expect(checkScore(stats, 'Great Tusk', 'Kingambit')).toBe(0);
    expect(checkScore(stats, 'Garchomp', 'Corviknight')).toBeNull();
    expect(checkScore(stats, 'Sconosciuto', 'Corviknight')).toBeNull();
  });

  it('topThreats ordina per uso, esclude il team e i nomi sconosciuti', () => {
    expect(topThreats(stats, 3, ['Great Tusk'])).toEqual(['Gholdengo', 'Kingambit', 'Dragapult']);
    expect(topThreats(stats, 20, [])).not.toContain('Fakemon-Xyz');
  });

  it('pesi dei tipi nel meta', () => {
    const weights = metaTypeWeights(stats);
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1);
    expect(weights.Ground).toBeGreaterThan(0);
    expect(weights.Fire).toBe(0);
    expect(metaTypeWeights(null).Fire).toBeCloseTo(1 / 18);
  });
});
