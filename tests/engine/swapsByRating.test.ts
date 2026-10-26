import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { isPassive } from '../../src/engine/roles';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';
import { adviceOf } from '../helpers/coach';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet =>
  ({ ...emptySet(species), item, ability, moves });
const swapped = (team: TeamSet[], index: number, replacement: TeamSet) => team.map((m, i) => (i === index ? replacement : m));

const balance = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Toxapex', 'Corviknight', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
const weak = ['Magikarp', 'Caterpie', 'Weedle', 'Metapod', 'Kakuna', 'Sunkern'].map(n => ({ ...emptySet(n), moves: ['Splash'] }));

describe('sostituzioni giudicate col voto', () => {
  it('ogni sostituzione alza davvero il voto, di quanto dice', () => {
    for (const team of [balance, weak]) {
      const before = rateTeam(team, fixtureData)!.overall;
      const swaps = adviceOf(team, DEFAULT_FORMAT, fixtureData).fixes.filter(f => f.kind === 'swap');
      if (team === weak) expect(swaps.length).toBeGreaterThan(0);
      for (const fix of swaps) {
        const after = rateTeam(swapped(team, fix.index!, fix.set), fixtureData)!.overall;
        expect(after - before).toBe(fix.gain);
        expect(fix.gain).toBeGreaterThan(0);
      }
    }
  });

  it('un membro illegale ha un cambio che risolve il problema di regole', () => {
    const team = [...balance.slice(0, 5), set('Mewtwo', 'Mewtwonite Y', 'Pressure', ['Psystrike', 'Fire Blast', 'Ice Beam', 'Recover'])];
    const coaching = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    const rules = coaching.problems.find(p => p.category === 'rules')!.key;
    expect(adviceOf(team, DEFAULT_FORMAT, fixtureData).fixes.some(f => f.index === 5 && f.solves.includes(rules))).toBe(true);
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
    for (const fix of adviceOf(stall, DEFAULT_FORMAT, fixtureData).fixes) {
      expect(isPassive(fix.set, DEFAULT_RULES)).toBe(true);
      expect(rateTeam(swapped(stall, fix.index!, fix.set), fixtureData)!.archetype).toBe('stall');
    }
  });
});

describe('punti di voto di un sostituto qualunque (anteprima da "Altri sostituti")', () => {
  it('differenza tra il voto con il sostituto e quello attuale', async () => {
    const { ratingGainOf } = await import('../../src/engine/coach');
    const replacement = mostCommonSet(fixtureStats, 'Garchomp')!;
    const expected = rateTeam(swapped(balance, 0, replacement), fixtureData)!.overall - rateTeam(balance, fixtureData)!.overall;
    expect(ratingGainOf(balance, 0, replacement, fixtureData)).toBe(expected);
  });
});
