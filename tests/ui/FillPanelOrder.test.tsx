import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FillChoice, Proposal } from '../../src/engine/fillProposals';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { FillPanel } from '../../src/ui/FillPanel';
import { fillData } from '../fixtures/fillData';
import { renderIt } from '../helpers/italian';

/** streamFill finto: le richieste restano aperte finché il test non manda le proposte e la fine. */
const calls = vi.hoisted(() => [] as {
  choice: FillChoice; max?: number; cancelled: boolean;
  push: (p: Proposal) => void; end: () => void;
}[]);
vi.mock('../../src/ui/useRanking', () => ({
  streamFill: (_team: unknown, choice: FillChoice, exclude: Set<string>, _format: unknown, _data: unknown,
    onProposal: (p: Proposal) => void, options: { max?: number } = {}) => {
    let resolve!: (done: { exclude: Set<string>; failed: boolean }) => void;
    const done = new Promise<{ exclude: Set<string>; failed: boolean }>(r => { resolve = r; });
    const call = { choice, max: options.max, cancelled: false, push: onProposal, end: () => resolve({ exclude, failed: false }) };
    calls.push(call);
    return { done, cancel: () => { call.cancelled = true; resolve({ exclude, failed: false }); } };
  },
}));

const proposal = (n: number): Proposal => {
  const added = Array.from({ length: 6 }, (_, i) => ({ ...emptySet(['Garchomp', 'Toxapex', 'Kingambit', 'Blissey', 'Dragapult', 'Corviknight'][i]), item: `x${n}` }));
  return { added, team: added, overall: 90 - n, grade: 'A', archetype: 'balance', styles: [], gaps: [], changed: [], favorites: 0 };
};
const live = () => calls.filter(c => !c.cancelled);
const main = () => live().filter(c => c.max === undefined);
const checks = () => calls.filter(c => c.max === 1);

describe('Completa team: ordine dei calcoli e proposta migliore', () => {
  it('i controlli "questo tipo ha proposte?" partono solo dopo la prima proposta del giro', async () => {
    calls.length = 0;
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    expect(main()).toHaveLength(1);
    expect(checks()).toHaveLength(0);
    await act(async () => { main()[0].push(proposal(0)); });
    expect(checks().length).toBeGreaterThanOrEqual(1);
  });

  it('il magenta (riga e pulsante) solo sulla migliore del primo giro', async () => {
    calls.length = 0;
    const user = userEvent.setup();
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    await act(async () => {
      for (let i = 0; i < 5; i++) main()[0].push(proposal(i));
      main()[0].end();
    });
    expect(document.querySelectorAll('.fill-proposal.is-best')).toHaveLength(1);
    expect(document.querySelectorAll('.fill-add.primary')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Altre proposte' }));
    const next = main()[main().length - 1];
    await act(async () => { next.push(proposal(7)); });
    expect(document.querySelectorAll('.fill-proposal')).toHaveLength(1);
    expect(document.querySelectorAll('.fill-proposal.is-best')).toHaveLength(0);
    expect(document.querySelectorAll('.fill-add.primary')).toHaveLength(0);
  });
});
