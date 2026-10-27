import { describe, expect, it } from 'vitest';
import type { CoachProblem, ProblemCategory } from '../../src/engine/coach';
import type { CoachFix } from '../../src/engine/coachFixes';
import { buildSteps, columnOf, MAX_STEPS, stepNumbers } from '../../src/engine/coachSteps';
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

  it('un problema coperto solo dallo swap di una tappa precedente diventa tappa se una mossa lo risolve', () => {
    // Come SIX: lo swap della prima tappa risolve molto, una mossa risolve uno di quei problemi
    const problems = [problem('g', 'serious'), problem('r'), problem('h'), problem('c')];
    const steps = buildSteps(problems, [swap('S', 6, ['g', 'r', 'h', 'c']), swap('T', 2, ['r'])], [move(1, 3, ['r', 'h'])]);
    expect(steps.map(s => s.problem.key)).toEqual(['g', 'r']);
    expect(steps[1].move?.index).toBe(1);
    // lo swap solo se uno non ancora usato risolve quel problema
    expect(steps[1].swap?.species).toBe('T');
    expect(steps[1].alsoSolves).toEqual(['h']);
    // senza swap libero: solo la mossa
    const [, only] = buildSteps(problems, [swap('S', 6, ['g', 'r', 'h', 'c'])], [move(1, 3, ['r'])]);
    expect(only.problem.key).toBe('r');
    expect(only.swap).toBeNull();
  });

  it('coperto solo da swap e senza mossa che lo risolve: niente tappa; coperto da una mossa: resta coperto', () => {
    const problems = [problem('g', 'serious'), problem('r')];
    expect(buildSteps(problems, [swap('S', 6, ['g', 'r']), swap('T', 2, ['r'])], []).map(s => s.problem.key)).toEqual(['g']);
    expect(buildSteps(problems, [swap('S', 6, ['g'])], [move(1, 3, ['g', 'r']), move(2, 2, ['r'])]).map(s => s.problem.key)).toEqual(['g']);
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

describe('buildSteps: problemi raggruppati nel titolo', () => {
  it('una proposta: il problema della tappa e quelli della stessa categoria che risolve, in ordine', () => {
    const problems = [problem('defense:Water'), problem('defense:Ice'), problem('meta:X', 'minor', 'meta'), problem('defense:Ghost')];
    const [step] = buildSteps(problems, [swap('S', 3, ['defense:Ice', 'meta:X', 'defense:Water'])], []);
    expect(step.problem.key).toBe('defense:Water');
    expect(step.group).toEqual(['defense:Water', 'defense:Ice']);
    // alsoSolves resta completo (la mappa numera tutti i problemi coperti)
    expect(step.alsoSolves).toEqual(['defense:Ice', 'meta:X']);
  });

  it('due proposte: solo quelli che risolvono entrambe', () => {
    const problems = [problem('defense:Water'), problem('defense:Ice'), problem('defense:Ghost')];
    const [step] = buildSteps(problems, [swap('S', 3, ['defense:Water', 'defense:Ice', 'defense:Ghost'])], [move(1, 2, ['defense:Water', 'defense:Ice'])]);
    expect(step.group).toEqual(['defense:Water', 'defense:Ice']);
    expect(step.alsoSolves).toEqual(['defense:Ice', 'defense:Ghost']);
  });

  it('niente da raggruppare: solo il problema della tappa', () => {
    const problems = [problem('meta:X', 'minor', 'meta'), problem('defense:Ice')];
    const [step] = buildSteps(problems, [swap('S', 3, ['meta:X', 'defense:Ice'])], []);
    expect(step.group).toEqual(['meta:X']);
  });
});

describe('stepNumbers', () => {
  it('problema → numero della prima tappa che lo copre, solo le prime MAX_STEPS tappe', () => {
    expect(MAX_STEPS).toBe(3);
    const keys = ['a', 'b', 'c', 'd'];
    const steps = buildSteps(keys.map(k => problem(k)), keys.map((k, i) => swap(`S${k}`, 10 - i, [k, ...(k === 'a' ? ['z', 'c'] : [])])), []);
    expect(steps.map(s => s.problem.key)).toEqual(['a', 'b', 'd']);
    expect(Object.fromEntries(stepNumbers(steps))).toEqual({ a: 1, z: 1, c: 1, b: 2, d: 3 });
    expect(stepNumbers([...steps, ...steps]).size).toBe(5);
  });
});
