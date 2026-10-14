import type { EngineData } from '../../src/engine/data';
import type { SpeciesStats } from '../../src/engine/stats';

const entry = (usage: number, item: string, ability: string, moves: string[]): SpeciesStats => ({
  usage, count: 100, abilities: { [ability]: 1 }, items: { [item]: 1 }, teraTypes: {},
  moves: Object.fromEntries(moves.map(m => [m, 1])), spreads: { 'Jolly:0/252/0/0/4/252': 1 },
  teammates: {}, checks: {},
});

export const megaData: EngineData = {
  stats: {
    meta: { month: '2026-09', cutoff: 1630, battles: 1 },
    pokemon: {
      'Lopunny-Mega': entry(0.07, 'lopunnite', 'scrappy', ['fakeout', 'highjumpkick']),
      'Charizard-Mega-Y': entry(0.05, 'charizarditey', 'drought', ['flamethrower', 'solarbeam']),
      'Great Tusk': entry(0.15, 'boosterenergy', 'protosynthesis', ['headlongrush', 'rapidspin']),
    },
  },
  sets: {},
};
