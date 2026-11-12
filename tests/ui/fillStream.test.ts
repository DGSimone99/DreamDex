import { describe, expect, it, vi } from 'vitest';
import { defaultChoice, type Proposal } from '../../src/engine/fillProposals';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import type { EngineData } from '../../src/engine/data';
import { emptySet as defaultSet } from '../../src/engine/sets';
import { streamFill } from '../../src/ui/useRanking';
import { fillData } from '../fixtures/fillData';

// Senza Worker (jsdom): streamFill avanza il generatore qui, un passo per volta con setTimeout(0)
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('streamFill (senza calcolo in sottofondo)', () => {
  it('consegna da 1 a 5 proposte una alla volta e poi finisce', async () => {
    const got: Proposal[] = [];
    const { done } = streamFill([], { archetype: 'stall', style: null }, new Set(), DEFAULT_FORMAT, fillData, p => got.push(p));
    const { exclude, failed, exhausted } = await done;
    expect(failed).toBe(false);
    // Il giro si è fermato per i tentativi, non perché i Pokémon sono finiti
    expect(exhausted).toBe(false);
    expect(got.length).toBeGreaterThanOrEqual(1);
    expect(got.length).toBeLessThanOrEqual(5);
    // Le forme proposte finiscono fra gli esclusi: "Altre proposte" non le ripete
    expect(exclude.size).toBeGreaterThanOrEqual(got[0].added.length);
    // Il giro dopo non trova più niente: finiti
    const next = await streamFill([], { archetype: 'stall', style: null }, exclude, DEFAULT_FORMAT, fillData, () => undefined).done;
    expect(next.exhausted).toBe(true);
  });

  it('dopo cancel non arriva più nessuna proposta', async () => {
    const got: Proposal[] = [];
    const { cancel } = streamFill([], { archetype: 'balance', style: null }, new Set(), DEFAULT_FORMAT, fillData, p => got.push(p));
    cancel();
    for (let i = 0; i < 200; i++) await tick();
    expect(got).toEqual([]);
  });

  it('fermandosi alla prima proposta ne arriva una sola (il controllo "questo tipo ha proposte?")', async () => {
    const got: Proposal[] = [];
    const run = streamFill([], { archetype: 'hyperOffense', style: null }, new Set(), DEFAULT_FORMAT, fillData, p => { got.push(p); run.cancel(); });
    await run.done;
    for (let i = 0; i < 50; i++) await tick();
    expect(got).toHaveLength(1);
  });

  it('con max: 1 arriva una proposta sola, e il giro limitato non va in cache', async () => {
    const choice = { archetype: 'bulkyOffense' as const, style: null };
    const got: Proposal[] = [];
    const { done } = streamFill([], choice, new Set(), DEFAULT_FORMAT, fillData, p => got.push(p), { max: 1 });
    const result = await done;
    expect(got).toHaveLength(1);
    expect(result.failed).toBe(false);
    expect(result.exclude.size).toBe(got[0].added.length);
    // Fermato da max: non vuol dire finiti
    expect(result.exhausted).toBe(false);
    // La stessa richiesta senza max riparte da capo: niente arriva durante la chiamata
    const again: Proposal[] = [];
    const full = streamFill([], choice, new Set(), DEFAULT_FORMAT, fillData, p => again.push(p));
    expect(again).toEqual([]);
    await full.done;
    expect(again[0]).toEqual(got[0]);
  });

  it('la stessa richiesta una seconda volta si ripete subito dalla cache (anche con max)', async () => {
    const choice = defaultChoice([]);
    const first: Proposal[] = [];
    const firstDone = await streamFill([], choice, new Set(), DEFAULT_FORMAT, fillData, p => first.push(p)).done;
    expect(first.length).toBeGreaterThan(0);

    const order: string[] = [];
    const second: Proposal[] = [];
    const run = streamFill([], { ...choice }, new Set(), DEFAULT_FORMAT, fillData, p => { order.push('proposal'); second.push(p); });
    setTimeout(() => order.push('tick'), 0);
    const secondDone = await run.done;
    await tick();
    expect(order.indexOf('tick')).toBe(first.length);
    expect(second).toEqual(first);
    expect([...secondDone.exclude]).toEqual([...firstDone.exclude]);
    expect(secondDone.exhausted).toBe(firstDone.exhausted);

    const one: Proposal[] = [];
    streamFill([], choice, new Set(), DEFAULT_FORMAT, fillData, p => one.push(p), { max: 1 });
    expect(one).toEqual([first[0]]);
  });

  it('"finiti" resta con il risultato in cache; con max più corto della cache no', async () => {
    const team = [{ ...defaultSet('Garchomp') }];
    const only = { ...defaultChoice(team), favorites: 'only' as const };
    const first = await streamFill(team, only, new Set(), DEFAULT_FORMAT, fillData, () => undefined).done;
    expect(first.exhausted).toBe(true);
    const replay = streamFill(team, only, new Set(), DEFAULT_FORMAT, fillData, () => undefined);
    expect((await replay.done).exhausted).toBe(true);

    const choice = defaultChoice([]);
    const got: Proposal[] = [];
    await streamFill([], choice, new Set(), DEFAULT_FORMAT, fillData, p => got.push(p)).done;
    expect((await streamFill([], choice, new Set(), DEFAULT_FORMAT, fillData, () => undefined, { max: 1 }).done).exhausted).toBe(false);
  });

  it('chi si aggancia a un calcolo in corso riceve anche "finiti"', async () => {
    const team = [{ ...defaultSet('Toxapex') }];
    const only = { ...defaultChoice(team), favorites: 'only' as const };
    const first = streamFill(team, only, new Set(), DEFAULT_FORMAT, fillData, () => undefined);
    const joined = streamFill(team, only, new Set(), DEFAULT_FORMAT, fillData, () => undefined);
    expect((await first.done).exhausted).toBe(true);
    expect((await joined.done).exhausted).toBe(true);
  });

  it('un calcolo che si rompe lo dice (failed) invece di sembrare un tipo senza proposte', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken: EngineData = { ...fillData, stats: { ...fillData.stats!, pokemon: null as never } };
    const got: Proposal[] = [];
    const result = await streamFill([], { archetype: null, style: null }, new Set(), DEFAULT_FORMAT, broken, p => got.push(p)).done;
    expect(result.failed).toBe(true);
    expect(got).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('un errore di chi riceve le proposte non ferma il calcolo', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls = 0;
    const result = await streamFill([], { archetype: 'stall', style: null }, new Set(['nessuno']), DEFAULT_FORMAT, fillData,
      () => { calls++; throw new Error('chi riceve'); }).done;
    expect(result.failed).toBe(false);
    expect(calls).toBeGreaterThan(0);
    expect(error).toHaveBeenCalledTimes(calls);
    error.mockRestore();
  });
});
