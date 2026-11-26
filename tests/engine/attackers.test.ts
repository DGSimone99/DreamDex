import { describe, expect, it } from 'vitest';
import { metaThreats } from '../../src/engine/attackers';
import { getMove } from '../../src/engine/dex';
import { fixtureData } from '../fixtures/data';


describe('metaThreats: le minacce del meta', () => {
  it('i più usati con almeno una mossa d\'attacco, pesati per uso', () => {
    const threats = metaThreats(fixtureData);
    expect(threats.length).toBeGreaterThan(0);
    expect(threats.reduce((a, t) => a + t.weight, 0)).toBeCloseTo(1);
    for (const t of threats) expect(t.set.moves.some(m => (getMove(m)?.category ?? 'Status') !== 'Status')).toBe(true);
  });

  it('senza meta nessuna minaccia', () => {
    expect(metaThreats({ ...fixtureData, ignoreMeta: true })).toEqual([]);
  });
});
