import { describe, expect, it } from 'vitest';
import type { CoachProblem, ProblemCategory } from '../../src/engine/coach';
import type { CoachFix } from '../../src/engine/coachFixes';
import { MAX_ALTERNATIVES, neutralAsAlternatives, proposalGroups, solvedKeys, type ProposalGroup } from '../../src/engine/coachProposals';
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

  it('lo stesso Pokémon in posti diversi: una riga se risolve le stesse cose, righe diverse se no', () => {
    const fixes = [swap('Latios-Mega', 0, 4, ['meta:A']), swap('Latios-Mega', 1, 2, ['meta:A']), swap('Latios-Mega', 2, 2, ['meta:B'])];
    const groups = proposalGroups(problems, { fixes, moves: [] });
    expect(groups.map(g => g.options.map(o => (o.kind === 'fix' ? o.fix.index : -1)))).toEqual([[0, 1], [2]]);
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
});

describe('neutralAsAlternatives', () => {
  const fix = (species: string, gain: number, solves: string[]) => ({ kind: 'fix' as const, fix: swap(species, 0, gain, solves) });
  const group = (id: string, lead: string | null, ...options: ProposalGroup['options']): ProposalGroup => ({ id, lead, options });
  const ids = (groups: ProposalGroup[]) => groups.map(g => g.id);

  it('un gruppo che non alza il voto va fra le alternative del primo che lo alza e risolve il suo problema principale', () => {
    const groups = [
      group('a', 'meta:A', fix('A', 4, ['meta:A'])),
      group('b', 'meta:B', fix('B', 3, ['meta:B', 'defense:Fire'])),
      group('n', 'defense:Fire', fix('N', 0, ['defense:Fire']), fix('N2', -1, ['defense:Fire'])),
    ];
    const out = neutralAsAlternatives(groups);
    expect(ids(out)).toEqual(['a', 'b']);
    expect(names(out)).toEqual([['A'], ['B', 'N', 'N2']]);
  });

  it('conta solo la proposta mostrata dell\'ospite (la prima), non le sue alternative', () => {
    const groups = [
      group('a', 'meta:A', fix('A', 4, ['meta:A']), fix('A2', 2, ['meta:A', 'defense:Fire'])),
      group('b', 'defense:Fire', fix('B', 1, ['defense:Fire'])),
      group('n', 'defense:Fire', fix('N', 0, ['defense:Fire'])),
    ];
    expect(names(neutralAsAlternatives(groups))).toEqual([['A', 'A2'], ['B', 'N']]);
  });

  it('senza un ospite (o senza problema principale) resta in coda, nell\'ordine di prima', () => {
    const groups = [
      group('z', null, fix('Z', 0, [])),
      group('a', 'meta:A', fix('A', 2, ['meta:A'])),
      group('n', 'meta:B', fix('N', 0, ['meta:B'])),
    ];
    const out = neutralAsAlternatives(groups);
    expect(ids(out)).toEqual(['a', 'z', 'n']);
    expect(names(out)).toEqual([['A'], ['Z'], ['N']]);
  });

  it('l\'ospite resta al più con MAX_ALTERNATIVES alternative', () => {
    const host = group('a', 'meta:A', ...Array.from({ length: MAX_ALTERNATIVES }, (_, i) => fix(`A${i}`, 5 - i, ['meta:A'])));
    const out = neutralAsAlternatives([host, group('n', 'meta:A', fix('N', 0, ['meta:A']), fix('M', 0, ['meta:A']))]);
    expect(out).toHaveLength(1);
    expect(out[0].options).toHaveLength(MAX_ALTERNATIVES + 1);
    expect(names(out)[0].slice(-1)).toEqual(['N']);
  });

  it('non cambia i gruppi di partenza', () => {
    const host = group('a', 'meta:A', fix('A', 2, ['meta:A']));
    neutralAsAlternatives([host, group('n', 'meta:A', fix('N', 0, ['meta:A']))]);
    expect(host.options).toHaveLength(1);
  });
});
