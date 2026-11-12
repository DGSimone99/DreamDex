import { describe, expect, it } from 'vitest';
import { defaultChoice, type Proposal } from '../../src/engine/fillProposals';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { streamFill } from '../../src/ui/useRanking';
import { fillData } from '../fixtures/fillData';

// Senza Worker (jsdom): streamFill avanza il generatore qui, un passo per volta con setTimeout(0)
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('streamFill (senza calcolo in sottofondo)', () => {
  it('consegna da 1 a 5 proposte una alla volta e poi finisce', async () => {
    const got: Proposal[] = [];
    const { done } = streamFill([], { archetype: 'stall', style: null }, new Set(), DEFAULT_FORMAT, fillData, p => got.push(p));
    const exclude = await done;
    expect(got.length).toBeGreaterThanOrEqual(1);
    expect(got.length).toBeLessThanOrEqual(5);
    // Le forme proposte finiscono fra gli esclusi: "Altre proposte" non le ripete
    expect(exclude.size).toBeGreaterThanOrEqual(got[0].added.length);
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

  it('la stessa richiesta una seconda volta si ripete subito dalla cache', async () => {
    const choice = defaultChoice([]);
    const first: Proposal[] = [];
    await streamFill([], choice, new Set(), DEFAULT_FORMAT, fillData, p => first.push(p)).done;
    expect(first.length).toBeGreaterThan(0);

    const order: string[] = [];
    const second: Proposal[] = [];
    const run = streamFill([], { ...choice }, new Set(), DEFAULT_FORMAT, fillData, p => { order.push('proposal'); second.push(p); });
    setTimeout(() => order.push('tick'), 0);
    await run.done;
    await tick();
    expect(order.indexOf('tick')).toBe(first.length);
    expect(second).toEqual(first);
  });
});
