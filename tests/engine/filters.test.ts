import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { activeFilterCount, EMPTY_FILTERS, isFiltering, searchCandidates, type CandidateFilters } from '../../src/engine/filters';
import { mostCommonSet } from '../../src/engine/sets';
import { fixtureData, tusk } from '../fixtures/data';
import { megaData } from '../fixtures/megaData';

const search = (patch: Partial<CandidateFilters>, data = fixtureData, team = [tusk]) =>
  searchCandidates(team, DEFAULT_FORMAT, data, { ...EMPTY_FILTERS, ...patch }).map(s => s.species);
const sorted = (xs: string[]) => [...xs].sort();

describe('stato dei filtri', () => {
  it('conta i filtri attivi, esclusa la ricerca', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, types: ['Water', 'Fire'], mega: 'none', query: 'x' })).toBe(2);
    expect(isFiltering(EMPTY_FILTERS)).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTERS, query: ' ' })).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTERS, query: 'gar' })).toBe(true);
  });
});

describe('ricerca', () => {
  it('per nome, ignorando la soglia di uso minimo', () => {
    expect(sorted(search({ query: 'garch' }))).toEqual(['Garchomp', 'Garchomp-Mega']);
    expect(search({ query: 'gar' })).toContain('Garchomp');
    expect(search({ query: 'gengar' }).some(n => n.endsWith('Gmax'))).toBe(false);
  });

  it('trova anche Pokémon senza dati Smogon', () => {
    expect(search({ query: 'leafe' })).toEqual(['Leafeon']);
  });

  it('esclude i membri del team e i Pokémon non legali', () => {
    expect(search({ query: 'great tusk' })).toEqual([]);
    expect(search({ query: 'dragapult' })).toEqual([]); // Uber in National Dex
  });
});

describe('filtri', () => {
  it('tipo', () => {
    expect(sorted(search({ types: ['Water'] }))).toEqual(['Rotom-Wash', 'Toxapex']);
  });

  it('due tipi: devono esserci entrambi', () => {
    expect(search({ types: ['Water', 'Poison'] })).toEqual(['Toxapex']);
    expect(search({ types: ['Water', 'Fire'] })).toEqual([]);
  });

  it('ruolo', () => {
    expect(sorted(search({ roles: ['pivot'] }))).toEqual(['Corviknight', 'Rotom-Wash']);
  });

  it('più ruoli: devono esserci tutti', () => {
    expect(search({ roles: ['pivot', 'physicalWall'] })).toEqual(['Corviknight']);
  });

  it('resiste a', () => {
    expect(sorted(search({ resists: 'Ground' }))).toEqual(['Corviknight', 'Rotom-Wash']);
  });

  it('colpisce super efficace', () => {
    expect(search({ hits: 'Water' })).toEqual(['Rotom-Wash']);
  });

  it('porta una condizione e Mega', () => {
    const team = [mostCommonSet(megaData.stats, 'Great Tusk')!];
    expect(search({ provides: 'sun' }, megaData, team)).toEqual(['Charizard-Mega-Y']);
    expect(sorted(search({ mega: 'only' }, megaData, team))).toEqual(['Charizard-Mega-Y', 'Lopunny-Mega']);
    expect(search({ mega: 'none' }, megaData, team)).toEqual([]);
  });

  it('uso nel meta', () => {
    expect(sorted(search({ usage: 'common' }))).toEqual(['Corviknight', 'Gholdengo', 'Kingambit', 'Rotom-Wash', 'Toxapex']);
    expect(search({ usage: 'niche' })).toEqual(['Garchomp']);
  });

  it('filtri combinati', () => {
    expect(search({ types: ['Water'], roles: ['pivot'] })).toEqual(['Rotom-Wash']);
  });

  it('ordinati per adattamento al team', () => {
    const scores = searchCandidates([tusk], DEFAULT_FORMAT, fixtureData, { ...EMPTY_FILTERS, usage: 'common' }).map(s => s.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});
