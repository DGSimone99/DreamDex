import { describe, expect, it } from 'vitest';
import { coachTeam, verdictFor, weaknessSeverity, type CoachProblem } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { gradeFor, rateTeam } from '../../src/engine/rating';
import { emptySet, mostCommonSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';

const row = (weak: number, resist: number) =>
  ({ type: 'Fairy', multipliers: [], weak, resist, pressure: Math.max(0, weak - resist) }) as never;
const rules: CoachProblem = { severity: 'serious', category: 'rules', text: 'x', fixes: [], key: 'rules:x' };
const defense: CoachProblem = { severity: 'serious', category: 'defense', text: 'x', fixes: [], key: 'defense:Fairy' };
const six = Array.from({ length: 6 }, () => emptySet('Great Tusk'));

describe('gravità di una debolezza: come il voto', () => {
  it('grave solo se i deboli superano di 2 chi resiste', () => {
    expect(weaknessSeverity(row(3, 3))).toBeNull();
    expect(weaknessSeverity(row(3, 2))).toBe('minor');
    expect(weaknessSeverity(row(3, 1))).toBe('serious');
    expect(weaknessSeverity(row(2, 0))).toBe('serious');
    expect(weaknessSeverity(row(1, 0))).toBe('minor');
  });
});

describe('verdetto: segue il voto', () => {
  it('S e A → solido, B → buona base, C e D → da rivedere', () => {
    expect(verdictFor(six, [], 'S', 'it')).toBe('Team solido');
    expect(verdictFor(six, [defense], 'A', 'it')).toBe('Team solido');
    expect(verdictFor(six, [], 'B', 'it')).toBe('Buona base');
    expect(verdictFor(six, [], 'C', 'it')).toBe('Da rivedere');
    expect(verdictFor(six, [], 'D', 'it')).toBe('Da rivedere');
  });

  it('un problema di regole porta sempre a "da rivedere"', () => {
    expect(verdictFor(six, [rules], 'S', 'it')).toBe('Da rivedere');
  });

  it('team incompleto resta incompleto', () => {
    expect(verdictFor(six.slice(0, 4), [], 'S', 'it')).toBe('Team incompleto');
  });

  it('coachTeam usa il voto del team', () => {
    const team = ['Great Tusk', 'Gholdengo', 'Rotom-Wash', 'Kingambit', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!);
    const { grade } = rateTeam(team, fixtureData)!;
    const expected = { S: 'Team solido', A: 'Team solido', B: 'Buona base', C: 'Da rivedere', D: 'Da rivedere' }[grade]!;
    expect(coachTeam(team, DEFAULT_FORMAT, fixtureData).verdict).toBe(expected);
    expect(gradeFor(95).grade).toBe('S');
  });
});
