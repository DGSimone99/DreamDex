import { describe, expect, it } from 'vitest';
import { coachTeam, HELD_LEVEL, holdSeverity, verdictFor, type CoachProblem } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { gradeFor, rateTeam } from '../../src/engine/rating';
import { emptySet, mostCommonSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';

// Un voto finto con la sola Coverage tipi della Difesa: un tipo al livello dato, in weak se nessuno ha credito
const ratingWith = (level: number, weak: boolean) =>
  ({ defense: { coverageTypes: { value: 0, weak: weak ? ['Fairy'] : [], rows: [{ type: 'Fairy', level, physical: level, special: level, heldBy: [] }] } } }) as never;
const rules: CoachProblem = { severity: 'serious', category: 'rules', text: 'x', fixes: [], key: 'rules:x' };
const defense: CoachProblem = { severity: 'serious', category: 'defense', text: 'x', fixes: [], key: 'defense:Fairy' };
const six = Array.from({ length: 6 }, () => emptySet('Great Tusk'));

describe('gravità di un tipo in difesa: come il voto (Coverage tipi della Difesa)', () => {
  it('grave se il tipo è fra quelli che nessuno regge (weak), minore sotto il livello 50, altrimenti niente', () => {
    expect(HELD_LEVEL).toBe(50);
    expect(holdSeverity(ratingWith(0, true), 'Fairy')).toBe('serious');
    // weak vince sul livello: un lato a zero basta, anche se la media dei due lati è alta
    expect(holdSeverity(ratingWith(60, true), 'Fairy')).toBe('serious');
    expect(holdSeverity(ratingWith(49, false), 'Fairy')).toBe('minor');
    expect(holdSeverity(ratingWith(50, false), 'Fairy')).toBeNull();
    expect(holdSeverity(ratingWith(90, false), 'Fairy')).toBeNull();
    // Un tipo senza riga: niente
    expect(holdSeverity(ratingWith(0, false), 'Water')).toBeNull();
  });

  it('sul voto vero: grave esattamente i tipi in weak', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    const rating = rateTeam(team, fixtureData)!;
    const serious = rating.defense.coverageTypes.rows.filter(r => holdSeverity(rating, r.type) === 'serious').map(r => r.type);
    expect(serious).toEqual(rating.defense.coverageTypes.weak);
    expect(serious.length).toBeGreaterThan(0);
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
