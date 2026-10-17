import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { teamSpeed } from '../../src/engine/speed';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly'): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs: { spe: 252 } });
const noMeta: EngineData = { stats: null, sets: null };
const dragapult = set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'Flamethrower', 'U-turn'], 'Timid');
const valiant = set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Timid');
const toxapex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Toxic', 'Haze'], 'Bold');

describe('area Velocità', () => {
  it('dai due attaccanti più veloci: senza meta contro tutti i Pokémon, col meta contro le minacce più usate', () => {
    expect(teamSpeed([dragapult, valiant], noMeta, null)).toBeGreaterThan(0.9);
    expect(teamSpeed([dragapult, valiant], fixtureData, ['Great Tusk', 'Gholdengo', 'Kingambit'])).toBe(1);
  });

  it('un Pokémon veloce che non fa danni non conta (Toxapex non attacca): il posto mancante vale zero', () => {
    const alone = teamSpeed([dragapult], noMeta, null);
    expect(teamSpeed([dragapult, toxapex], noMeta, null)).toBe(alone);
    expect(alone).toBeLessThan(0.5 + 1e-9);
  });

  it('un team con Trick Room è lento per scelta: la Velocità non conta e non si mostra', () => {
    const tr = [set('Hatterene', 'Life Orb', 'Magic Bounce', ['Trick Room', 'Psychic', 'Dazzling Gleam', 'Mystical Fire'], 'Quiet'), toxapex];
    expect(rateTeam(tr, noMeta)!.areas.map(a => a.key)).not.toContain('speed');
    expect(rateTeam([dragapult, toxapex], noMeta)!.areas.map(a => a.key)).toContain('speed');
  });
});
