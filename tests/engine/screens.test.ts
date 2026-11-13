import { describe, expect, it } from 'vitest';
import { SCREEN_SHARE, SCREEN_SHARE_CLAY, teamDefense, teamScreens, typedHits } from '../../src/engine/defense';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ ...emptySet(species), item, ability, moves });
const tusk = set('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush']);
const grimm = (item: string) => set('Grimmsnarl', item, 'Prankster', ['Reflect', 'Light Screen']);

describe('schermi in Difesa', () => {
  it('Reflect e Light Screen per la quota di partita: 5 turni, 8 con Light Clay', () => {
    expect(teamScreens([tusk])).toEqual({ physical: 0, special: 0 });
    expect(teamScreens([tusk, grimm('Leftovers')])).toEqual({ physical: SCREEN_SHARE, special: SCREEN_SHARE });
    expect(teamScreens([tusk, grimm('Light Clay')])).toEqual({ physical: SCREEN_SHARE_CLAY, special: SCREEN_SHARE_CLAY });
  });

  it('Aurora Veil conta solo con la neve del team', () => {
    const veil = set('Ninetales-Alola', 'Light Clay', 'Snow Cloak', ['Aurora Veil']);
    expect(teamScreens([veil])).toEqual({ physical: 0, special: 0 });
    const snow = { ...veil, ability: 'Snow Warning' };
    expect(teamScreens([snow])).toEqual({ physical: SCREEN_SHARE_CLAY, special: SCREEN_SHARE_CLAY });
  });

  it('i colpi ricevuti scendono e la Difesa sale', () => {
    const alone = typedHits(tusk, fixtureData, [tusk]).plain;
    const screened = typedHits(tusk, fixtureData, [tusk, grimm('Light Clay')]).plain;
    expect(screened.every((x, i) => x <= alone[i])).toBe(true);
    expect(screened.some((x, i) => x < alone[i])).toBe(true);
    const noScreens = { ...grimm('Light Clay'), moves: ['Spirit Break'] };
    expect(teamDefense([tusk, grimm('Light Clay')], fixtureData).value).toBeGreaterThan(teamDefense([tusk, noScreens], fixtureData).value);
  });
});
