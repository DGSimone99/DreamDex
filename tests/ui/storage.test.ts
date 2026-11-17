import { describe, expect, it } from 'vitest';
import { loadLists, loadSavedTeams, saveLists, saveTeams } from '../../src/storage';
import { EMPTY_LISTS, effectiveLists, type UserLists } from '../../src/engine/lists';

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
    const lists: UserLists = {
      universal: { favorites: ['Garchomp'], bans: [] },
      byContext: { ou: { favorites: [], bans: ['Toxapex'] }, sv: { favorites: ['Meowscarada'], bans: [] } },
      custom: [{ id: 'c1', name: 'Pioggia', favorites: ['Pelipper'], bans: ['Ferrothorn'] }],
      active: { ou: 'c1' },
    };
    expect(saveLists(lists, storage)).toBe(true);
    expect(loadLists(storage)).toEqual(lists);
    expect(loadLists(memory('{non json'))).toEqual(EMPTY_LISTS);
    expect(loadLists(throwing)).toEqual(EMPTY_LISTS);
  });
});

describe('storage: liste salvate prima delle raccolte', () => {
  // Forma salvata fino al 2026-11-17: { universal, byFormat } (una coppia Preferiti/Bannati per formato)
  const legacy = {
    universal: { favorites: ['Garchomp', 'Leafeon'], bans: ['Smeargle'] },
    byFormat: {
      ou: { favorites: ['Great Tusk', 'Kingambit'], bans: ['Toxapex'] },
      gen9ou: { favorites: [], bans: ['Blissey'] },
      gen9ag: { favorites: ['Koraidon'], bans: ['Luvdisc'] },
    },
  };

  it("ogni lista per formato diventa la raccolta del formato, l'universale resta, niente si perde", () => {
    const lists = loadLists(memory(JSON.stringify(legacy)));
    expect(lists.universal).toEqual(legacy.universal);
    expect(lists.byContext.ou).toEqual(legacy.byFormat.ou);
    expect(lists.byContext.gen9ou).toEqual(legacy.byFormat.gen9ou);
    expect(lists.byContext.gen9ag).toEqual(legacy.byFormat.gen9ag);
    expect(lists.custom).toEqual([]);
    expect(lists.active).toEqual({});
  });

  it('la lista di Anything Goes vale ancora col gioco Scarlatto e Violetto (che impone quel formato)', () => {
    const lists = loadLists(memory(JSON.stringify(legacy)));
    expect(lists.byContext.sv).toEqual(legacy.byFormat.gen9ag);
    // Le liste che usano i suggerimenti sono le stesse di prima, nel formato e nel gioco
    expect([...effectiveLists(lists, 'sv').favorites].sort()).toEqual(['Garchomp', 'Koraidon', 'Leafeon']);
    expect([...effectiveLists(lists, 'ou').bans].sort()).toEqual(['Smeargle', 'Toxapex']);
  });

  it('salvata di nuovo, si rilegge uguale (la migrazione non si ripete)', () => {
    const storage = memory(JSON.stringify(legacy));
    const once = loadLists(storage);
    saveLists(once, storage);
    expect(loadLists(storage)).toEqual(once);
  });

  it("solo l'universale, o un formato sconosciuto: si tiene quello che vale", () => {
    expect(loadLists(memory(JSON.stringify({ universal: { favorites: ['Mew'], bans: [] } }))).universal.favorites).toEqual(['Mew']);
    const lists = loadLists(memory(JSON.stringify({ universal: {}, byFormat: { bogus: { favorites: ['Mew'], bans: [] }, ou: { favorites: ['Mew'] } } })));
    expect(lists.byContext).toEqual({ ou: { favorites: ['Mew'], bans: [] } });
  });

  it('raccolte nuove: personalizzate senza id o scelte inesistenti si scartano', () => {
    const lists = loadLists(memory(JSON.stringify({
      universal: { favorites: [], bans: [] }, byContext: {},
      custom: [{ id: 'c1', name: 'X', favorites: ['Mew'], bans: [] }, { name: 'senza id', favorites: [], bans: [] }],
      active: { ou: 'c1', gen9ou: 'c9', bogus: 'c1' },
    })));
    expect(lists.custom.map(c => c.id)).toEqual(['c1']);
    expect(lists.active).toEqual({ ou: 'c1' });
  });
});
