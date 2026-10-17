import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { battleName } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { EMPTY_FILTERS, searchCandidates } from '../../src/engine/filters';
import { defaultSet, emptySet, presetsFor, presetsForSet, sameSet } from '../../src/engine/sets';

const preset = (name: string, species: string, item: string, moves: string[]) =>
  ({ name, format: 'gen9nationaldex', set: { ...emptySet(species), item, moves } });
const data: EngineData = {
  stats: null, sets: {},
  presets: {
    Gardevoir: [preset('Offensive', 'Gardevoir', 'Gardevoirite', ['Hyper Voice']), preset('Choice Scarf', 'Gardevoir', 'Choice Scarf', ['Moonblast']), preset('Support', 'Gardevoir', 'Gardevoirite', ['Wish'])],
    Charizard: [preset('Drought', 'Charizard', 'Charizardite Y', ['Fire Blast']), preset('Dragon Dance', 'Charizard', 'Charizardite X', ['Dragon Dance']), preset('Specs', 'Charizard', 'Choice Specs', ['Flamethrower'])],
  },
};

describe('forma base e Mega separate', () => {
  it('i preset della forma base sono senza pietra, quelli della Mega solo con la sua pietra', () => {
    expect(presetsFor(data, 'Gardevoir').map(p => p.name)).toEqual(['Choice Scarf']);
    expect(presetsFor(data, 'Gardevoir-Mega').map(p => p.name)).toEqual(['Offensive', 'Support']);
  });

  it('Charizard: la Mega X ha solo la Charizardite X, la Mega Y solo la Y, la base nessuna delle due', () => {
    expect(presetsFor(data, 'Charizard-Mega-X').map(p => p.name)).toEqual(['Dragon Dance']);
    expect(presetsFor(data, 'Charizard-Mega-Y').map(p => p.name)).toEqual(['Drought']);
    expect(presetsFor(data, 'Charizard').map(p => p.name)).toEqual(['Specs']);
  });

  it('il set di riferimento della forma base non tiene la pietra; quello della Mega sì', () => {
    expect(battleName(defaultSet(data, 'Gardevoir'))).toBe('Gardevoir');
    expect(battleName(defaultSet(data, 'Gardevoir-Mega'))).toBe('Gardevoir-Mega');
  });

  it("nell'editor i preset seguono la forma del set: con la pietra quelli Mega (e il set viene riconosciuto)", () => {
    const mega = defaultSet(data, 'Gardevoir-Mega');
    expect(presetsForSet(data, mega).map(p => p.name)).toEqual(['Offensive', 'Support']);
    expect(presetsForSet(data, mega).some(p => sameSet(p.set, mega))).toBe(true);
    expect(presetsForSet(data, { ...mega, item: 'Leftovers' }).map(p => p.name)).toEqual(['Choice Scarf']);
  });

  it('nella ricerca la forma base e la Mega sono due voci, ciascuna col suo nome', () => {
    const results = searchCandidates([emptySet('Great Tusk')], DEFAULT_FORMAT, data, { ...EMPTY_FILTERS, query: 'gardevoir' }, 10);
    expect(results.map(s => s.species).sort()).toEqual(['Gardevoir', 'Gardevoir-Mega']);
    for (const s of results) expect(battleName(s.set)).toBe(s.species);
  });

  it('se le statistiche della forma base hanno la pietra, si preferisce un preset senza pietra di un altro formato', () => {
    const withStats: EngineData = {
      ...data, presets: {},
      fallbackPresets: { Lopunny: [{ name: 'Utility', format: 'gen9ou', set: { ...emptySet('Lopunny'), item: 'Assault Vest', moves: ['Fake Out'] } }] },
      stats: { meta: { month: '2026-09', cutoff: 1630, battles: 1 }, pokemon: { Lopunny: { usage: 0.01, count: 1, abilities: {}, items: { lopunnite: 1 }, teraTypes: {}, spreads: {}, moves: { fakeout: 1 }, teammates: {}, checks: {} } } },
    };
    expect(defaultSet(withStats, 'Lopunny').item).toBe('Assault Vest');
  });
});
