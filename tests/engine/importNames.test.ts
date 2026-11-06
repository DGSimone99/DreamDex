import { describe, expect, it } from 'vitest';
import { bestHit } from '../../src/engine/damage';
import { typedHits } from '../../src/engine/defense';
import { importShowdown, type TeamSet } from '../../src/engine/sets';

const noStats = { stats: null, sets: null, formatId: 'ou' as const };
const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const clefable = set('Clefable', 'Leftovers', 'Magic Guard', ['Moonblast'], 'Bold', { hp: 252, def: 252 });

describe('nomi scritti male', () => {
  it("all'import: strumento, abilità e mosse col nome giusto; natura sconosciuta neutra e segnalata", () => {
    const { sets, errors } = importShowdown('Rillaboom @ choice band\nAbility: grassy surge\nEVs: 252 Atk / 252 Spe\nGrumpy Nature\n- grassy glide\n- wood hammer', 'it');
    expect(sets[0]).toMatchObject({ item: 'Choice Band', ability: 'Grassy Surge', nature: 'Serious', moves: ['Grassy Glide', 'Wood Hammer'] });
    expect(errors).toEqual(['Rillaboom: natura sconosciuta "Grumpy", usata una neutra']);
  });

  it("all'import uno strumento sconosciuto resta ma è segnalato", () => {
    const { sets, errors } = importShowdown('Clefable @ Magic Wand\nBold Nature\n- Moonblast', 'it');
    expect(sets[0].item).toBe('Magic Wand');
    expect(errors).toEqual(['Clefable: strumento sconosciuto "Magic Wand", non conta']);
  });

  it('nel calcolo: natura sconosciuta = neutra, il membro prende e fa danni; strumento in minuscolo vale', () => {
    const grumpy = { ...clefable, nature: 'Grumpy' };
    expect(Math.max(...typedHits(grumpy, noStats).plain)).toBeGreaterThan(0);
    expect(typedHits(grumpy, noStats).plain).toEqual(typedHits({ ...clefable, nature: 'Serious' }, noStats).plain);
    const band = set('Rillaboom', 'Choice Band', 'Grassy Surge', ['Wood Hammer'], 'Adamant', { atk: 252, spe: 252 });
    expect(bestHit({ ...band, item: 'choice band' }, clefable)!.expected).toBe(bestHit(band, clefable)!.expected);
    expect(bestHit({ ...band, item: 'Magic Wand' }, clefable)!.expected).toBe(bestHit({ ...band, item: '' }, clefable)!.expected);
  });
});
