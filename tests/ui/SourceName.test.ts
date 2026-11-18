import { afterEach, describe, expect, it } from 'vitest';
import { initGameNames } from '../../src/i18n/game';
import { sourceName } from '../../src/ui/defense/DefenseGeneral';

describe('nomi delle fonti di recupero e perdita', () => {
  afterEach(() => initGameNames(null));

  it('in italiano mosse, abilità e strumenti coi nomi ufficiali; il Pokémon fra parentesi resta inglese', () => {
    initGameNames({
      moves: { recover: { name: 'Ripresa' }, rapidspin: { name: 'Rapigiro' }, stealthrock: { name: 'Levitoroccia' } },
      abilities: { regenerator: { name: 'Rigenergia' } },
      items: { blacksludge: { name: 'Fangopece' } },
      types: {}, natures: {},
    });
    expect(sourceName('Recover + Regenerator + Black Sludge', 'it')).toBe('Ripresa + Rigenergia + Fangopece');
    expect(sourceName('Rapid Spin (Great Tusk)', 'it')).toBe('Rapigiro (Great Tusk)');
    expect(sourceName('Stealth Rock', 'it')).toBe('Levitoroccia');
    expect(sourceName('Recover', 'en')).toBe('Recover');
  });
});
