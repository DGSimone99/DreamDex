import { describe, expect, it } from 'vitest';
import { alignMoves, improveSets } from '../../src/engine/bestPreset';
import { emptySet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

describe('Migliora i set: confronto prima e dopo', () => {
  it('le mosse che restano tengono il loro posto, le nuove prendono i posti liberati', () => {
    expect(alignMoves(['Surf', 'Haze', 'Recover', 'Toxic Spikes'], ['Recover', 'Toxic', 'Haze', 'Toxic Spikes']))
      .toEqual(['Toxic', 'Haze', 'Recover', 'Toxic Spikes']);
    expect(alignMoves(['Tackle', '', '', ''], ['Earthquake', 'Tackle'])).toEqual(['Tackle', 'Earthquake']);
    expect(alignMoves(['A', 'B'], ['C', 'D', 'E'])).toEqual(['C', 'D', 'E']);
  });

  it('un membro per posto; chi non cambia ha guadagno 0, chi cambia ha il voto del team con solo il suo cambio', () => {
    const team = Array.from({ length: 6 }, () => ({ ...emptySet('Great Tusk'), moves: ['Tackle', '', '', ''] }));
    const changes = improveSets(team, fixtureData, 9);
    expect(changes).toHaveLength(6);
    changes.forEach((change, i) => {
      expect(change.before).toBe(team[i]);
      if (!change.changed) expect(change.gain).toBe(0);
      expect(Number.isFinite(change.gain)).toBe(true);
    });
  });
});
