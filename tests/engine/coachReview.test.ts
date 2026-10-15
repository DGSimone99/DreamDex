import { describe, expect, it } from 'vitest';
import { coachTeam, describeSwap } from '../../src/engine/coach';
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

describe('debolezza seria con tante resistenze: i rimedi ci sono', () => {
  it('Fairy: 3 deboli, 3 resistono, Corviknight proposto', () => {
    const data: EngineData = {
      stats: {
        meta: { month: '2026-09', cutoff: 1630, battles: 1 },
        pokemon: { Corviknight: entry(0.1, 'leftovers', ['bravebird', 'defog']) },
      },
      sets: {},
    };
    const team = ['Great Tusk', 'Dragapult', 'Garchomp', 'Gholdengo', 'Toxapex', 'Heatran'].map(emptySet);
    const fairy = coachTeam(team, DEFAULT_FORMAT, data).problems.find(p => p.text.startsWith('Debole a Fairy'))!;
    expect(fairy.severity).toBe('serious');
    expect(fairy.fixes).toEqual(['Corviknight']);
  });
});

describe('sostituzioni distinte', () => {
  it('le due sostituzioni propongono Pokémon diversi', () => {
    const junk = (s: string): TeamSet => ({ ...emptySet(s), moves: ['Splash'] });
    const swaps = coachTeam(['Magikarp', 'Caterpie', 'Weedle', 'Metapod', 'Kakuna', 'Sunkern'].map(junk), DEFAULT_FORMAT, fixtureData).swaps;
    expect(swaps).toHaveLength(2);
    expect(swaps[0].replacement).not.toBe(swaps[1].replacement);
  });
});

describe('vantaggi e svantaggi', () => {
  it('separa guadagni e perdite', () => {
    const swap = { index: 0, member: 'Magikarp', fit: 20, replacement: 'Corviknight', set: emptySet('Corviknight'), score: 60, similar: false, level: 'recommended' as const,
      diff: { gains: ['+ Pivot', '+ resiste Ground'], losses: ['- copre Fire'] } };
    expect(describeSwap(swap)).toEqual({ gain: 40, pros: ['Pivot', 'Resistente a Ground'], cons: ['Non più forte contro Fire'] });
  });

  it('raggruppa copre/resiste e le perdite', () => {
    const swap = { index: 0, member: 'Garchomp', fit: 38, replacement: 'Great Tusk', set: emptySet('Great Tusk'), score: 56, similar: false, level: 'optional' as const,
      diff: { gains: ['+ Rimozione hazard', '+ copre Normal', '+ copre Grass', '+ copre Ice'], losses: ['- Hazard', '- resiste Dark'] } };
    expect(describeSwap(swap)).toEqual({
      gain: 18,
      pros: ['Rimozione hazard', 'Forte contro Normal, Grass, Ice'],
      cons: ['Hazard', 'Non più resistente a Dark'],
    });
  });
});
