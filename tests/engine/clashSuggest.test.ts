import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { scoreCandidates } from '../../src/engine/scoring';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { clashesWith } from '../../src/engine/synergy';

const entry = (usage: number, ability: string, moves: string[]): SpeciesStats => ({
  usage, count: 100, abilities: { [ability]: 1 }, items: {}, teraTypes: {}, spreads: {},
  moves: Object.fromEntries(moves.map(m => [m, 1])), teammates: {}, checks: {},
});
const data: EngineData = {
  stats: {
    meta: { month: 'm', cutoff: 1, battles: 1 },
    pokemon: {
      Pelipper: entry(0.05, 'drizzle', ['hurricane', 'uturn']),
      Kingdra: entry(0.05, 'sniper', ['hydropump', 'dracometeor']),
      Torkoal: entry(0.05, 'drought', ['lavaplume']),
      Garchomp: entry(0.1, 'roughskin', ['earthquake']),
    },
  },
  sets: {},
};
const set = (species: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), ability, moves });
const ninetales = set('Ninetales', 'Drought', ['Flamethrower']);
const format = { ...DEFAULT_FORMAT, minUsage: 0 };
const byName = (name: string) => scoreCandidates([ninetales], format, data).find(s => s.species === name)!;

describe('conflitti di meteo nei suggerimenti', () => {
  it('chi porta un meteo diverso è in conflitto con il setter del team', () => {
    expect(clashesWith(set('Pelipper', 'Drizzle', []), [ninetales])).toEqual(['Ninetales (Drought)']);
    expect(clashesWith(set('Torkoal', 'Drought', []), [ninetales])).toEqual([]);
  });

  it('meteo in conflitto: −5 e tag di avviso', () => {
    const pelipper = byName('Pelipper');
    expect(pelipper.penalty).toBe(5);
    expect(pelipper.tags).toContain('⚠ Meteo in conflitto con Ninetales (Drought)');
  });

  it('mosse indebolite dal meteo del team: −3 se STAB', () => {
    const kingdra = byName('Kingdra');
    expect(kingdra.penalty).toBe(3);
    expect(kingdra.tags).toContain('⚠ Il sole di Ninetales indebolisce le sue mosse Water');
  });

  it('nessun conflitto: nessuna penalità', () => {
    expect(byName('Torkoal').penalty).toBe(0);
    expect(byName('Garchomp').penalty).toBe(0);
  });

  it('la penalità abbassa il punteggio e compare tra le motivazioni', () => {
    const pelipper = byName('Pelipper');
    expect(pelipper.reasons.map(r => r.text)).toContain('⚠ Meteo in conflitto con Ninetales (Drought)');
    const alone = scoreCandidates([set('Garchomp', 'Rough Skin', ['Earthquake'])], format, data).find(s => s.species === 'Pelipper')!;
    expect(alone.penalty).toBe(0);
  });
});
