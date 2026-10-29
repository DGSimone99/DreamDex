import { describe, expect, it } from 'vitest';
import { emptySet } from '../../src/engine/sets';
import { offenseSlots } from '../../src/ui/offense/slots';

const mons = (...names: string[]) => names.map(species => ({ species }));

describe('offenseSlots', () => {
  it('ogni membro al suo posto', () => {
    const team = [emptySet('Great Tusk'), emptySet('Gholdengo')];
    expect(offenseSlots(team, mons('Great Tusk', 'Gholdengo'))).toEqual([0, 1]);
  });

  it('membro scartato dal motore: null al suo posto', () => {
    const team = [emptySet('Great Tusk'), emptySet('Blissey'), emptySet('Gholdengo')];
    expect(offenseSlots(team, mons('Great Tusk', 'Gholdengo'))).toEqual([0, null, 1]);
  });

  it('due membri della stessa specie', () => {
    const team = [emptySet('Garchomp'), emptySet('Garchomp')];
    expect(offenseSlots(team, mons('Garchomp', 'Garchomp'))).toEqual([0, 1]);
  });

  it('Mega: confronta il nome in battaglia', () => {
    const team = [{ ...emptySet('Garchomp'), item: 'Garchompite' }];
    expect(offenseSlots(team, mons('Garchomp-Mega'))).toEqual([0]);
  });
});
