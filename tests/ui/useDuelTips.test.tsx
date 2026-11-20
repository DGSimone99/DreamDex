import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DuelTipsResult } from '../../src/engine/duelTips';
import type { TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

const calls: { team: TeamSet[]; resolve: (r: DuelTipsResult) => void }[] = [];
vi.mock('../../src/ui/useRanking', () => ({
  duelTipsLater: (team: TeamSet[]) => new Promise<DuelTipsResult>(resolve => { calls.push({ team, resolve }); }),
}));

const { useDuelTips } = await import('../../src/ui/useDuelTips');

describe('consigli della Sfida in sottofondo', () => {
  it('una risposta vecchia arrivata dopo quella nuova non prende il posto', async () => {
    const a = [tusk];
    const b = [{ ...tusk, evs: { ...tusk.evs, spd: 32 } }];
    const { result, rerender } = renderHook(({ team }) => useDuelTips(team, 0, gholdengo, [], fixtureData), { initialProps: { team: a } });
    expect(result.current).toBeNull();
    await waitFor(() => expect(calls).toHaveLength(1));
    rerender({ team: b });
    await waitFor(() => expect(calls).toHaveLength(2));
    calls[1].resolve({ overall: 2, tips: [] });
    await waitFor(() => expect(result.current?.overall).toBe(2));
    calls[0].resolve({ overall: 1, tips: [] });
    await new Promise(r => setTimeout(r, 20));
    expect(result.current?.overall).toBe(2);
  });

  it('senza avversario niente calcolo', async () => {
    const before = calls.length;
    const { result } = renderHook(() => useDuelTips([tusk], 0, null, [], fixtureData));
    await new Promise(r => setTimeout(r, 250));
    expect(calls.length).toBe(before);
    expect(result.current).toBeNull();
  });
});
