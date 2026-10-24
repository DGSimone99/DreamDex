import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { describe, expect, it } from 'vitest';
import { teamArchetype } from '../../src/engine/archetype';
import type { EngineData } from '../../src/engine/data';
import { rateTeam } from '../../src/engine/rating';
import { isStall } from '../../src/engine/roles';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });
const walls = [
  set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Toxic', 'Recover', 'Haze']),
  set('Ferrothorn', 'Leftovers', 'Iron Barbs', ['Spikes', 'Leech Seed', 'Power Whip', 'Knock Off']),
  set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast', 'Soft-Boiled', 'Calm Mind', 'Flamethrower']),
  set('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Defog', 'Roost', 'U-turn']),
  set('Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm', 'Earth Power', 'Stealth Rock', 'Taunt']),
  set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Heal Bell']),
];
const kingambit = set('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head']);

describe('stall e semi-stall', () => {
  it('stall: tutti e 6 i membri passivi', () => {
    expect(isStall(walls, DEFAULT_RULES)).toBe(true);
    expect(teamArchetype(walls, DEFAULT_RULES)?.archetype).toBe('stall');
  });

  it('5 muri e una minaccia offensiva: semi-stall, non stall', () => {
    const team = [...walls.slice(0, 5), kingambit];
    expect(isStall(team, DEFAULT_RULES)).toBe(false);
    expect(teamArchetype(team, DEFAULT_RULES)?.archetype).toBe('semiStall');
  });
});

describe('membri deboli senza utilità: la penalità cresce col loro numero', () => {
  const entry = (usage: number): SpeciesStats => ({ usage, count: 100, abilities: {}, items: {}, teraTypes: {}, spreads: {}, moves: {}, teammates: {}, checks: {} });
  const data: EngineData = { stats: { meta: { month: '2026-09', cutoff: 1630, battles: 1 }, pokemon: { Kingambit: entry(0.3) } }, sets: {} };
  const weak = ['Raticate', 'Linoone', 'Delcatty'].map(s => set(s, 'Leftovers', '', ['Body Slam', 'Crunch']));
  const points = (team: TeamSet[]) => rateTeam(team, data)!.penalty.items.filter(i => /debole e non porta utilità/.test(i.text)).reduce((acc, i) => acc + i.points, 0);

  it('uno −3, due −7, tre −12', () => {
    expect(points([kingambit, weak[0]])).toBe(3);
    expect(points([kingambit, ...weak.slice(0, 2)])).toBe(7);
    expect(points([kingambit, ...weak])).toBe(12);
  });
});
