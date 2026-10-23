import { describe, expect, it } from 'vitest';
import { attackerPanels, metaThreats, PANEL_ATTACKERS } from '../../src/engine/attackers';
import { getMove } from '../../src/engine/dex';
import { attackStyle } from '../../src/engine/roles';
import { fixtureData } from '../fixtures/data';

const noStats = { stats: null, sets: null, formatId: 'ou' as const };

describe('attackerPanels: attaccanti fisici e speciali del formato', () => {
  it('col meta: due gruppi, ognuno con attaccanti del suo stile (i misti in entrambi)', () => {
    const { physical, special } = attackerPanels(fixtureData);
    expect(PANEL_ATTACKERS).toBe(10);
    expect(physical.length).toBeGreaterThan(0);
    expect(special.length).toBeGreaterThan(0);
    expect(physical.length).toBeLessThanOrEqual(10);
    // I set standard del tier (completamento) non hanno mosse: lo stile si controlla su quelli del meta
    for (const set of physical.filter(s => s.moves.length)) expect(['physical', 'mixed']).toContain(attackStyle(set));
    for (const set of special.filter(s => s.moves.length)) expect(['special', 'mixed']).toContain(attackStyle(set));
  });

  it('senza statistiche: i 10 più forti del tier per lato, con un set offensivo standard senza strumento', () => {
    const { physical, special } = attackerPanels(noStats);
    expect([physical.length, special.length]).toEqual([10, 10]);
    expect(physical.every(s => s.evs.atk === 252 && s.item === '')).toBe(true);
    expect(special.every(s => s.evs.spa === 252 && s.item === '')).toBe(true);
  });

  it('si calcola una volta per formato e meta', () => {
    expect(attackerPanels(fixtureData)).toBe(attackerPanels(fixtureData));
  });
});

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
