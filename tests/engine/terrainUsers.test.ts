import { describe, expect, it } from 'vitest';
import { conditionUsedBonus } from '../../src/engine/rating';
import { benefits, usesCondition } from '../../src/engine/synergy';
import { emptySet, type TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });
const lele = set('Tapu Lele', 'Terrain Extender', 'Psychic Surge', ['Psyshock', 'Moonblast']);
const hawlucha = set('Hawlucha', 'Psychic Seed', 'Unburden', ['Close Combat', 'Acrobatics', 'Swords Dance']);
const polteageist = set('Polteageist', 'Focus Sash', 'Weak Armor', ['Shadow Ball', 'Stored Power', 'Shell Smash']);

describe('chi sfrutta un campo', () => {
  it('il Seme del campo: chi lo tiene ne dipende', () => {
    expect(benefits(hawlucha)).toContainEqual({ condition: 'psychicterrain', via: 'Psychic Seed' });
    expect(usesCondition(hawlucha, 'psychicterrain')).toBe(true);
  });

  it('chi attacca a terra col tipo potenziato lo sfrutta, ma non ne dipende', () => {
    expect(usesCondition(polteageist, 'psychicterrain')).toBe(true);
    expect(benefits(polteageist).some(b => b.condition === 'psychicterrain')).toBe(false);
    // Un Volante non sta a terra: il campo non potenzia i suoi colpi
    expect(usesCondition(set('Hatterene', '', 'Magic Bounce', ['Psychic']), 'psychicterrain')).toBe(true);
    expect(usesCondition(set('Latios', '', 'Levitate', ['Psyshock']), 'psychicterrain')).toBe(false);
  });

  it('un team costruito sul Campo Psichico prende il bonus', () => {
    expect(conditionUsedBonus([lele, hawlucha, polteageist]).map(i => i.catalog)).toEqual(['conditionUsed']);
  });
});
