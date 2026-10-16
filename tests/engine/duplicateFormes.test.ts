import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { battleName } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { EMPTY_FILTERS, searchCandidates } from '../../src/engine/filters';
import { suggest } from '../../src/engine/scoring';
import { emptySet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';

const entry = (usage: number, item: string, ability: string, moves: string[]): SpeciesStats => ({
  usage, count: 100, abilities: { [ability]: 1 }, items: { [item]: 1 }, teraTypes: {}, spreads: {},
  moves: Object.fromEntries(moves.map(m => [m, 1])), teammates: {}, checks: {},
});

// Le statistiche Smogon hanno sia Kyogre (Choice Scarf) sia Kyogre-Primal; il primo set delle analisi
// di Kyogre però è la Primal con la Blue Orb, e diventa il suo set di riferimento
const primal = { ...emptySet('Kyogre'), item: 'Blue Orb', ability: 'Drizzle', moves: ['Origin Pulse', 'Ice Beam'] };
const data: EngineData = {
  stats: {
    meta: { month: '2026-09', cutoff: 1630, battles: 1 },
    pokemon: {
      Kyogre: entry(0.04, 'choicescarf', 'drizzle', ['waterspout', 'icebeam']),
      'Kyogre-Primal': entry(0.2, 'blueorb', 'primordialsea', ['originpulse', 'icebeam']),
      Sableye: entry(0.05, 'sablenite', 'prankster', ['knockoff', 'recover']),
      'Sableye-Mega': entry(0.05, 'sablenite', 'magicbounce', ['knockoff', 'recover']),
      'Great Tusk': entry(0.15, 'boosterenergy', 'protosynthesis', ['headlongrush']),
    },
  },
  sets: {},
  presets: { Kyogre: [{ name: 'Primal', format: 'gen9nationaldexubers', set: primal }] },
};
const ubers = { ...DEFAULT_FORMAT, formatId: 'ubers' as const };
const team = [emptySet('Great Tusk')];
const formes = (sets: { set: { species: string; item: string } }[]) => sets.map(s => battleName(s.set));

describe('una sola voce per forma in battaglia', () => {
  it('suggerimenti: Kyogre con la Blue Orb e Kyogre-Primal sono lo stesso Pokémon', () => {
    const list = suggest(team, ubers, data);
    expect(formes(list).filter(f => f === 'Kyogre-Primal')).toHaveLength(1);
    expect(list.find(s => battleName(s.set) === 'Kyogre-Primal')!.species).toBe('Kyogre-Primal');
  });

  it('ricerca per nome: Sableye con la pietra e Mega Sableye sono lo stesso Pokémon', () => {
    const list = searchCandidates(team, ubers, data, { ...EMPTY_FILTERS, query: 'sableye' }, 50);
    expect(formes(list).filter(f => f === 'Sableye-Mega')).toHaveLength(1);
  });
});
