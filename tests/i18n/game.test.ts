import { afterEach, describe, expect, it } from 'vitest';
import { anyGameName, gameDesc, gameName, initGameNames, natureName, statShort, typeName } from '../../src/i18n/game';

const italian = {
  moves: { earthquake: { name: 'Terremoto', desc: 'Colpisce tutti.' }, solarbeam: { name: 'Solarraggio' } },
  abilities: { drought: { name: 'Siccità', desc: 'Il sole si fa intenso.' } },
  items: { leftovers: { name: 'Avanzi' } },
  types: { fire: 'Fuoco', ground: 'Terra' },
  natures: { adamant: 'Decisa' },
};

afterEach(() => initGameNames(null));

describe('nomi del gioco', () => {
  it('italiano con i dati, inglese senza traduzione o in inglese', () => {
    initGameNames(italian);
    expect(gameName('move', 'Earthquake', 'it')).toBe('Terremoto');
    expect(gameName('move', 'Earthquake', 'en')).toBe('Earthquake');
    expect(gameName('move', 'Flamethrower', 'it')).toBe('Flamethrower');
    expect(gameName('item', 'Leftovers', 'it')).toBe('Avanzi');
    expect(typeName('Fire', 'it')).toBe('Fuoco');
    expect(natureName('Adamant', 'it')).toBe('Decisa');
    expect(anyGameName('Drought', 'it')).toBe('Siccità');
    expect(anyGameName('Solar Beam', 'it')).toBe('Solarraggio');
  });

  it('descrizioni: italiana se c\'è, altrimenti quella inglese passata', () => {
    initGameNames(italian);
    expect(gameDesc('move', 'Earthquake', 'it', 'Hits all.')).toBe('Colpisce tutti.');
    expect(gameDesc('item', 'Leftovers', 'it', 'Heals.')).toBe('Heals.');
    expect(gameDesc('move', 'Earthquake', 'en', 'Hits all.')).toBe('Hits all.');
  });

  it('gameName falls back when no data', () => {
    initGameNames(null);
    expect(gameName('move', 'Earthquake', 'it')).toBe('Earthquake');
    expect(typeName('Fire', 'it')).toBe('Fire');
  });

  it('abbreviazioni delle statistiche', () => {
    expect(statShort('spa', 'en')).toBe('SpA');
    expect(statShort('spa', 'it')).toBe('AttSp');
    expect(statShort('hp', 'it')).toBe('PS');
  });
});
