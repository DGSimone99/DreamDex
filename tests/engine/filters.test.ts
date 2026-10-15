import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { activeFilterCount, EMPTY_FILTERS, isFiltering, searchCandidates, tierLabel, type CandidateFilters } from '../../src/engine/filters';
import { mostCommonSet } from '../../src/engine/sets';
import { fixtureData, tusk } from '../fixtures/data';
import { megaData } from '../fixtures/megaData';

const search = (patch: Partial<CandidateFilters>, data = fixtureData, team = [tusk]) =>
  searchCandidates(team, DEFAULT_FORMAT, data, { ...EMPTY_FILTERS, ...patch }, 500).map(s => s.species);
const sorted = (xs: string[]) => [...xs].sort();

describe('stato dei filtri', () => {
  it('conta i filtri attivi, esclusa la ricerca', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, types: ['Water', 'Fire'], mega: 'none', query: 'x' })).toBe(2);
    expect(activeFilterCount({ ...EMPTY_FILTERS, tier: 'uber' })).toBe(1);
    expect(isFiltering(EMPTY_FILTERS)).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTERS, query: ' ' })).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTERS, query: 'gar' })).toBe(true);
  });
});

describe('ricerca su tutto il Pokédex', () => {
  it('per nome, ignorando la soglia di uso minimo', () => {
    expect(sorted(search({ query: 'garch' }))).toEqual(['Garchomp', 'Garchomp-Mega']);
    expect(search({ query: 'gengar' }).some(n => n.endsWith('Gmax'))).toBe(false);
  });

  it('trova anche Pokémon senza dati Smogon', () => {
    expect(search({ query: 'leafe' })).toEqual(['Leafeon']);
  });

  it('include gli Uber; esclude i membri del team, i CAP e le forme solo in battaglia', () => {
    expect(search({ query: 'dragapult' })).toEqual(['Dragapult']);
    expect(search({ query: 'great tusk' })).toEqual([]);
    expect(search({ query: 'pajantom' })).toEqual([]);
    expect(search({ query: 'aegislash' })).toEqual(['Aegislash']);
  });

  it('Ghost + Dragon trova tutti, anche Uber e non evoluti', () => {
    expect(sorted(search({ types: ['Ghost', 'Dragon'] })))
      .toEqual(['Dragapult', 'Drakloak', 'Dreepy', 'Giratina', 'Giratina-Origin']);
  });
});

describe('filtro tier', () => {
  const ghostDragon = (tier: CandidateFilters['tier']) => sorted(search({ types: ['Ghost', 'Dragon'], tier }));

  it('Uber e AG', () => expect(ghostDragon('uber')).toEqual(['Dragapult', 'Giratina', 'Giratina-Origin']));
  it('legali in National Dex OU', () => expect(ghostDragon('legal')).toEqual(['Drakloak', 'Dreepy']));
  it('non evoluti', () => expect(ghostDragon('nfe')).toEqual(['Drakloak', 'Dreepy']));
  it('OU', () => expect(search({ query: 'great', tier: 'ou' }, fixtureData, [])).toEqual(['Great Tusk']));

  it('etichetta del tier', () => {
    expect(tierLabel('Dragapult', DEFAULT_FORMAT)).toEqual({ label: 'Uber', banned: true });
    expect(tierLabel('Great Tusk', DEFAULT_FORMAT)).toEqual({ label: 'OU', banned: false });
    expect(tierLabel('Dreepy', DEFAULT_FORMAT)).toEqual({ label: 'LC', banned: false });
    expect(tierLabel('Drakloak', DEFAULT_FORMAT)).toEqual({ label: 'NFE', banned: false });
  });
});

describe('filtri', () => {
  const common = { usage: 'common' as const };

  it('tipo', () => {
    expect(sorted(search({ ...common, types: ['Water'] }))).toEqual(['Rotom-Wash', 'Toxapex']);
  });

  it('due tipi: devono esserci entrambi', () => {
    expect(search({ ...common, types: ['Water', 'Poison'] })).toEqual(['Toxapex']);
    expect(search({ types: ['Water', 'Fire'] })).toContain('Volcanion');
    expect(search({ ...common, types: ['Water', 'Fire'] })).toEqual([]);
  });

  it('ruolo', () => {
    expect(sorted(search({ ...common, roles: ['pivot'] }))).toEqual(['Corviknight', 'Dragapult', 'Rotom-Wash']);
  });

  it('più ruoli: devono esserci tutti', () => {
    expect(search({ ...common, roles: ['pivot', 'physicalWall'] })).toEqual(['Corviknight']);
  });

  it('resiste a', () => {
    expect(sorted(search({ ...common, resists: ['Ground'] }))).toEqual(['Corviknight', 'Rotom-Wash']);
  });

  it('resiste a più tipi: tutti', () => {
    expect(search({ ...common, resists: ['Ground', 'Fire'] })).toEqual(['Rotom-Wash']);
  });

  it('leggendari e mitici: tutti, esclusi o solo', () => {
    expect(search({ query: 'zapdos' })).toContain('Zapdos');
    expect(search({ query: 'zapdos', legendary: 'none' })).not.toContain('Zapdos');
    expect(search({ query: 'garchomp', legendary: 'only' })).toEqual([]);
    expect(search({ query: 'mew', mythical: 'only' })).toContain('Mew');
    expect(search({ query: 'mew', mythical: 'only' })).not.toContain('Mewtwo');
    expect(search({ query: 'mew', mythical: 'none' })).not.toContain('Mew');
  });

  it('fino alla generazione: le Mega contano come la specie base', () => {
    expect(search({ query: 'garch', maxGen: 3 })).toEqual([]);
    expect(sorted(search({ query: 'garch', maxGen: 4 }))).toEqual(['Garchomp', 'Garchomp-Mega']);
  });

  it('colpisce super efficace', () => {
    expect(search({ ...common, hits: ['Water'] })).toEqual(['Rotom-Wash']);
  });

  it('porta una condizione e Mega', () => {
    const team = [mostCommonSet(megaData.stats, 'Great Tusk')!];
    expect(search({ ...common, provides: 'sun' }, megaData, team)).toEqual(['Charizard-Mega-Y']);
    expect(sorted(search({ ...common, mega: 'only' }, megaData, team))).toEqual(['Charizard-Mega-Y', 'Lopunny-Mega']);
    expect(search({ ...common, mega: 'none' }, megaData, team)).toEqual([]);
  });

  it('uso nel meta', () => {
    expect(sorted(search(common))).toEqual(['Corviknight', 'Dragapult', 'Gholdengo', 'Kingambit', 'Rotom-Wash', 'Toxapex']);
    expect(sorted(search({ query: 'garch', usage: 'niche' }))).toEqual(['Garchomp', 'Garchomp-Mega']);
  });

  it('ordinati per adattamento al team', () => {
    const scores = searchCandidates([tusk], DEFAULT_FORMAT, fixtureData, { ...EMPTY_FILTERS, ...common }).map(s => s.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe('Monotype nella ricerca', () => {
  it('controlla il tipo della forma in battaglia (Mega)', () => {
    const data = { ...megaData, stats: { ...megaData.stats!, pokemon: { ...megaData.stats!.pokemon, Charizard: { ...megaData.stats!.pokemon['Charizard-Mega-Y'], items: { charizarditex: 1 } } } } };
    const flying = { ...DEFAULT_FORMAT, monotype: 'Flying' as const };
    const names = searchCandidates([], flying, data, { ...EMPTY_FILTERS, query: 'charizard' }).map(s => s.species);
    expect(names).not.toContain('Charizard');
    expect(names).toContain('Charizard-Mega-Y');
  });
});
