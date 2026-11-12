import { describe, expect, it, vi } from 'vitest';
import { defaultChoice, fillProposals, type Proposal } from '../../src/engine/fillProposals';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import type { WorkerRequest, WorkerResponse } from '../../src/engine/rankingProtocol';
import { emptySet } from '../../src/engine/sets';
import { prepareFill, streamFill } from '../../src/ui/useRanking';
import { fillData } from '../fixtures/fillData';

/**
 * Un finto calcolo in sottofondo che segue il protocollo di ranking.worker.ts per `fill` (un passo per volta, `max`,
 * `cancel`, risposta non ok a richiesta): deve esistere prima che useRanking crei i suoi worker.
 */
const fake = vi.hoisted(() => {
  const state = {
    sent: [] as unknown[],
    fail: false,
    handle: null as null | ((worker: { reply: (r: unknown) => void }, message: unknown) => void),
  };
  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    reply(response: unknown) { this.onmessage?.({ data: response }); }
    postMessage(message: unknown) {
      state.sent.push(message);
      state.handle?.(this, message);
    }
    terminate() {}
  }
  (globalThis as { Worker?: unknown }).Worker = FakeWorker;
  return state;
});

const cancelled = new Set<number>();
fake.handle = (worker, raw) => {
  const message = raw as WorkerRequest;
  if (message.kind === 'cancel') { cancelled.add(message.id); return; }
  if (message.kind !== 'fill') return;
  const reply = (response: WorkerResponse) => worker.reply(response);
  if (fake.fail) { setTimeout(() => reply({ id: message.id, ok: false, error: 'rotto' }), 0); return; }
  const exclude = new Set(message.exclude);
  const steps = fillProposals(message.team, message.choice, exclude, message.format, fillData);
  let found = 0;
  const step = () => {
    const next = cancelled.has(message.id) ? null : steps.next();
    if (next && !next.done) {
      if (next.value) reply({ id: message.id, ok: true, kind: 'fillProposal', proposal: next.value });
      if (!next.value || !message.max || ++found < message.max) { setTimeout(step, 0); return; }
    }
    reply({ id: message.id, ok: true, kind: 'fillDone', exclude: [...exclude] });
  };
  setTimeout(step, 0);
};

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const fills = () => (fake.sent as WorkerRequest[]).filter(m => m.kind === 'fill') as Extract<WorkerRequest, { kind: 'fill' }>[];
const cancels = () => (fake.sent as WorkerRequest[]).filter(m => m.kind === 'cancel');

describe('streamFill col calcolo in sottofondo', () => {
  it('le proposte arrivano dal worker una alla volta, poi la fine', async () => {
    const got: Proposal[] = [];
    const result = await streamFill([], { archetype: 'stall', style: null }, new Set(), DEFAULT_FORMAT, fillData, p => got.push(p)).done;
    expect(fills()).toHaveLength(1);
    expect(got.length).toBeGreaterThan(0);
    expect(result.failed).toBe(false);
  });

  it('max arriva al worker; cancel gli chiede di fermarsi', async () => {
    const before = fills().length;
    const got: Proposal[] = [];
    await streamFill([], { archetype: 'hyperOffense', style: null }, new Set(), DEFAULT_FORMAT, fillData, p => got.push(p), { max: 1 }).done;
    expect(fills()[before].max).toBe(1);
    expect(got).toHaveLength(1);

    const run = streamFill([], { archetype: 'balance', style: null }, new Set(), DEFAULT_FORMAT, fillData, () => undefined);
    run.cancel();
    const { id } = fills()[before + 1];
    expect(cancels()).toContainEqual({ kind: 'cancel', id });
    await run.done;
  });

  it('una risposta non ok dice failed e non spegne il worker', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fake.fail = true;
    const result = await streamFill([], { archetype: 'semiStall', style: null }, new Set(), DEFAULT_FORMAT, fillData, () => undefined).done;
    fake.fail = false;
    expect(result.failed).toBe(true);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
    // La richiesta dopo va ancora al worker
    const before = fills().length;
    const got: Proposal[] = [];
    await streamFill([], { archetype: 'stall', style: 'trickroom' }, new Set(), DEFAULT_FORMAT, fillData, p => got.push(p)).done;
    expect(fills()).toHaveLength(before + 1);
  });

  it('prepareFill: una sola preparazione per team, quella vecchia si ferma, chi apre il pannello si aggancia', async () => {
    const team = [emptySet('Toxapex')];
    const before = fills().length;
    prepareFill(team, DEFAULT_FORMAT, fillData);
    prepareFill(team, DEFAULT_FORMAT, fillData);
    prepareFill(team, DEFAULT_FORMAT, fillData);
    expect(fills()).toHaveLength(before + 1);
    const old = fills()[before].id;

    const other = [emptySet('Garchomp')];
    prepareFill(other, DEFAULT_FORMAT, fillData);
    expect(fills()).toHaveLength(before + 2);
    expect(cancels()).toContainEqual({ kind: 'cancel', id: old });

    // Il pannello aperto sul team preparato non fa una richiesta nuova
    const got: Proposal[] = [];
    const result = await streamFill(other, defaultChoice(other), new Set(), DEFAULT_FORMAT, fillData, p => got.push(p)).done;
    expect(fills()).toHaveLength(before + 2);
    expect(result.failed).toBe(false);
    await tick();
  });
});
