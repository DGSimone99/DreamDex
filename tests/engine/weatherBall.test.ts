import { describe, expect, it } from 'vitest';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { attackingMoves, coverageTable, superEffectiveMoves, teamField } from '../../src/engine/types';

const set = (species: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), ability, moves });
const ninetales = set('Ninetales', 'Drought', ['Weather Ball', 'Will-O-Wisp', 'Encore', 'Healing Wish']);
const leafeon = set('Leafeon', 'Chlorophyll', ['Swords Dance', 'Knock Off', 'Solar Blade', 'Weather Ball']);

describe('Weather Ball e Terrain Pulse', () => {
  it('Weather Ball prende il tipo del meteo che il Pokémon porta da sé', () => {
    expect(attackingMoves(ninetales).find(m => m.name === 'Weather Ball')!.type).toBe('Fire');
    expect(superEffectiveMoves(ninetales, 'Grass')).toContain('Weather Ball');
  });

  it('nel team prende il meteo del compagno (Leafeon col sole di Ninetales); da solo resta Normale', () => {
    expect(attackingMoves(leafeon).find(m => m.name === 'Weather Ball')!.type).toBe('Normal');
    const field = teamField([ninetales, leafeon]);
    expect(field.weather).toBe('sun');
    expect(attackingMoves(leafeon, field).find(m => m.name === 'Weather Ball')!.type).toBe('Fire');
    expect(coverageTable([ninetales, leafeon]).find(r => r.type === 'Steel')!.hitters.map(h => h.member)).toEqual(['Ninetales', 'Leafeon']);
  });

  it('Terrain Pulse prende il tipo del campo (Psychic Surge: Psico)', () => {
    const indeedee = set('Indeedee', 'Psychic Surge', ['Terrain Pulse', 'Calm Mind', 'Protect', 'Mystical Fire']);
    expect(attackingMoves(indeedee).find(m => m.name === 'Terrain Pulse')!.type).toBe('Psychic');
  });
});
