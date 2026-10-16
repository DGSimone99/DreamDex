import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { isPassive } from '../../src/engine/roles';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet =>
  ({ ...emptySet(species), item, ability, moves });
const swapped = (team: TeamSet[], index: number, replacement: TeamSet) => team.map((m, i) => (i === index ? replacement : m));

const balance = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Toxapex', 'Corviknight', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
const weak = ['Magikarp', 'Caterpie', 'Weedle', 'Metapod', 'Kakuna', 'Sunkern'].map(n => ({ ...emptySet(n), moves: ['Splash'] }));

describe('sostituzioni giudicate col voto', () => {
  it('ogni sostituzione alza davvero il voto: +5 o più, consigliata da +10', () => {
    for (const team of [balance, weak]) {
      const before = rateTeam(team, fixtureData)!.overall;
      for (const swap of coachTeam(team, DEFAULT_FORMAT, fixtureData).swaps) {
        const after = rateTeam(swapped(team, swap.index, swap.set), fixtureData)!.overall;
        expect(after - before).toBe(swap.ratingGain);
        expect(swap.ratingGain).toBeGreaterThanOrEqual(5);
        expect(swap.level).toBe(swap.ratingGain >= 10 ? 'recommended' : 'optional');
      }
    }
  });

  it('le consigliate vengono prima, poi per punti guadagnati', () => {
    const swaps = coachTeam(weak, DEFAULT_FORMAT, fixtureData).swaps;
    expect(swaps).toHaveLength(2);
    expect(swaps[0].ratingGain).toBeGreaterThanOrEqual(swaps[1].ratingGain);
  });

  it('un membro illegale ha sempre una sostituzione consigliata', () => {
    const team = [...balance.slice(0, 5), set('Mewtwo', 'Mewtwonite Y', 'Pressure', ['Psystrike', 'Fire Blast', 'Ice Beam', 'Recover'])];
    const swap = coachTeam(team, DEFAULT_FORMAT, fixtureData).swaps.find(s => s.index === 5);
    expect(swap?.level).toBe('recommended');
  });
});

describe('sostituzioni in uno stall', () => {
  const stall: TeamSet[] = [
    set('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk']),
    set('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish']),
    set('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes']),
    set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost']),
    set('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic']),
    set('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes']),
  ];

  it('un muro passivo si sostituisce solo con un altro passivo, e il team resta stall', () => {
    for (const swap of coachTeam(stall, DEFAULT_FORMAT, fixtureData).swaps) {
      expect(isPassive(swap.set)).toBe(true);
      expect(rateTeam(swapped(stall, swap.index, swap.set), fixtureData)!.archetype).toBe('stall');
    }
  });
});
