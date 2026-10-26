import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { improveReplacements, similarReplacements } from '../../src/engine/replace';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { enables, neededConditions } from '../../src/engine/synergy';

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

  it('nessuno ne beneficia: nessun vincolo', () => {
    expect(neededConditions([ninetales, set('Garchomp', 'Rough Skin', ['Earthquake'])], 0)).toEqual([]);
  });
});

describe('sostituire un weather setter', () => {
  it('migliora team e sostituto simile propongono solo chi porta la stessa condizione', () => {
    expect(improveReplacements([ninetales, leafeon], 0, format, withSetter).map(r => r.species)).toEqual(['Torkoal']);
    expect(similarReplacements([ninetales, leafeon], 0, format, withSetter).map(r => r.species)).toEqual(['Torkoal']);
  });

  it('senza beneficiari nessun vincolo', () => {
    expect(improveReplacements([ninetales, set('Garchomp', 'Rough Skin', ['Earthquake'])], 0, format, withSetter).map(r => r.species).sort())
      .toEqual(['Torkoal', 'Venusaur']);
  });

  it('se nessun candidato porta la condizione, suggerimenti normali', () => {
    expect(improveReplacements([ninetales, leafeon], 0, format, noSetter).map(r => r.species)).toEqual(['Garchomp']);
  });

  it('il coaching non propone di sostituire il setter con chi non porta la condizione', () => {
    const team = [ninetales, leafeon, set('Garchomp', 'Rough Skin', ['Earthquake'])];
    for (const data of [withSetter, noSetter]) {
      for (const fix of coachTeam(team, format, data).fixes.filter(f => f.member === 'Ninetales')) {
        expect(enables({ ...emptySet(fix.species), ability: 'Drought' }).length).toBeGreaterThan(0);
        expect(fix.species).toBe('Torkoal');
      }
    }
  });
});
