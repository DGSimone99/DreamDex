import { describe, expect, it } from 'vitest';
import type { CoachProblem, ProblemCategory } from '../../src/engine/coach';
import type { CoachFix } from '../../src/engine/coachFixes';
import { buildSteps, columnOf, coveredKeys, MAX_STEPS } from '../../src/engine/coachSteps';
import type { MoveFix } from '../../src/engine/moveFixes';
import { emptySet } from '../../src/engine/sets';

const problem = (key: string, severity: CoachProblem['severity'] = 'minor', category: ProblemCategory = 'defense'): CoachProblem =>
  ({ severity, category, text: key, fixes: [], key });
const swap = (species: string, gain: number, solves: string[], reduces: string[] = []): CoachFix =>
  ({ kind: 'swap', species, set: emptySet(species), index: 0, member: 'X', gain, solves, reduces });
const move = (index: number, gain: number, solves: string[], reduces: string[] = []): MoveFix =>
  ({ index, member: `M${index}`, slot: 0, from: 'Splash', to: 'Tackle', set: emptySet('Pikachu'), gain, solves, reduces });

describe('columnOf', () => {
  it('colonna della mappa per categoria', () => {
    expect(columnOf('defense')).toBe('defense');
    expect(columnOf('coverage')).toBe('offense');
    for (const c of ['roles', 'conditions', 'redundancy'] as const) expect(columnOf(c)).toBe('roles');
    for (const c of ['rules', 'meta'] as const) expect(columnOf(c)).toBe('rules');
  });
});

describe('buildSteps', () => {
  it('senza problemi: nessuna tappa', () => {
    expect(buildSteps([], [swap('A', 5, ['A'])], [])).toEqual([]);
  });

  it('un grave prima di un minore anche con +N più basso; a pari gravità il +N migliore (swap o move)', () => {
    const problems = [problem('m1'), problem('m2'), problem('g', 'serious')];
    const steps = buildSteps(problems, [swap('S1', 2, ['g']), swap('S2', 5, ['m1'])], [move(1, 9, ['m2'])]);
    expect(steps.map(s => s.problem.key)).toEqual(['g', 'm2', 'm1']);
  });

  it('la proposta è la migliore che risolve; i soli reduces non bastano', () => {
    const steps = buildSteps([problem('a')], [swap('R', 20, [], ['a']), swap('S1', 3, ['a']), swap('S2', 6, ['a'])], []);
    expect(steps).toHaveLength(1);
    expect(steps[0].swap?.species).toBe('S2');
    expect(steps[0].move).toBeNull();
    expect(buildSteps([problem('a')], [swap('R', 20, [], ['a'])], [move(0, 5, [], ['a'])])).toEqual([]);
  });

  it('un problema risolto dalla mossa di un\'altra tappa non è una tappa e finisce in alsoSolves', () => {
    const problems = [problem('a', 'serious'), problem('b')];
    const steps = buildSteps(problems, [swap('S', 4, ['a'])], [move(1, 3, ['a', 'b'])]);
    expect(steps).toHaveLength(1);
    expect(steps[0].alsoSolves).toEqual(['b']);
    expect(steps[0].swap?.species).toBe('S');
    expect(steps[0].move?.index).toBe(1);
  });

  it('alsoSolves anche se lo swap non risolve il problema, solo la mossa', () => {
    const problems = [problem('a', 'serious'), problem('b')];
    const steps = buildSteps(problems, [swap('S', 4, ['a'])], [move(1, 3, ['b'])]);
    // a ha solo lo swap; b ha solo la mossa e non è coperto da a
    expect(steps.map(s => s.problem.key)).toEqual(['a', 'b']);
    const covered = buildSteps([problem('a', 'serious'), problem('b')], [swap('S', 4, ['a'])], [move(1, 3, ['a', 'b'])]);
    expect(covered[0].alsoSolves).toEqual(['b']);
  });

  it('niente doppioni: specie e membri già usati', () => {
    const problems = [problem('a', 'serious'), problem('b', 'serious'), problem('c', 'serious')];
    const steps = buildSteps([problem('a', 'serious'), problem('b', 'serious')], [swap('S1', 9, ['a']), swap('S1', 8, ['b']), swap('S2', 5, ['b'])], []);
    expect(steps.map(s => s.swap?.species)).toEqual(['S1', 'S2']);
    // un membro già usato per una mossa non ne riceve un'altra
    const m = buildSteps(problems.slice(0, 2), [], [move(2, 9, ['a']), move(2, 8, ['b']), move(3, 1, ['b'])]);
    expect(m.map(s => s.move?.index)).toEqual([2, 3]);
    // se non resta nulla, non è una tappa
    expect(buildSteps(problems.slice(0, 2), [swap('S1', 9, ['a']), swap('S1', 8, ['b'])], [])).toHaveLength(1);
    expect(buildSteps(problems.slice(0, 2), [], [move(2, 9, ['a']), move(2, 8, ['b'])])).toHaveLength(1);
  });

  it('un problema senza proposte che lo risolvono non è una tappa', () => {
    expect(buildSteps([problem('a'), problem('b')], [swap('S', 4, ['a'])], []).map(s => s.problem.key)).toEqual(['a']);
  });

  it('tappa con solo mossa e con solo swap', () => {
    const [onlyMove] = buildSteps([problem('a')], [swap('S', 4, ['x'])], [move(1, 3, ['a'])]);
    expect(onlyMove.swap).toBeNull();
    expect(onlyMove.move?.index).toBe(1);
    const [onlySwap] = buildSteps([problem('a')], [swap('S', 4, ['a'])], [move(1, 3, ['x'])]);
    expect(onlySwap.move).toBeNull();
    expect(onlySwap.swap?.species).toBe('S');
  });
});

describe('coveredKeys', () => {
  it('solo le prime MAX_STEPS tappe', () => {
    expect(MAX_STEPS).toBe(3);
    const keys = ['a', 'b', 'c', 'd'];
    const steps = buildSteps(keys.map(k => problem(k)), keys.map((k, i) => swap(`S${k}`, 10 - i, [k, ...(k === 'a' ? ['z'] : [])])), []);
    expect(steps).toHaveLength(4);
    expect([...coveredKeys(steps)].sort()).toEqual(['a', 'b', 'c', 'z']);
  });
});
