import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { improveReplacements, keepersFirst } from '../../src/engine/replace';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { neededConditions } from '../../src/engine/synergy';
import { adviceOf } from '../helpers/coach';

const entry = (usage: number, ability: string, moves: string[]): SpeciesStats => ({
  usage, count: 100, abilities: { [ability]: 1 }, items: {}, teraTypes: {}, spreads: {},
  moves: Object.fromEntries(moves.map(m => [m, 1])), teammates: {}, checks: {},
});
const withSetter: EngineData = {
  stats: {
    meta: { month: '2026-09', cutoff: 1630, battles: 1 },
    pokemon: {
      Torkoal: entry(0.04, 'drought', ['lavaplume', 'stealthrock']),
      Venusaur: entry(0.05, 'chlorophyll', ['gigadrain', 'sludgebomb']),
      Garchomp: entry(0.13, 'roughskin', ['earthquake', 'dragontail']),
    },
  },
  sets: {},
};
const noSetter: EngineData = {
  ...withSetter,
  stats: { ...withSetter.stats!, pokemon: { Garchomp: withSetter.stats!.pokemon.Garchomp } },
};

const set = (species: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), ability, moves });
const ninetales = set('Ninetales', 'Drought', ['Flamethrower']);
const leafeon = set('Leafeon', 'Chlorophyll', ['Leaf Blade']);
const tusk = set('Great Tusk', 'Protosynthesis', ['Headlong Rush']);
const format = { ...DEFAULT_FORMAT, minUsage: 0 };

describe('condizioni di cui il team ha bisogno', () => {
  it('Ninetales porta il sole e Leafeon ne ha bisogno', () => {
    expect(neededConditions([ninetales, leafeon], 0)).toEqual([
      { condition: 'sun', beneficiaries: [{ species: 'Leafeon', via: 'Chlorophyll' }] },
    ]);
  });

  it('i Paradox non contano: funzionano anche senza', () => {
    expect(neededConditions([ninetales, tusk], 0)).toEqual([]);
  });

  it('chi ne beneficia lo porta già da sé (Charizard Mega Y con Drought): nessun vincolo', () => {
    const zard = { ...set('Charizard', 'Drought', ['Solar Beam']), item: 'Charizardite Y' };
    expect(neededConditions([ninetales, zard], 0)).toEqual([]);
  });

  it('un altro membro porta lo stesso meteo: nessun vincolo', () => {
    expect(neededConditions([ninetales, leafeon, set('Torkoal', 'Drought', ['Lava Plume'])], 0)).toEqual([]);
  });

  it('nessuno ne beneficia: nessun vincolo', () => {
    expect(neededConditions([ninetales, set('Garchomp', 'Rough Skin', ['Earthquake'])], 0)).toEqual([]);
  });
});

describe('sostituire un weather setter', () => {
  it('i sostituti mettono in cima chi porta la stessa condizione, senza escludere gli altri', () => {
    for (const list of [improveReplacements([ninetales, leafeon], 0, format, withSetter)]) {
      expect(list[0].species).toBe('Torkoal');
      expect(list[0].keeps).toBe(true);
      expect(list.find(r => r.species === 'Garchomp')?.keeps).toBe(false);
    }
  });

  it('keepersFirst: chi porta la condizione resta in cima anche dopo l\'ordine per voto', () => {
    const list = [{ species: 'A', keeps: false }, { species: 'B', keeps: true }, { species: 'C' }, { species: 'D', keeps: true }];
    expect(keepersFirst(list).map(x => x.species)).toEqual(['B', 'D', 'A', 'C']);
  });

  it('senza beneficiari nessun vincolo', () => {
    expect(improveReplacements([ninetales, set('Garchomp', 'Rough Skin', ['Earthquake'])], 0, format, withSetter).map(r => r.species).sort())
      .toEqual(['Torkoal', 'Venusaur']);
  });

  it('se nessun candidato porta la condizione, suggerimenti normali', () => {
    expect(improveReplacements([ninetales, leafeon], 0, format, noSetter).map(r => r.species)).toEqual(['Garchomp']);
  });

  it('il coaching ordina per voto: chi non porta la condizione può comparire, il voto ne tiene conto', () => {
    const team = [ninetales, leafeon, set('Garchomp', 'Rough Skin', ['Earthquake'])];
    const fixes = adviceOf(team, format, withSetter).fixes.filter(f => f.member === 'Ninetales');
    expect(fixes.every(f => f.gain > 0)).toBe(true);
  });
});
