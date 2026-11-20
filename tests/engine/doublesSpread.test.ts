import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bestHit, SPREAD_SHARE } from '../../src/engine/damage';
import { hitRules } from '../../src/engine/formatRules';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const mk = (species: string, ability: string, moves: string[], item = '', nature = 'Modest', evs: TeamSet['evs'] = { spa: 252, spe: 252, hp: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const physical = { atk: 252, spe: 252, hp: 4 };

const target = mk('Garchomp', 'Rough Skin', ['Earthquake']);
const charizard = (moves: string[]) => mk('Charizard', 'Blaze', moves);
const doublesData = { ...fixtureData, formatId: 'natdexdoubles' as const };
const ouData = { ...fixtureData, formatId: 'ou' as const };

describe('doppio: le mosse a più bersagli al 75%', () => {
  it('in doppio Heat Wave fa il 75% di quello che fa in singolo', () => {
    const single = bestHit(charizard(['Heat Wave']), target)!, doubles = bestHit(charizard(['Heat Wave']), target, { doubles: true })!;
    expect(SPREAD_SHARE).toBe(0.75);
    expect(single.expected).toBeGreaterThan(0);
    expect(doubles.expected).toBeCloseTo(single.expected * 0.75, 10);
    expect(doubles.min).toBeCloseTo(single.min * 0.75, 10);
    expect(doubles.max).toBeCloseTo(single.max * 0.75, 10);
  });

  it('anche Earthquake (colpisce tutti i vicini) vale il 75%', () => {
    const chomp = mk('Garchomp', 'Rough Skin', ['Earthquake'], '', 'Jolly', physical);
    const foe = mk('Heatran', 'Flash Fire', ['Magma Storm']);
    expect(bestHit(chomp, foe, { doubles: true })!.expected).toBeCloseTo(bestHit(chomp, foe)!.expected * 0.75, 10);
  });

  it('una mossa a bersaglio singolo non cambia', () => {
    expect(bestHit(charizard(['Flamethrower']), target, { doubles: true })).toEqual(bestHit(charizard(['Flamethrower']), target));
  });

  it('il colpo migliore si sceglie dopo la riduzione', () => {
    // Heat Wave (95) batte Flamethrower (90) solo senza la riduzione; Mystical Fire (75) no
    const both = charizard(['Heat Wave', 'Mystical Fire']);
    expect(bestHit(both, target)!.move).toBe('Heat Wave');
    expect(bestHit(both, target, { doubles: true })!.move).toBe('Mystical Fire');
    // Se la mossa a più bersagli resta la più forte anche ridotta, resta lei
    const weak = charizard(['Heat Wave', 'Ember']);
    expect(bestHit(weak, target, { doubles: true })!.move).toBe('Heat Wave');
  });

  it('vale anche per i colpi subiti', () => {
    const single = bestHit(charizard(['Heat Wave']), target, { incoming: true })!;
    expect(bestHit(charizard(['Heat Wave']), target, { incoming: true, doubles: true })!.expected).toBeCloseTo(single.expected * 0.75, 10);
  });

  it('una mossa Z nata da una mossa a più bersagli colpisce un bersaglio solo: piena', () => {
    const z = mk('Charizard', 'Blaze', ['Heat Wave'], 'Firium Z');
    expect(bestHit(z, target, { z: true, doubles: true })).toEqual(bestHit(z, target, { z: true }));
  });

  it('hitRules: doubles solo nei formati di doppio', () => {
    expect(hitRules(doublesData)).toEqual({ doubles: true });
    expect(hitRules(ouData)).toEqual({});
    expect(hitRules(fixtureData)).toEqual({});
  });

  const spreadTeam = [
    mk('Charizard', 'Blaze', ['Heat Wave', 'Air Slash', 'Protect']),
    mk('Garchomp', 'Rough Skin', ['Earthquake', 'Rock Slide', 'Protect'], '', 'Jolly', physical),
    mk('Gardevoir', 'Trace', ['Dazzling Gleam', 'Hyper Voice', 'Protect']),
  ];
  const singleTeam = [
    mk('Charizard', 'Blaze', ['Flamethrower', 'Air Slash', 'Protect']),
    mk('Garchomp', 'Rough Skin', ['Stomping Tantrum', 'Stone Edge', 'Protect'], '', 'Jolly', physical),
    mk('Gardevoir', 'Trace', ['Moonblast', 'Psychic', 'Protect']),
  ];

  it("l'Offesa di un team con mosse a più bersagli è più bassa in doppio; quella di un team senza è uguale", () => {
    const offense = (team: TeamSet[], data: typeof doublesData | typeof ouData) => rateTeam(team, data)!.offense;
    expect(offense(spreadTeam, doublesData).value).toBeLessThan(offense(spreadTeam, ouData).value);
    expect(offense(spreadTeam, doublesData).types.value).toBeLessThan(offense(spreadTeam, ouData).types.value);
    expect(offense(singleTeam, doublesData).value).toBe(offense(singleTeam, ouData).value);
  });

  it('la Difesa contro il meta regge di più le mosse a più bersagli in doppio (mai di meno)', () => {
    const defense = (data: typeof doublesData | typeof ouData) => rateTeam(singleTeam, data)!.defense;
    const pct = (data: typeof doublesData | typeof ouData) => (defense(data).coverageMeta?.rows ?? []).flatMap(row => (row.hits ?? []).map(h => h.pct));
    const doubles = pct(doublesData), singles = pct(ouData);
    expect(doubles.length).toBe(singles.length);
    expect(doubles.length).toBeGreaterThan(0);
    doubles.forEach((value, i) => expect(value).toBeLessThanOrEqual(singles[i]));
    expect(doubles.some((value, i) => value < singles[i])).toBe(true);
  });

  it('in singolo il voto non cambia', () => {
    const benchTeams = JSON.parse(readFileSync('scripts/bench/teams.json', 'utf8')) as { team: TeamSet[] }[];
    const expected: [number, number][] = [[0, 81], [8, 77], [11, 68]];
    for (const [index, overall] of expected) expect(rateTeam(benchTeams[index].team, ouData)!.overall).toBe(overall);
  });
});
