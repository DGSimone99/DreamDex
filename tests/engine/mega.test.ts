import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { describe, expect, it } from 'vitest';
import { analyzeTeam, checksThreat } from '../../src/engine/analysis';
import type { EngineData } from '../../src/engine/data';
import { battleSpecies } from '../../src/engine/dex';
import { detectRoles } from '../../src/engine/roles';
import type { TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { defensiveMultiplier } from '../../src/engine/types';

const set = (species: string, item: string, ability = '', moves: string[] = []): TeamSet =>
  ({ species, item, ability, moves, nature: 'Serious', evs: {} });

const lopunny = set('Lopunny', 'Lopunnite', 'Limber', ['Fake Out', 'High Jump Kick']);

const entry = (usage: number, checks: Record<string, number> = {}): SpeciesStats => ({
  usage, count: 100, abilities: {}, items: {}, moves: {}, teraTypes: {}, spreads: {}, teammates: {}, checks,
});

const data: EngineData = {
  stats: {
    meta: { month: '2026-09', cutoff: 1630, battles: 1 },
    pokemon: {
      'Lopunny-Mega': entry(0.07),
      Gholdengo: entry(0.17, { 'Lopunny-Mega': 0.6 }),
    },
  },
  sets: {},
};

describe('Mega Evoluzioni e forme Primal', () => {
  it('specie base + pietra = forma Mega in battaglia', () => {
    expect(battleSpecies(lopunny)?.name).toBe('Lopunny-Mega');
    expect(battleSpecies(set('Lopunny', 'Leftovers'))?.name).toBe('Lopunny');
    expect(battleSpecies(set('Charizard', 'Charizardite Y'))?.name).toBe('Charizard-Mega-Y');
    expect(battleSpecies(set('Groudon', 'Red Orb'))?.name).toBe('Groudon-Primal');
    expect(battleSpecies(set('Kyogre', 'Red Orb'))?.name).toBe('Kyogre');
    // Le forme regionali non possono Megaevolvere con la pietra della forma base
    expect(battleSpecies(set('Slowbro-Galar', 'Slowbronite'))?.name).toBe('Slowbro-Galar');
    expect(battleSpecies(set('Slowbro', 'Slowbronite'))?.name).toBe('Slowbro-Mega');
  });

  it('tipi della forma Mega (Lopunny-Mega è Normal/Fighting)', () => {
    expect(defensiveMultiplier('Psychic', lopunny)).toBe(2);
    expect(defensiveMultiplier('Psychic', set('Lopunny', 'Leftovers', 'Limber'))).toBe(1);
  });

  it('abilità della forma Mega', () => {
    // Manectric: Lightning Rod lo rende immune a Electric; Mega Manectric ha Intimidate
    expect(defensiveMultiplier('Electric', set('Manectric', 'Leftovers', 'Lightning Rod'))).toBe(0);
    expect(defensiveMultiplier('Electric', set('Manectric', 'Manectite', 'Lightning Rod'))).toBe(0.5);
    // Latias-Mega mantiene Levitate
    expect(defensiveMultiplier('Ground', set('Latias', 'Latiasite', 'Levitate'))).toBe(0);
  });

  it('statistiche base della forma Mega per i ruoli', () => {
    expect(detectRoles(lopunny, DEFAULT_RULES)).toContain('physicalBreaker'); // Lopunny-Mega: Atk 136 (base: 76) → 308 reale
    expect(detectRoles(set('Lopunny', 'Leftovers'), DEFAULT_RULES)).not.toContain('physicalBreaker');
  });

  it('le statistiche Smogon usano il nome della forma Mega', () => {
    expect(checksThreat(data, lopunny, 'Gholdengo')).toBe(true);
    expect(analyzeTeam([lopunny], data).threats.map(t => t.name)).toEqual(['Gholdengo']);
  });
});
