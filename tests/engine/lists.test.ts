import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import {
  activeScope, applyFavorites, copyLists, createList, customScope, deleteList, effectiveLists, EMPTY_LISTS, isUserBanned, isUserFavorite,
  listContext, renameList, sanitizeLists, scopeLists, setActive, toggleIn, type UserLists,
} from '../../src/engine/lists';

const lists = (patch: Partial<UserLists>): UserLists => ({ ...EMPTY_LISTS, ...patch });
const pair = (favorites: string[] = [], bans: string[] = []) => ({ favorites, bans });

describe('liste: forma salvata', () => {
  it('sanitizeLists: dati assenti o rotti diventano liste vuote', () => {
    expect(sanitizeLists(null)).toEqual(EMPTY_LISTS);
    expect(sanitizeLists({ universal: 'x' })).toEqual(EMPTY_LISTS);
  });

  it('sanitizeLists: nomi canonici, niente nomi sconosciuti né formati inesistenti (anche dalla forma vecchia, byFormat)', () => {
    const clean = sanitizeLists({
      universal: { favorites: ['Garchomp', 'Notamon', 3], bans: [] },
      byFormat: { ou: { favorites: [], bans: ['toxapex'] }, bogus: { favorites: ['Mew'], bans: [] } },
    });
    expect(clean.universal.favorites).toEqual(['Garchomp']);
    expect(clean.byContext.ou?.bans).toEqual(['Toxapex']);
    expect(Object.keys(clean.byContext)).toEqual(['ou']);
  });
});

describe('liste: modifiche', () => {
  it('toggleIn: un Pokémon sta in una sola lista dello stesso ambito; di nuovo lo toglie', () => {
    const fav = toggleIn(EMPTY_LISTS, 'ou', 'favorites', 'Leafeon');
    const banned = toggleIn(fav, 'ou', 'bans', 'Leafeon');
    expect(banned.byContext.ou).toEqual(pair([], ['Leafeon']));
    expect(banned.universal).toEqual(EMPTY_LISTS.universal);
    expect(toggleIn(banned, 'ou', 'bans', 'Leafeon').byContext.ou).toEqual(pair());
  });

  it('copyLists: salta chi non c\'è o è bannato nel formato, e chi è già nell\'altra lista di destinazione', () => {
    const source = lists({ byContext: { ou: pair(['Kyogre', 'Garchomp', 'Leafeon']), gen9ou: pair([], ['Leafeon']) } });
    const result = copyLists(source, 'ou', 'gen9ou', { ...DEFAULT_FORMAT, formatId: 'gen9ou' });
    expect(result.lists.byContext.gen9ou).toEqual(pair(['Garchomp'], ['Leafeon']));
    expect({ copied: result.copied, skipped: result.skipped }).toEqual({ copied: 1, skipped: 2 });
  });
});

describe('liste effettive', () => {
  it('effectiveLists: format scope wins', () => {
    const effective = effectiveLists(lists({ universal: pair(['Garchomp', 'Leafeon']), byContext: { ou: pair([], ['Garchomp']) } }), 'ou');
    expect(effective.bans.has('Garchomp')).toBe(true);
    expect(effective.favorites.has('Garchomp')).toBe(false);
    expect(effective.overridden.get('Garchomp')).toBe('favorites');
    expect(effective.favorites.has('Leafeon')).toBe(true);
    expect(effective.universal.has('Leafeon')).toBe(true);
  });

  it('isUserBanned: base bans formes and Megas', () => {
    const effective = effectiveLists(lists({ byContext: { ou: pair([], ['Charizard']) } }), 'ou');
    expect(isUserBanned({ species: 'Charizard', item: 'Charizardite X' }, effective)).toBe(true);
    expect(isUserBanned({ species: 'Charizard', item: '' }, effective)).toBe(true);
    expect(isUserBanned({ species: 'Garchomp', item: '' }, effective)).toBe(false);
    expect(isUserBanned({ species: 'Charizard', item: '' }, undefined)).toBe(false);
  });

  it('isUserBanned: single Mega', () => {
    const effective = effectiveLists(lists({ byContext: { ou: pair([], ['Charizard-Mega-X']) } }), 'ou');
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

describe('Pokédex della scheda Liste', () => {
  it('in ordine, la forma base prima, niente forme Totem', async () => {
    const { pokedexSpecies } = await import('../../src/engine/lists');
    const names = pokedexSpecies(DEFAULT_FORMAT);
    expect(names.slice(0, 2)).toEqual(['Bulbasaur', 'Ivysaur']);
    expect(names.indexOf('Charizard')).toBeLessThan(names.indexOf('Charizard-Mega-X'));
    expect(names.some(name => name.includes('Totem'))).toBe(false);
  });
});

describe('raccolte', () => {
  const rain = () => createList(lists({ byContext: { ou: pair(['Garchomp'], ['Toxapex']) }, universal: pair(['Leafeon'], ['Smeargle']) }), 'Pioggia');

  it('il contesto: il gioco quando è scelto, altrimenti il formato', () => {
    expect(listContext(DEFAULT_FORMAT)).toBe('ou');
    expect(listContext({ formatId: 'gen9ag', game: 'sv' })).toBe('sv');
    expect(listContext({ formatId: 'gen9ou', game: null })).toBe('gen9ou');
  });

  it("una personalizzata scelta vale al posto di quella del formato, con l'Universale sotto", () => {
    const made = rain();
    const withRain = toggleIn(made.lists, customScope(made.id), 'favorites', 'Pelipper');
    const active = setActive(withRain, 'ou', customScope(made.id));
    expect(activeScope(active, 'ou')).toBe(customScope(made.id));
    const effective = effectiveLists(active, 'ou');
    expect([...effective.favorites].sort()).toEqual(['Leafeon', 'Pelipper']);
    expect(effective.bans.has('Toxapex')).toBe(false);
    expect(effective.bans.has('Smeargle')).toBe(true);
    // Negli altri contesti resta la raccolta del formato
    expect(activeScope(active, 'gen9ou')).toBe('gen9ou');
  });

  it('la scelta si ricorda per contesto; tornare a quella del formato la toglie', () => {
    const made = rain();
    const active = setActive(made.lists, 'ou', customScope(made.id));
    expect(active.active).toEqual({ ou: made.id });
    expect(setActive(active, 'ou', 'universal')).toBe(active);
    expect(setActive(active, 'ou', 'gen9ou')).toBe(active);
    expect(setActive(active, 'ou', 'ou').active).toEqual({});
  });

  it('id liberi, rinomina, elimina (i contesti che la usavano tornano al formato)', () => {
    const first = rain();
    const second = createList(first.lists, '  Hackrom X ');
    expect([first.id, second.id]).toEqual(['c1', 'c2']);
    expect(second.lists.custom[1].name).toBe('Hackrom X');
    expect(renameList(second.lists, 'c1', 'Sole').custom[0].name).toBe('Sole');
    expect(renameList(second.lists, 'c1', '   ')).toBe(second.lists);
    const active = setActive(setActive(second.lists, 'ou', customScope('c1')), 'gen9ou', customScope('c2'));
    const deleted = deleteList(active, 'c1');
    expect(deleted.custom.map(c => c.id)).toEqual(['c2']);
    expect(deleted.active).toEqual({ gen9ou: 'c2' });
    expect(activeScope(deleted, 'ou')).toBe('ou');
    expect(createList(deleted, 'Y').id).toBe('c3');
  });

  it("copia: aggiungi tiene quello che c'è, sostituisci svuota prima", () => {
    const made = rain();
    const into = toggleIn(made.lists, customScope(made.id), 'bans', 'Blissey');
    const added = copyLists(into, 'ou', customScope(made.id), DEFAULT_FORMAT, 'add');
    expect(added.lists.custom[0]).toMatchObject(pair(['Garchomp'], ['Blissey', 'Toxapex']));
    const replaced = copyLists(into, 'ou', customScope(made.id), DEFAULT_FORMAT, 'replace');
    expect(replaced.lists.custom[0]).toMatchObject(pair(['Garchomp'], ['Toxapex']));
    expect({ copied: replaced.copied, skipped: replaced.skipped }).toEqual({ copied: 2, skipped: 0 });
  });

  it("scopeLists: l'Universale da sola, senza voci universali", () => {
    const effective = scopeLists(rain().lists, 'universal');
    expect([...effective.favorites]).toEqual(['Leafeon']);
    expect(effective.universal.size).toBe(0);
  });
});

describe('Pokédex regionali (generazione d origine)', () => {
  it('regionOf: dal numero nazionale; le forme regionali nella loro regione, le Mega con la specie base', async () => {
    const { regionOf } = await import('../../src/engine/lists');
    expect(['Bulbasaur', 'Mew', 'Chikorita', 'Treecko', 'Turtwig', 'Victini', 'Chespin', 'Rowlet', 'Meltan', 'Grookey', 'Enamorus', 'Sprigatito', 'Pecharunt'].map(regionOf))
      .toEqual(['kanto', 'kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'alola', 'alola', 'galar', 'galar', 'paldea', 'paldea']);
    expect(['Vulpix-Alola', 'Slowking-Galar', 'Zoroark-Hisui', 'Tauros-Paldea-Combat', 'Charizard-Mega-X'].map(regionOf))
      .toEqual(['alola', 'galar', 'sinnoh', 'paldea', 'kanto']);
    expect(regionOf('Notamon')).toBeNull();
  });
});
