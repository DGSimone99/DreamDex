import { describe, expect, it } from 'vitest';
import type { CoachProblem, ProblemCategory } from '../../src/engine/coach';
import type { CoachFix } from '../../src/engine/coachFixes';
import { areaOfProblem, MAX_ALTERNATIVES, proposalGroups, solvedKeys } from '../../src/engine/coachProposals';
import type { MoveFix } from '../../src/engine/moveFixes';
import { emptySet } from '../../src/engine/sets';

const problem = (key: string, severity: CoachProblem['severity'] = 'minor', category: ProblemCategory = 'defense', size?: number): CoachProblem =>
  ({ severity, category, text: key, fixes: [], key, ...(size === undefined ? {} : { size }) });
const swap = (species: string, index: number, gain: number, solves: string[]): CoachFix =>
  ({ kind: 'swap', species, set: emptySet(species), index, member: `M${index}`, gain, solves, reduces: [] });
const add = (species: string, gain: number, solves: string[]): CoachFix =>
  ({ kind: 'add', species, set: emptySet(species), index: null, member: null, gain, solves, reduces: [] });
const move = (index: number, to: string, gain: number, solves: string[]): MoveFix =>
  ({ index, member: `M${index}`, slot: 0, from: 'Splash', to, set: emptySet('Pikachu'), gain, solves, reduces: [] });
const names = (groups: ReturnType<typeof proposalGroups>) =>
  groups.map(g => g.options.map(o => (o.kind === 'fix' ? o.fix.species : o.fix.to)));

describe('proposalGroups', () => {
  const problems = [problem('meta:A', 'minor', 'meta'), problem('defense:Fire', 'serious'), problem('meta:B', 'minor', 'meta')];

  it('stesso posto e stesso problema principale: una riga, le altre come alternative dalla più utile', () => {
    const fixes = [swap('Ting-Lu', 0, 3, ['meta:A', 'meta:B']), swap('Tyranitar', 0, 2, ['meta:A']), swap('Hippowdon', 0, 4, ['meta:A', 'meta:B'])];
    const groups = proposalGroups(problems, { fixes, moves: [] });
    expect(names(groups)).toEqual([['Hippowdon', 'Ting-Lu', 'Tyranitar']]);
    expect(groups[0].lead).toBe('meta:A');
  });

  it('il problema principale è il primo risolto nell\'ordine dei problemi (gravi prima)', () => {
    const fixes = [swap('X', 0, 1, ['meta:A', 'defense:Fire']), swap('Y', 0, 1, ['meta:A'])];
    const groups = proposalGroups(problems, { fixes, moves: [] });
    expect(groups.map(g => g.lead)).toEqual(['defense:Fire', 'meta:A']);
    expect(names(groups)).toEqual([['X'], ['Y']]);
  });

  it('posti diversi (membro, posto libero, mosse di un membro) restano righe diverse', () => {
    const fixes = [swap('X', 0, 2, ['meta:A']), swap('Y', 1, 2, ['meta:A']), add('Z', 1, ['meta:A'])];
    const moves = [move(0, 'Knock Off', 1, ['meta:A']), move(0, 'U-turn', 3, ['meta:A'])];
    const groups = proposalGroups(problems, { fixes, moves });
    expect(names(groups)).toEqual([['U-turn', 'Knock Off'], ['X'], ['Y'], ['Z']]);
  });

  it('le righe vanno dal +N più alto; a pari voto prima chi risolve problemi gravi', () => {
    const fixes = [swap('A', 0, 2, ['meta:A']), swap('B', 1, 2, ['defense:Fire']), swap('C', 2, 5, [])];
    expect(names(proposalGroups(problems, { fixes, moves: [] }))).toEqual([['C'], ['B'], ['A']]);
  });

  it('al più MAX_ALTERNATIVES alternative per riga; senza problemi risolti il gruppo "alza il voto" del posto', () => {
    const fixes = Array.from({ length: 9 }, (_, i) => swap(`S${i}`, 0, 9 - i, []));
    const [group] = proposalGroups(problems, { fixes, moves: [] });
    expect(group.lead).toBeNull();
    expect(group.options).toHaveLength(MAX_ALTERNATIVES + 1);
  });

  it('la coverage minore non guida un gruppo se la proposta risolve altro', () => {
    const minor = problem('coverage:Steel', 'minor', 'coverage', 1);
    const groups = proposalGroups([minor, ...problems], { fixes: [swap('X', 0, 1, ['coverage:Steel', 'meta:B'])], moves: [] });
    expect(groups[0].lead).toBe('meta:B');
  });

  it('solvedKeys: i problemi risolti da almeno una proposta, mosse comprese', () => {
    expect([...solvedKeys({ fixes: [swap('X', 0, 1, ['a'])], moves: [move(1, 'Tackle', 1, ['b'])] })].sort()).toEqual(['a', 'b']);
  });

  it('areaOfProblem: le aree delle testate', () => {
    expect(['defense', 'meta', 'coverage', 'metaHit', 'roles', 'conditions', 'redundancy', 'rules'].map(c => areaOfProblem(c as ProblemCategory)))
      .toEqual(['defense', 'defense', 'strength', 'strength', 'roles', 'bonusMalus', 'bonusMalus', 'rules']);
  });
});
