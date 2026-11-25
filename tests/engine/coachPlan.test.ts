import { describe, expect, it } from 'vitest';
import type { CoachFix } from '../../src/engine/coachFixes';
import { coachPlan, PLAN_STEPS } from '../../src/engine/coachPlan';
import type { Proposal, ProposalGroup } from '../../src/engine/coachProposals';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import type { MoveFix } from '../../src/engine/moveFixes';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { withCandidate } from '../../src/engine/teamGain';
import { fixtureData, fixtureStats } from '../fixtures/data';

// Due membri deboli (4 e 5): ogni cambio su di loro alza il voto vero
const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });
const six = [...['Great Tusk', 'Gholdengo', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!), junk('Magikarp'), junk('Sunkern')];
const data = { ...fixtureData, formatId: DEFAULT_FORMAT.formatId };
const setOf = (species: string) => mostCommonSet(fixtureStats, species) ?? emptySet(species);
const swap = (species: string, index: number | null, gain = 1): Proposal => ({ kind: 'fix', fix: {
  kind: index === null ? 'add' : 'swap', species, set: setOf(species), index, member: index === null ? null : six[index]?.species ?? null, gain, solves: [], reduces: [],
} as CoachFix });
const group = (p: Proposal, i: number): ProposalGroup => ({ id: `g${i}`, lead: null, options: [p] });
const plan = (team: TeamSet[], proposals: Proposal[]) =>
  coachPlan(proposals.map(group), g => g.options[0], team, data, 'it', rateTeam(team, data, 'it')!.overall);
const label = (p: Proposal) => (p.kind === 'fix' ? p.fix.species : p.fix.to);

describe('coachPlan', () => {
  it('un passo per posto: il secondo cambio sullo stesso membro si salta; il voto di ogni passo è quello vero coi cambi fatti fin lì', () => {
    const steps = plan(six, [swap('Zapdos', 4), swap('Heatran', 4), swap('Rotom-Wash', 5)]);
    expect(steps.map(s => label(s.proposal))).toEqual(['Zapdos', 'Rotom-Wash']);
    const one = withCandidate(six, setOf('Zapdos'), 4);
    const two = withCandidate(one, setOf('Rotom-Wash'), 5);
    expect(steps.map(s => s.overall)).toEqual([rateTeam(one, data, 'it')!.overall, rateTeam(two, data, 'it')!.overall]);
    expect(steps[1].grade).toBe(rateTeam(two, data, 'it')!.grade);
    expect(steps.map(s => s.groupId)).toEqual(['g0', 'g2']);
  });

  it('un cambio di mossa su un membro che un passo sostituisce non entra', () => {
    const move: Proposal = { kind: 'move', fix: { index: 4, member: 'Magikarp', set: { ...six[4], moves: ['Splash', 'Tackle'] }, slot: 1, from: '', to: 'Tackle', gain: 1, solves: [], reduces: [] } as MoveFix };
    expect(plan(six, [swap('Zapdos', 4), move, swap('Rotom-Wash', 5)]).map(s => label(s.proposal))).toEqual(['Zapdos', 'Rotom-Wash']);
  });

  it('le aggiunte vanno bene finché restano posti liberi; la stessa specie non entra due volte', () => {
    const four = six.slice(0, 4);
    const steps = plan(four, [swap('Rotom-Wash', null), swap('Rotom-Wash', null), swap('Dragonite', null), swap('Kingambit', null)]);
    // Due posti liberi: al più due aggiunte, mai due Rotom-Wash
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThanOrEqual(2);
    expect(steps.filter(s => label(s.proposal) === 'Rotom-Wash').length).toBeLessThanOrEqual(1);
    expect(steps[0].groupId).toBe('g0');
    if (steps[1]) expect(steps[1].groupId).not.toBe('g1');
  });

  it(`al più ${PLAN_STEPS} passi, e solo quelli che alzano il voto`, () => {
    const steps = plan(six.slice(0, 2), [swap('Zapdos', null), swap('Rotom-Wash', null), swap('Heatran', null), swap('Clefable', null)]);
    expect(steps.length).toBeLessThanOrEqual(PLAN_STEPS);
    let last = rateTeam(six.slice(0, 2), data, 'it')!.overall;
    for (const s of steps) { expect(s.overall).toBeGreaterThan(last); last = s.overall; }
  });
});
