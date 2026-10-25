import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { activeFilterCount, EMPTY_FILTERS, hasFilterRole, isFiltering, normalizeTypes, searchCandidates, tierLabel, type CandidateFilters } from '../../src/engine/filters';
import { getSpecies } from '../../src/engine/dex';
import { formatRules } from '../../src/engine/formatRules';
import { emptySet, mostCommonSet } from '../../src/engine/sets';
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

  it('mono: solo Pokémon con un tipo', () => {
    const found = search({ types: ['Water'], mono: true });
    expect(found).toContain('Vaporeon');
    expect(found).not.toContain('Toxapex');
    expect(found.every(name => getSpecies(name)?.types.length === 1)).toBe(true);
  });

  it('stesso tipo due volte = monotipo', () => {
    expect(normalizeTypes(['Fire', 'Fire'])).toEqual({ types: ['Fire'], mono: true });
    expect(normalizeTypes(['Fire', 'Water'])).toEqual({ types: ['Fire', 'Water'], mono: false });
  });

  it('Solo preferiti', () => {
    const userLists = { favorites: new Set(['Gholdengo']), bans: new Set<string>(), overridden: new Map(), universal: new Set<string>() };
    const filters = { ...EMPTY_FILTERS, favoritesOnly: true };
    expect(search({ favoritesOnly: true }, { ...fixtureData, userLists })).toEqual(['Gholdengo']);
    expect(activeFilterCount(filters)).toBe(1);
  });

  it('due tipi: devono esserci entrambi', () => {
    expect(search({ ...common, types: ['Water', 'Poison'] })).toEqual(['Toxapex']);
    expect(search({ types: ['Water', 'Fire'] })).toContain('Volcanion');
    expect(search({ ...common, types: ['Water', 'Fire'] })).toEqual([]);
  });

  it('ruolo', () => {
    expect(sorted(search({ ...common, roles: ['pivot'] }))).toEqual(['Corviknight', 'Dragapult', 'Rotom-Wash']);
  });

  it('filtro priorità resta, sulle mosse', () => {
    const rules = formatRules('ou');
    const kingambit = (moves: string[]) => ({ ...emptySet('Kingambit'), moves });
    expect(hasFilterRole(kingambit(['Kowtow Cleave', 'Sucker Punch']), 'priority', rules)).toBe(true);
    expect(hasFilterRole(kingambit(['Kowtow Cleave', 'Iron Head']), 'priority', rules)).toBe(false);
    // Controllo Velocità e setup: anche loro sulle mosse
    expect(hasFilterRole({ ...emptySet('Clefable'), moves: ['Moonblast', 'Thunder Wave'] }, 'speedControl', rules)).toBe(true);
    expect(hasFilterRole({ ...emptySet('Gholdengo'), moves: ['Make It Rain'], item: 'Choice Scarf' }, 'speedControl', rules)).toBe(false);
    expect(hasFilterRole({ ...emptySet('Volcarona'), moves: ['Quiver Dance', 'Fiery Dance'] }, 'setup', rules)).toBe(true);
    expect(hasFilterRole({ ...emptySet('Volcarona'), moves: ['Fiery Dance', 'Roost'] }, 'setup', rules)).toBe(false);
    // Nella ricerca: tutti i trovati hanno una mossa con priorità
    const found = searchCandidates([tusk], DEFAULT_FORMAT, fixtureData, { ...EMPTY_FILTERS, ...common, roles: ['priority'] }, 500);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(s => hasFilterRole(s.set, 'priority', rules))).toBe(true);
  });

  it('più ruoli: devono esserci tutti', () => {
    // Rotom-Wash (252 PS, Bold) supera i 100k di PS x Dif reali: con l'indice di muro è un muro fisico
    expect(sorted(search({ ...common, roles: ['pivot', 'physicalWall'] }))).toEqual(['Corviknight', 'Rotom-Wash']);
  });

  it('resiste a', () => {
    expect(sorted(search({ ...common, resists: ['Ground'] }))).toEqual(['Corviknight', 'Rotom-Wash']);
  });

  it('resiste a più tipi: tutti', () => {
    expect(search({ ...common, resists: ['Ground', 'Fire'] })).toEqual(['Rotom-Wash']);
  });

  it('leggendari e misteriosi insieme: tutti, esclusi o solo', () => {
    expect(search({ query: 'zapdos' })).toContain('Zapdos');
    expect(search({ query: 'zapdos', legendary: 'none' })).not.toContain('Zapdos');
    expect(search({ query: 'garchomp', legendary: 'only' })).toEqual([]);
    expect(search({ query: 'mew', legendary: 'only' })).toContain('Mew');
    expect(search({ query: 'mew', legendary: 'none' })).not.toContain('Mew');
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
