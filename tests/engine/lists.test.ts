import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import {
  applyFavorites, copyLists, effectiveLists, EMPTY_LISTS, isUserBanned, isUserFavorite, sanitizeLists, toggleIn, type UserLists,
} from '../../src/engine/lists';

const lists = (patch: Partial<UserLists>): UserLists => ({ ...EMPTY_LISTS, ...patch });
const pair = (favorites: string[] = [], bans: string[] = []) => ({ favorites, bans });

describe('liste: forma salvata', () => {
  it('sanitizeLists: dati assenti o rotti diventano liste vuote', () => {
    expect(sanitizeLists(null)).toEqual(EMPTY_LISTS);
    expect(sanitizeLists({ universal: 'x' })).toEqual(EMPTY_LISTS);
  });

  it('sanitizeLists: nomi canonici, niente nomi sconosciuti né formati inesistenti', () => {
    const clean = sanitizeLists({
      universal: { favorites: ['Garchomp', 'Notamon', 3], bans: [] },
      byFormat: { ou: { favorites: [], bans: ['toxapex'] }, bogus: { favorites: ['Mew'], bans: [] } },
    });
    expect(clean.universal.favorites).toEqual(['Garchomp']);
    expect(clean.byFormat.ou?.bans).toEqual(['Toxapex']);
    expect(Object.keys(clean.byFormat)).toEqual(['ou']);
  });
});

describe('liste: modifiche', () => {
  it('toggleIn: un Pokémon sta in una sola lista dello stesso ambito; di nuovo lo toglie', () => {
    const fav = toggleIn(EMPTY_LISTS, 'ou', 'favorites', 'Leafeon');
    const banned = toggleIn(fav, 'ou', 'bans', 'Leafeon');
    expect(banned.byFormat.ou).toEqual(pair([], ['Leafeon']));
    expect(banned.universal).toEqual(EMPTY_LISTS.universal);
    expect(toggleIn(banned, 'ou', 'bans', 'Leafeon').byFormat.ou).toEqual(pair());
  });

  it('copyLists: salta chi non c\'è o è bannato nel formato, e chi è già nell\'altra lista di destinazione', () => {
    const source = lists({ byFormat: { ou: pair(['Kyogre', 'Garchomp', 'Leafeon']), gen9ou: pair([], ['Leafeon']) } });
    const result = copyLists(source, 'ou', 'gen9ou', { ...DEFAULT_FORMAT, formatId: 'gen9ou' });
    expect(result.lists.byFormat.gen9ou).toEqual(pair(['Garchomp'], ['Leafeon']));
    expect({ copied: result.copied, skipped: result.skipped }).toEqual({ copied: 1, skipped: 2 });
  });
});

describe('liste effettive', () => {
  it('effectiveLists: format scope wins', () => {
    const effective = effectiveLists(lists({ universal: pair(['Garchomp', 'Leafeon']), byFormat: { ou: pair([], ['Garchomp']) } }), 'ou');
    expect(effective.bans.has('Garchomp')).toBe(true);
    expect(effective.favorites.has('Garchomp')).toBe(false);
    expect(effective.overridden.get('Garchomp')).toBe('favorites');
    expect(effective.favorites.has('Leafeon')).toBe(true);
    expect(effective.universal.has('Leafeon')).toBe(true);
  });

  it('isUserBanned: base bans formes and Megas', () => {
    const effective = effectiveLists(lists({ byFormat: { ou: pair([], ['Charizard']) } }), 'ou');
    expect(isUserBanned({ species: 'Charizard', item: 'Charizardite X' }, effective)).toBe(true);
    expect(isUserBanned({ species: 'Charizard', item: '' }, effective)).toBe(true);
    expect(isUserBanned({ species: 'Garchomp', item: '' }, effective)).toBe(false);
    expect(isUserBanned({ species: 'Charizard', item: '' }, undefined)).toBe(false);
  });

  it('isUserBanned: single Mega', () => {
    const effective = effectiveLists(lists({ byFormat: { ou: pair([], ['Charizard-Mega-X']) } }), 'ou');
    expect(isUserBanned({ species: 'Charizard', item: 'Charizardite X' }, effective)).toBe(true);
    expect(isUserBanned({ species: 'Charizard', item: 'Charizardite Y' }, effective)).toBe(false);
    expect(isUserBanned({ species: 'Charizard', item: '' }, effective)).toBe(false);
    expect(isUserBanned({ species: 'Charizard', item: 'Charizardite X' }, { ...effective, allow: new Set(['Charizard-Mega-X']) })).toBe(false);
  });

  it('isUserFavorite: stesse regole delle forme', () => {
    const effective = effectiveLists(lists({ universal: pair(['Charizard']) }), 'ou');
    expect(isUserFavorite({ species: 'Charizard', item: 'Charizardite Y' }, effective)).toBe(true);
    expect(isUserFavorite({ species: 'Venusaur', item: '' }, effective)).toBe(false);
  });
});

describe('preferiti: a pari quasi merito passano avanti', () => {
  it('applyFavorites', () => {
    const items = [{ id: 'A', v: 80 }, { id: 'B', v: 79 }, { id: 'C', v: 78, fav: true }, { id: 'D', v: 70 }, { id: 'E', v: 60, fav: true }];
    expect(applyFavorites(items, i => !!i.fav, i => i.v).map(i => i.id)).toEqual(['C', 'A', 'B', 'D', 'E']);
  });

  it('due preferiti vicini restano nel loro ordine', () => {
    const items = [{ id: 'A', v: 80 }, { id: 'B', v: 79, fav: true }, { id: 'C', v: 79, fav: true }];
    expect(applyFavorites(items, i => !!i.fav, i => i.v).map(i => i.id)).toEqual(['B', 'C', 'A']);
  });
});
