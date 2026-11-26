import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { improveReplacements } from '../../src/engine/replace';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, tusk } from '../fixtures/data';

const set = (species: string, item: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, moves });

describe('una Mega non ricompare come sostituto di sé stessa', () => {
  // La stessa Mega può essere salvata col nome base e la pietra, o col nome della forma Mega
  for (const member of [
    set('Gardevoir', 'Gardevoirite', ['Hyper Voice', 'Psyshock', 'Focus Blast', 'Calm Mind']),
    set('Gardevoir-Mega', 'Gardevoirite', ['Hyper Voice', 'Psyshock', 'Focus Blast', 'Calm Mind']),
  ]) {
    it(`membro "${member.species}" con la Gardevoirite`, () => {
      const team = [tusk, member];
      const pool = [set('Gardevoir', 'Gardevoirite', ['Moonblast', 'Psychic', 'Mystical Fire', 'Calm Mind']), set('Gardevoir-Mega', 'Gardevoirite', ['Moonblast'])];
      for (const list of [improveReplacements(team, 1, DEFAULT_FORMAT, fixtureData, 20, pool)]) {
        expect(list.map(r => r.species)).not.toContain('Gardevoir-Mega');
      }
    });
  }
});
