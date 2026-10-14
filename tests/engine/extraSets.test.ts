import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { scoreCandidates } from '../../src/engine/scoring';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

describe('scoreCandidates con extraSets', () => {
  it('valuta il set extra con lo stesso oggetto, anche fuori dal pool', () => {
    const magikarp: TeamSet = { ...emptySet('Magikarp'), moves: ['Splash'] };
    const list = scoreCandidates([tusk], DEFAULT_FORMAT, fixtureData, [magikarp]);
    const scored = list.find(s => s.set === magikarp);
    expect(scored?.species).toBe('Magikarp');
    expect(scored!.score).toBeGreaterThanOrEqual(0);
  });

  it('un extra sostituisce il candidato del pool con la stessa specie', () => {
    const custom: TeamSet = { ...gholdengo, moves: ['Make It Rain'] };
    const list = scoreCandidates([tusk], DEFAULT_FORMAT, fixtureData, [custom]);
    expect(list.filter(s => s.species === 'Gholdengo')).toHaveLength(1);
    expect(list.find(s => s.species === 'Gholdengo')!.set).toBe(custom);
  });

  it('senza extra il risultato non cambia', () => {
    expect(scoreCandidates([tusk], DEFAULT_FORMAT, fixtureData, []))
      .toEqual(scoreCandidates([tusk], DEFAULT_FORMAT, fixtureData));
  });
});
