import { describe, expect, it } from 'vitest';
import { coachTeam, describeDiff, HELD_LEVEL } from '../../src/engine/coach';
import { rateTeam } from '../../src/engine/rating';
import type { EngineData } from '../../src/engine/data';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { scoreCandidates } from '../../src/engine/scoring';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';
import { fixtureData } from '../fixtures/data';

const entry = (usage: number, item: string, moves: string[], teammates: Record<string, number> = {}): SpeciesStats => ({
  usage, count: 100, abilities: {}, items: { [item]: 1 }, teraTypes: {}, spreads: {},
  moves: Object.fromEntries(moves.map(m => [m, 1])), teammates, checks: {},
});

describe('Mega scritta in due modi: stesso punteggio', () => {
  const data: EngineData = {
    stats: {
      meta: { month: '2026-09', cutoff: 1630, battles: 1 },
      pokemon: {
        'Lopunny-Mega': entry(0.07, 'lopunnite', ['fakeout', 'highjumpkick'], { 'Great Tusk': 0.4 }),
        'Great Tusk': entry(0.15, 'boosterenergy', ['headlongrush'], { 'Lopunny-Mega': 0.4 }),
      },
    },
    sets: {},
  };
  const tusk = mostCommonSet(data.stats, 'Great Tusk')!;
  const asForme = mostCommonSet(data.stats, 'Lopunny-Mega')!;
  const asStone: TeamSet = { ...asForme, species: 'Lopunny' };
  const fit = (member: TeamSet) => scoreCandidates([tusk], DEFAULT_FORMAT, data, [member]).find(s => s.set === member)!;

  it('fit identico', () => {
    expect(fit(asStone).score).toBe(fit(asForme).score);
    expect(fit(asStone).components.synergy).toBeGreaterThan(0);
  });

  it('la forma Mega del pool non viene valutata una seconda volta', () => {
    const list = scoreCandidates([tusk], DEFAULT_FORMAT, data, [asStone]);
    expect(list.filter(s => s.species === 'Lopunny-Mega' || s.species === 'Lopunny')).toHaveLength(1);
  });
});

describe('difesa retta poco anche se qualcuno regge in parte: i rimedi ci sono', () => {
  it('Psychic: livello sotto 50 nella Coverage tipi, Corviknight proposto', () => {
    const data: EngineData = {
      stats: {
        meta: { month: '2026-09', cutoff: 1630, battles: 1 },
        pokemon: { Corviknight: entry(0.1, 'leftovers', ['bravebird', 'defog']) },
      },
      sets: {},
    };
    const team = ['Great Tusk', 'Dragapult', 'Garchomp', 'Gholdengo', 'Blissey', 'Rotom-Wash'].map(emptySet);
    const row = rateTeam(team, data, 'it')!.defense.coverageTypes.rows.find(r => r.type === 'Psychic')!;
    expect(row.level).toBeLessThan(HELD_LEVEL);
    expect(row.level).toBeGreaterThan(0);
    const psychic = coachTeam(team, DEFAULT_FORMAT, data).problems.find(p => p.key === 'defense:Psychic')!;
    expect(psychic).toMatchObject({ severity: 'minor', text: 'Coperto poco in difesa contro Psychic: pochi reggono bene i suoi colpi' });
    expect(psychic.fixes).toEqual(['Corviknight']);
  });
});

describe('vantaggi e svantaggi', () => {
  it('separa guadagni e perdite', () => {
    const diff = { gains: { roles: ['pivot' as const], covers: [], resists: ['Ground' as const] }, losses: { roles: [], covers: ['Fire' as const], resists: [] }, lostResists: [] };
    expect(describeDiff(diff)).toEqual({ pros: ['Pivot', 'Resistente a Ground'], cons: ['Non più forte contro Fire'] });
  });

  it('raggruppa copre/resiste e le perdite', () => {
    const diff = { gains: { roles: ['removal' as const], covers: ['Normal' as const, 'Grass' as const, 'Ice' as const], resists: [] }, losses: { roles: ['hazards' as const], covers: [], resists: ['Dark' as const] }, lostResists: [] };
    expect(describeDiff(diff)).toEqual({
      pros: ['Controllo Hazard', 'Forte contro Normal, Grass, Ice'],
      cons: ['Hazard', 'Non più resistente a Dark'],
    });
  });
});
