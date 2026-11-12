import { describe, expect, it, vi } from 'vitest';
import { defaultChoice, fillProposals, formeId, type Proposal } from '../../src/engine/fillProposals';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import type { WorkerRequest, WorkerResponse } from '../../src/engine/rankingProtocol';
import { emptySet } from '../../src/engine/sets';
import type { GainJob } from '../../src/engine/teamGain';
import { cancelPrepareFill, prepareFill, splitJobs, streamFill } from '../../src/ui/useRanking';
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
  const shown = message.shown.map(ids => [...ids]);
  const steps = fillProposals(message.team, message.choice, shown, message.format, fillData);
  let found = 0;
  const step = () => {
    const next = cancelled.has(message.id) ? null : steps.next();
    if (next && !next.done) {
      if (next.value) reply({ id: message.id, ok: true, kind: 'fillProposal', proposal: next.value });
      if (!next.value || !message.max || ++found < message.max) { setTimeout(step, 0); return; }
    }
    reply({ id: message.id, ok: true, kind: 'fillDone', shown, exhausted: next?.done === true && next.value === 'exhausted' });
  };
  setTimeout(step, 0);
};

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const fills = () => (fake.sent as WorkerRequest[]).filter(m => m.kind === 'fill') as Extract<WorkerRequest, { kind: 'fill' }>[];
const cancels = () => (fake.sent as WorkerRequest[]).filter(m => m.kind === 'cancel');

describe('streamFill col calcolo in sottofondo', () => {
  it('le proposte arrivano dal worker una alla volta, poi la fine', async () => {
    const got: Proposal[] = [];
    const result = await streamFill([], { archetype: 'stall', style: null }, [], DEFAULT_FORMAT, fillData, p => got.push(p)).done;
    expect(fills()).toHaveLength(1);
    expect(got.length).toBeGreaterThan(0);
    expect(result.failed).toBe(false);
    // Fermato per i tentativi, non finiti; senza candidati (solo preferiti, nessun preferito) sì
    expect(result.exhausted).toBe(false);
    const team = [emptySet('Garchomp')];
    const none = await streamFill(team, { ...defaultChoice(team), favorites: 'only' }, [], DEFAULT_FORMAT, fillData, () => undefined).done;
    expect(none.exhausted).toBe(true);
  });

  it('la storia delle proposte già mostrate arriva al worker e torna allungata con quelle del giro', async () => {
    const shown = [['gholdengo', 'kingambit', 'greattusk', 'toxapex', 'dragapult', 'corviknight']];
    const got: Proposal[] = [];
    const result = await streamFill([], { archetype: 'balance', style: null }, shown, DEFAULT_FORMAT, fillData, p => got.push(p)).done;
    expect(fills()[fills().length - 1].shown).toEqual(shown);
    expect(got.length).toBeGreaterThan(0);
    expect(result.shown).toEqual([...shown, ...got.map(p => p.added.map(formeId))]);
  });

  it('max arriva al worker; cancel gli chiede di fermarsi', async () => {
    const before = fills().length;
    const got: Proposal[] = [];
    await streamFill([], { archetype: 'hyperOffense', style: null }, [], DEFAULT_FORMAT, fillData, p => got.push(p), { max: 1 }).done;
    expect(fills()[before].max).toBe(1);
    expect(got).toHaveLength(1);
    expect((await streamFill([], { archetype: 'hyperOffense', style: null }, [], DEFAULT_FORMAT, fillData, () => undefined, { max: 1 }).done).exhausted).toBe(false);

    const run = streamFill([], { archetype: 'balance', style: null }, [], DEFAULT_FORMAT, fillData, () => undefined);
    run.cancel();
    const { id } = fills()[before + 1];
    expect(cancels()).toContainEqual({ kind: 'cancel', id });
    await run.done;
  });

  it('una risposta non ok dice failed e non spegne il worker', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fake.fail = true;
    const result = await streamFill([], { archetype: 'semiStall', style: null }, [], DEFAULT_FORMAT, fillData, () => undefined).done;
    fake.fail = false;
    expect(result.failed).toBe(true);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
    // La richiesta dopo va ancora al worker
    const before = fills().length;
    const got: Proposal[] = [];
    await streamFill([], { archetype: 'stall', style: 'trickroom' }, [], DEFAULT_FORMAT, fillData, p => got.push(p)).done;
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
    const result = await streamFill(other, defaultChoice(other), [], DEFAULT_FORMAT, fillData, p => got.push(p)).done;
    expect(fills()).toHaveLength(before + 2);
    expect(result.failed).toBe(false);
    await tick();
  });

  it('cancelPrepareFill ferma subito la preparazione in corso (il team è cambiato)', () => {
    const team = [emptySet('Skarmory')];
    prepareFill(team, DEFAULT_FORMAT, fillData);
    const { id } = fills()[fills().length - 1];
    cancelPrepareFill();
    expect(cancels()).toContainEqual({ kind: 'cancel', id });
  });

  it('una preparazione rotta si rifà alla richiesta dopo', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const team = [emptySet('Clodsire')];
    const before = fills().length;
    fake.fail = true;
    prepareFill(team, DEFAULT_FORMAT, fillData);
    await tick(); await tick();
    fake.fail = false;
    error.mockRestore();
    prepareFill(team, DEFAULT_FORMAT, fillData);
    expect(fills()).toHaveLength(before + 2);
    cancelPrepareFill();
  });
});

describe('voti della lista divisi fra i calcoli', () => {
  const jobs = ['Garchomp', 'Toxapex', 'Kingambit', 'Blissey', 'Dragapult', 'Corviknight', 'Gholdengo', 'Great Tusk']
    .flatMap(name => [0, 1].map(i => ({ key: `${name}#${i}`, set: emptySet(name) }) as unknown as GainJob));

  it('tutti i voti, nessuno ripetuto, e i voti dello stesso candidato insieme', () => {
    const groups = splitJobs(jobs, 3);
    expect(groups.flat().map(j => j.key).sort()).toEqual(jobs.map(j => j.key).sort());
    for (const group of groups) for (const job of group) {
      expect(groups.filter(g => g.some(other => other.set.species === job.set.species))).toHaveLength(1);
    }
  });

  it('il calcolo occupato da Completa team non riceve voti', () => {
    const groups = splitJobs(jobs, 3, 2);
    expect(groups[2]).toEqual([]);
    expect(groups.flat()).toHaveLength(jobs.length);
  });
});
