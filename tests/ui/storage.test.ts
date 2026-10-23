import { describe, expect, it } from 'vitest';
import { loadLists, loadSavedTeams, saveLists, saveTeams } from '../../src/storage';
import { EMPTY_LISTS } from '../../src/engine/lists';

const throwing = {
  getItem: () => { throw new Error('bloccato'); },
  setItem: () => { throw new Error('bloccato'); },
} as unknown as Storage;

const memory = (initial: string | null) => {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_: string, v: string) => { value = v; },
  } as unknown as Storage;
};

describe('storage', () => {
  it('storage che lancia errori: lista vuota, salvataggio fallito', () => {
    expect(loadSavedTeams(throwing)).toEqual([]);
    expect(saveTeams([{ name: 'a', text: 'x' }], throwing)).toBe(false);
  });

  it('JSON corrotto o di forma sbagliata: lista vuota', () => {
    expect(loadSavedTeams(memory('{non json'))).toEqual([]);
    expect(loadSavedTeams(memory('{"a":1}'))).toEqual([]);
  });

  it('round-trip', () => {
    const storage = memory(null);
    expect(saveTeams([{ name: 'Prova', text: 'Great Tusk' }], storage)).toBe(true);
    expect(loadSavedTeams(storage)).toEqual([{ name: 'Prova', text: 'Great Tusk' }]);
  });

  it('formato di un team salvato non valido: torna ai valori di default', () => {
    const saved = loadSavedTeams(memory(JSON.stringify([{ name: 'X', text: 'Great Tusk', format: { formatId: 'zzz' } }])));
    expect(saved[0].format?.formatId).toBe('ou');
  });

  it('storage assente', () => {
    expect(loadSavedTeams(undefined)).toEqual([]);
  });

  it('liste: round-trip e JSON rotto', () => {
    const storage = memory(null);
    const lists = { universal: { favorites: ['Garchomp'], bans: [] }, byFormat: { ou: { favorites: [], bans: ['Toxapex'] } } };
    expect(saveLists(lists, storage)).toBe(true);
    expect(loadLists(storage)).toEqual(lists);
    expect(loadLists(memory('{non json'))).toEqual(EMPTY_LISTS);
    expect(loadLists(throwing)).toEqual(EMPTY_LISTS);
  });
});
