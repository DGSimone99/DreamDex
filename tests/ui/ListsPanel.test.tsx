import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { EMPTY_LISTS, type UserLists } from '../../src/engine/lists';
import { usageOf } from '../../src/engine/stats';
import { ListsPanel } from '../../src/ui/ListsPanel';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const memory = (initial: Record<string, string> = {}) => {
  const values = { ...initial };
  return {
    values,
    storage: {
      getItem: (k: string) => values[k] ?? null,
      setItem: (k: string, v: string) => { values[k] = v; },
      removeItem: (k: string) => { delete values[k]; },
    } as unknown as Storage,
  };
};
const saved = (values: Record<string, string>): UserLists => JSON.parse(values['dreamdex.lists']);
const panel = () => document.querySelector<HTMLElement>('section.lists-panel')!;
const search = () => panel().querySelector<HTMLInputElement>('input[aria-label="Cerca nel Pokédex"]')!;
// Selettori diretti: le query per ruolo calcolano il nome di molti elementi della griglia (lente in jsdom)
const favoritesList = () => panel().querySelector<HTMLElement>('ul[aria-label="Preferiti"]')!;
const bansList = () => panel().querySelector<HTMLElement>('ul[aria-label="Bannati"]')!;
const box = (kind: 'favorites' | 'bans') => panel().querySelector<HTMLElement>(`section.lbox.${kind}`)!;
const slot = (name: string) => panel().querySelector<HTMLElement>(`.lslot-mon[data-name="${name}"]`)!;
const card = (name: string) => [...panel().querySelectorAll<HTMLElement>('.dex-card')].find(li => li.querySelector('.dex-name')?.textContent === name)!;
const cardNames = () => [...panel().querySelectorAll('.dex-grid .dex-name')].map(el => el.textContent);
const picker = () => within(panel()).getByRole('button', { name: /^Liste/ });
const ou = (favorites: string[], bans: string[] = []): UserLists => ({ ...EMPTY_LISTS, byContext: { ou: { favorites, bans } } });

/** Nome incollato nel campo e tasto: più veloce che digitare lettera per lettera in jsdom. */
async function enter(user: ReturnType<typeof userEvent.setup>, name: string, keys = '{Enter}') {
  await user.click(search());
  await user.paste(name);
  await user.keyboard(keys);
}

async function open(storage: Storage) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} storage={storage} />);
  const tabs = screen.getAllByRole('tab').map(tab => tab.querySelector('.tab-name')?.textContent ?? tab.textContent);
  expect(tabs.indexOf('Liste')).toBe(tabs.indexOf('Meta') + 1);
  await user.click(screen.getByRole('tab', { name: 'Liste' }));
  return user;
}

// La vista (ridotta o espansa) resta per la sessione del browser: ogni test parte dalla ridotta
beforeEach(() => sessionStorage.clear());

describe('scheda Liste', () => {
  it('filtri: solo quelli che non riguardano il meta', async () => {
    await open(memory().storage);
    const filters = panel().querySelector<HTMLElement>('details.filters')!;
    expect(within(filters).queryByLabelText('Uso nel meta')).toBeNull();
    expect(within(filters).queryByLabelText('Adatto a')).toBeNull();
    expect(within(filters).queryByRole('checkbox', { name: 'Solo preferiti' })).toBeNull();
    expect(within(filters).getByLabelText('Tier')).toBeInTheDocument();
    expect(within(filters).getByLabelText('Tipo 1')).toBeInTheDocument();
  });

  it('il Pokédex in ordine nazionale, a pagine: si parte da Bulbasaur', async () => {
    await open(memory().storage);
    const cells = within(panel()).getAllByRole('listitem').filter(li => li.closest('.dex-grid'));
    expect(cells[0]).toHaveTextContent('Bulbasaur');
    expect(cells[1]).toHaveTextContent('Ivysaur');
    expect(cells).toHaveLength(60);
    const dex = within(panel()).getByRole('region', { name: 'Pokédex' });
    expect(within(dex).getByLabelText('Pagina 1 di', { exact: false })).toBeInTheDocument();
    // Pagina giù dalla griglia (anche dal pulsante di una carta) sfoglia
    fireEvent.keyDown(within(cells[0]).getByRole('button', { name: 'Bulbasaur nei Preferiti' }), { key: 'PageDown' });
    expect(within(dex).getByLabelText('Pagina 2 di', { exact: false })).toBeInTheDocument();
    expect(cardNames()).not.toContain('Bulbasaur');
    fireEvent.keyDown(panel().querySelector('.dex-grid')!, { key: 'PageUp' });
    expect(cardNames()[0]).toBe('Bulbasaur');
  });

  it('Invio aggiunge ai Preferiti, Shift+Invio ai Bannati; un Pokémon sta in una sola lista', async () => {
    const { storage, values } = memory();
    const user = await open(storage);
    await enter(user, 'Leafeon');
    expect(within(favoritesList()).getByText('Leafeon')).toBeInTheDocument();
    await enter(user, 'Toxapex', '{Shift>}{Enter}{/Shift}');
    expect(within(bansList()).getByText('Toxapex')).toBeInTheDocument();
    await enter(user, 'Toxapex');
    expect(within(favoritesList()).getByText('Toxapex')).toBeInTheDocument();
    expect(within(bansList()).queryByText('Toxapex')).toBeNull();
    await waitFor(() => expect(saved(values).byContext.ou).toEqual({ favorites: ['Leafeon', 'Toxapex'], bans: [] }));
    expect(search()).toHaveValue('');
  });

  it("raccolta Universale: la voce ha l'etichetta, Canc la toglie da lì", async () => {
    const { storage, values } = memory();
    const user = await open(storage);
    await user.click(picker());
    await user.click(screen.getByRole('menuitemradio', { name: /^Universale/ }));
    await enter(user, 'Garchomp');
    await waitFor(() => expect(saved(values).universal.favorites).toEqual(['Garchomp']));
    // Tornati alla raccolta del formato, la voce universale si vede sotto, con l'etichetta
    await user.click(picker());
    await user.click(screen.getByRole('menuitemradio', { name: /^National Dex OU/ }));
    expect(within(favoritesList()).getByText('Garchomp').closest('li')).toHaveTextContent('universale');
    expect(slot('Garchomp')).toHaveAttribute('title', 'Garchomp · universale');
    act(() => slot('Garchomp').focus());
    await user.keyboard('{Delete}');
    await waitFor(() => expect(saved(values).universal.favorites).toEqual([]));
  });

  it("copia da un altro formato (⋯ › Copia da… › Aggiungi): salta chi non c'è o è bannato", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const lists: UserLists = { ...EMPTY_LISTS, byContext: { ou: { favorites: ['Kyogre', 'Garchomp'], bans: [] } } };
    renderIt(<ListsPanel lists={lists} format={{ ...DEFAULT_FORMAT, formatId: 'gen9ou' }} data={fixtureData} onChange={onChange} />);
    await user.click(within(panel()).getByRole('button', { name: 'Altre azioni su Gen 9 OU' }));
    await user.click(screen.getByRole('menuitem', { name: /^Copia da…/ }));
    await user.click(screen.getByRole('menuitem', { name: /^National Dex OU/ }));
    await user.click(screen.getByRole('menuitem', { name: /^Aggiungi/ }));
    expect(onChange.mock.calls[0][0].byContext.gen9ou).toEqual({ favorites: ['Garchomp'], bans: [] });
    expect(within(panel()).getByText(/Copiati 1, saltati 1/)).toBeInTheDocument();
  });
});

describe('scheda Liste: forme', () => {
  it('bannare la specie base sbiadisce anche la sua Mega', () => {
    renderIt(<ListsPanel lists={ou([], ['Venusaur'])} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    expect(card('Venusaur')).toHaveClass('ban');
    expect(card('Venusaur-Mega')).toHaveClass('ban');
    expect(card('Ivysaur')).not.toHaveClass('ban');
  });
});

describe('scheda Liste: pulsanti delle carte', () => {
  it('premuto solo se la voce è nella raccolta che si modifica; lo stato ereditato resta sulla carta', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const lists: UserLists = { ...EMPTY_LISTS, universal: { favorites: ['Leafeon'], bans: [] }, byContext: { ou: { favorites: [], bans: ['Charizard'] } } };
    renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    expect(card('Charizard-Mega-X')).toHaveClass('ban');
    expect(within(card('Charizard-Mega-X')).getByRole('button', { name: 'Charizard-Mega-X nei Bannati' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(card('Charizard')).getByRole('button', { name: 'Charizard nei Bannati' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(card('Charizard')).getByRole('button', { name: 'Charizard nei Bannati' }));
    expect(onChange.mock.calls[0][0].byContext.ou.bans).toEqual([]);
    await user.click(search());
    await user.paste('Leafeon');
    await waitFor(() => expect(cardNames()).toEqual(['Leafeon']));
    expect(card('Leafeon')).toHaveClass('fav');
    expect(within(card('Leafeon')).getByRole('button', { name: 'Leafeon nei Preferiti' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('scheda Liste: i box', () => {
  it('sempre 2 righe da 10 caselle, le vuote visibili; oltre 20 Pokémon le pagine nella testata del box', async () => {
    const user = userEvent.setup();
    const many = ['Bulbasaur', 'Ivysaur', 'Venusaur', 'Charmander', 'Charmeleon', 'Charizard', 'Squirtle', 'Wartortle', 'Blastoise', 'Caterpie',
      'Metapod', 'Butterfree', 'Weedle', 'Kakuna', 'Beedrill', 'Pidgey', 'Pidgeotto', 'Pidgeot', 'Rattata', 'Raticate', 'Spearow', 'Fearow',
      'Ekans', 'Arbok', 'Pikachu', 'Raichu', 'Sandshrew', 'Sandslash', 'Nidoqueen', 'Nidoking', 'Clefairy'];
    renderIt(<ListsPanel lists={ou(many, ['Smeargle'])} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    expect(favoritesList().querySelectorAll('.lslot')).toHaveLength(20);
    expect(bansList().querySelectorAll('.lslot')).toHaveLength(20);
    expect(bansList().querySelectorAll('.lslot.on')).toHaveLength(1);
    expect(within(box('favorites')).getByText('31')).toBeInTheDocument();
    expect(within(box('favorites')).getByText('passano davanti quasi alla pari')).toBeInTheDocument();
    expect(within(box('bans')).getByText('mai suggeriti')).toBeInTheDocument();
    expect(within(box('bans')).queryByRole('button', { name: /Pagina successiva/ })).toBeNull();
    await user.click(within(box('favorites')).getByRole('button', { name: 'Pagina successiva: Preferiti' }));
    expect(within(favoritesList()).getByText('Clefairy')).toBeInTheDocument();
    expect(favoritesList().querySelectorAll('.lslot.on')).toHaveLength(11);
    expect(favoritesList().querySelectorAll('.lslot')).toHaveLength(20);
  });

  it('il clic su una casella non fa niente', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<ListsPanel lists={ou(['Garchomp'])} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    await user.click(slot('Garchomp'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('tastiera: frecce fra le caselle, Canc toglie (annullabile), M sposta nell\'altro box; tutto annunciato', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<ListsPanel lists={ou(['Garchomp', 'Leafeon', 'Toxapex'])} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    expect(slot('Garchomp')).toHaveAttribute('tabindex', '0');
    expect(slot('Leafeon')).toHaveAttribute('tabindex', '-1');
    expect(slot('Garchomp')).toHaveAccessibleDescription(/Canc: togli · M: sposta nei Bannati/);
    act(() => slot('Garchomp').focus());
    // Senza layout (jsdom) le frecce non hanno righe da seguire: il fuoco resta dov'è, ma il tasto è preso dal box
    await user.keyboard('{Delete}');
    expect(onChange.mock.calls[0][0].byContext.ou).toEqual({ favorites: ['Leafeon', 'Toxapex'], bans: [] });
    expect(onChange.mock.calls[0][1]).toEqual({ kind: 'listRemove', from: 'Garchomp', to: 'Preferiti' });
    expect(panel().querySelector('[aria-live="polite"]')).toHaveTextContent('Garchomp tolto dai Preferiti');
    act(() => slot('Leafeon').focus());
    await user.keyboard('m');
    expect(onChange.mock.calls[1][0].byContext.ou).toEqual({ favorites: ['Garchomp', 'Toxapex'], bans: ['Leafeon'] });
    expect(panel().querySelector('[aria-live="polite"]')).toHaveTextContent('Leafeon spostato nei Bannati');
  });

  it('trascinare: nell\'altro box sposta, fuori dal box toglie, dal Pokédex in un box aggiunge, nello stesso box niente', () => {
    const onChange = vi.fn();
    renderIt(<ListsPanel lists={ou(['Garchomp'], ['Toxapex'])} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    // Nell'altro box
    fireEvent.dragStart(slot('Garchomp'));
    expect(box('bans')).toHaveClass('accepts');
    expect(within(box('favorites')).getByText('rilascia fuori dal box per toglierlo')).toBeInTheDocument();
    fireEvent.dragOver(box('bans'));
    expect(box('bans')).toHaveClass('over');
    fireEvent.drop(box('bans'));
    expect(onChange.mock.calls[0][0].byContext.ou).toEqual({ favorites: [], bans: ['Toxapex', 'Garchomp'] });
    expect(onChange.mock.calls[0][1]).toBeUndefined();
    // Fuori dai box (sul Pokédex): tolto, annullabile
    fireEvent.dragStart(slot('Toxapex'));
    fireEvent.drop(panel().querySelector('.dex-grid')!);
    expect(onChange.mock.calls[1][0].byContext.ou).toEqual({ favorites: ['Garchomp'], bans: [] });
    expect(onChange.mock.calls[1][1]).toEqual({ kind: 'listRemove', from: 'Toxapex', to: 'Bannati' });
    // Dal Pokédex in un box
    fireEvent.dragStart(card('Bulbasaur'));
    fireEvent.drop(box('favorites'));
    expect(onChange.mock.calls[2][0].byContext.ou).toEqual({ favorites: ['Garchomp', 'Bulbasaur'], bans: ['Toxapex'] });
    // Nello stesso box: niente; dal Pokédex fuori dai box: niente
    fireEvent.dragStart(slot('Garchomp'));
    fireEvent.drop(box('favorites'));
    fireEvent.dragStart(card('Ivysaur'));
    fireEvent.drop(panel().querySelector('.dex-grid')!);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('nell\'app: tolto con Canc, Annulla lo rimette', async () => {
    const lists: UserLists = ou([], ['Toxapex', 'Blissey']);
    const { storage } = memory({ 'dreamdex.lists': JSON.stringify(lists) });
    const user = await open(storage);
    act(() => slot('Toxapex').focus());
    await user.keyboard('{Delete}');
    expect(within(bansList()).queryByText('Toxapex')).toBeNull();
    expect(slot('Blissey')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: /Annulla/ }));
    expect(within(bansList()).getByText('Toxapex')).toBeInTheDocument();
  });
});

describe('scheda Liste: ordine del Pokédex', () => {
  it('menu Ordine: per nome, più usati, Pokédex regionale (solo quella regione)', async () => {
    const user = userEvent.setup();
    renderIt(<ListsPanel lists={EMPTY_LISTS} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    const order = () => within(panel()).getByRole('button', { name: /^Ordine/ });
    expect(order()).toHaveTextContent('Pokédex nazionale');
    await user.click(order());
    const menu = screen.getByRole('menu', { name: 'Ordine' });
    expect(within(menu).getAllByRole('menuitemradio').map(i => i.textContent)).toEqual([
      'Pokédex nazionale', 'Più usati in National Dex OU', 'Per tipo', 'Per nome',
      'Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unima', 'Kalos', 'Alola', 'Galar', 'Paldea',
    ]);
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Per nome' }));
    expect(order()).toHaveTextContent('Per nome');
    expect(cardNames()[0]).toBe('Abomasnow');

    await user.click(order());
    await user.click(screen.getByRole('menuitemradio', { name: 'Più usati in National Dex OU' }));
    const names = cardNames();
    expect(usageOf(fixtureData.stats, names[0]!)).toBeGreaterThanOrEqual(usageOf(fixtureData.stats, names[1]!));
    expect(usageOf(fixtureData.stats, names[0]!)).toBeGreaterThan(0);

    await user.click(order());
    await user.click(screen.getByRole('menuitemradio', { name: 'Kalos' }));
    expect(cardNames()[0]).toBe('Chespin');
    expect(cardNames()).not.toContain('Bulbasaur');
    // Da tastiera: frecce ed Esc
    await user.click(order());
    expect(screen.getByRole('menuitemradio', { name: 'Kalos' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Alola' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(order()).toHaveTextContent('Alola');
    expect(cardNames()[0]).toBe('Rattata-Alola');
  });

  it('Per tipo: prima i Normale', async () => {
    const user = userEvent.setup();
    renderIt(<ListsPanel lists={EMPTY_LISTS} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    await user.click(within(panel()).getByRole('button', { name: /^Ordine/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Per tipo' }));
    expect(cardNames().slice(0, 2)).toEqual(['Pidgey', 'Pidgeotto']);
  });
});

describe('scheda Liste: vista espansa', () => {
  it('Espandi: niente ricerca né Pokédex, carte grandi a pagine; Entrambi / Preferiti / Bannati; Riduci torna; resta per la sessione', async () => {
    const user = userEvent.setup();
    const favorites = ['Bulbasaur', 'Ivysaur', 'Venusaur', 'Charmander', 'Charmeleon', 'Charizard', 'Squirtle', 'Wartortle', 'Blastoise', 'Caterpie',
      'Metapod', 'Butterfree', 'Weedle', 'Kakuna'];
    const onChange = vi.fn();
    const view = renderIt(<ListsPanel lists={ou(favorites, ['Smeargle'])} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    await user.click(within(panel()).getByRole('button', { name: 'Espandi le liste' }));
    expect(search()).toBeNull();
    expect(within(panel()).queryByRole('region', { name: 'Pokédex' })).toBeNull();
    expect(within(panel()).getByRole('heading', { name: 'Le tue liste' })).toBeInTheDocument();
    const grid = (name: string) => panel().querySelector<HTMLElement>(`ol.lists-big-grid[aria-label="${name}"]`);
    expect(grid('Preferiti')!.children).toHaveLength(12);
    expect(grid('Bannati')!.children).toHaveLength(1);
    expect(within(panel()).getByRole('button', { name: 'Entrambi' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(panel()).getByRole('button', { name: 'Preferiti' }));
    expect(grid('Bannati')).toBeNull();
    expect(grid('Preferiti')!.children).toHaveLength(14);
    // Le carte tolgono dalla lista col loro pulsante
    await user.click(within(grid('Preferiti')!).getByRole('button', { name: 'Kakuna nei Preferiti' }));
    expect(onChange.mock.calls[0][0].byContext.ou.favorites).not.toContain('Kakuna');
    // La vista resta per la sessione: montata di nuovo, è ancora espansa
    view.unmount();
    renderIt(<ListsPanel lists={ou(favorites)} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    expect(within(panel()).getByRole('heading', { name: 'Le tue liste' })).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Preferiti' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(panel()).getByRole('button', { name: 'Riduci' }));
    expect(search()).not.toBeNull();
  });
});

describe('scheda Liste: raccolte', () => {
  it('la testata dice la raccolta e che è attiva; il menu raggruppa e conta', async () => {
    const user = userEvent.setup();
    const lists: UserLists = {
      ...EMPTY_LISTS, universal: { favorites: ['Leafeon', 'Garchomp'], bans: ['Smeargle'] },
      byContext: { ou: { favorites: ['Great Tusk'], bans: [] }, gen9ou: { favorites: [], bans: ['Blissey'] } },
      custom: [{ id: 'c1', name: 'Pioggia', favorites: [], bans: [] }],
    };
    renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    expect(picker()).toHaveAccessibleName(/^Liste\s*National Dex OU\s*attiva/);
    await user.click(picker());
    const menu = screen.getByRole('menu', { name: 'Raccolte di liste' });
    const groups = within(menu).getAllByRole('group').map(g => document.getElementById(g.getAttribute('aria-labelledby')!)?.textContent);
    expect(groups).toEqual(['Del formato · si attivano da sole', 'Valgono ovunque', 'Personalizzate']);
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map(i => i.querySelector('.lists-menu-name')!.textContent)).toEqual(['National Dex OU', 'Gen 9 OU', 'Universale', 'Pioggia']);
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
    expect(items[0]).toHaveAccessibleName(/attiva, 1 preferiti, 0 bannati/);
    expect(items[3]).toHaveAccessibleName(/vuota/);
    // Frecce (in giro), poi Esc chiude e torna al pulsante
    expect(items[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(within(menu).getByRole('menuitem', { name: /Nuova raccolta/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(picker()).toHaveFocus();
  });

  it('Nuova raccolta: col nome diventa quella attiva al posto del formato; le modifiche vanno lì', async () => {
    const { storage, values } = memory();
    const user = await open(storage);
    await user.click(picker());
    await user.click(screen.getByRole('menuitem', { name: /Nuova raccolta/ }));
    await user.type(screen.getByRole('textbox', { name: 'Nome della nuova raccolta' }), 'Pioggia{Enter}');
    expect(picker()).toHaveAccessibleName(/Pioggia\s*attiva/);
    await enter(user, 'Pelipper');
    await waitFor(() => expect(saved(values).custom).toEqual([{ id: 'c1', name: 'Pioggia', favorites: ['Pelipper'], bans: [] }]));
    expect(saved(values).active).toEqual({ ou: 'c1' });
    expect(saved(values).byContext.ou).toBeUndefined();
  });

  it('una raccolta di un altro formato si guarda senza diventare attiva; tornare al formato lo riattiva', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const lists: UserLists = {
      ...EMPTY_LISTS, byContext: { gen9ou: { favorites: ['Gholdengo'], bans: [] } },
      custom: [{ id: 'c1', name: 'Pioggia', favorites: [], bans: [] }], active: { ou: 'c1' },
    };
    renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    expect(picker()).toHaveAccessibleName(/Pioggia\s*attiva/);
    await user.click(picker());
    await user.click(screen.getByRole('menuitemradio', { name: /^Gen 9 OU/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(picker()).toHaveAccessibleName(/^Liste\s*Gen 9 OU$/);
    expect(within(favoritesList()).getByText('Gholdengo')).toBeInTheDocument();
    await user.click(picker());
    await user.click(screen.getByRole('menuitemradio', { name: /^National Dex OU/ }));
    expect(onChange.mock.calls[0][0].active).toEqual({});
  });

  it('la scelta si ricorda per contesto: cambiando formato si vede la raccolta attiva lì', () => {
    const lists: UserLists = { ...EMPTY_LISTS, custom: [{ id: 'c1', name: 'Pioggia', favorites: [], bans: [] }], active: { ou: 'c1' } };
    const view = renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    expect(picker()).toHaveAccessibleName(/Pioggia/);
    view.rerender(<ListsPanel lists={lists} format={{ ...DEFAULT_FORMAT, formatId: 'gen9ou' }} data={fixtureData} onChange={vi.fn()} />);
    expect(picker()).toHaveAccessibleName(/^Liste\s*Gen 9 OU\s*attiva/);
    view.rerender(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    expect(picker()).toHaveAccessibleName(/Pioggia/);
  });

  it('col gioco scelto la raccolta è quella del gioco', () => {
    const lists: UserLists = { ...EMPTY_LISTS, byContext: { sv: { favorites: ['Meowscarada'], bans: [] }, gen9ag: { favorites: ['Koraidon'], bans: [] } } };
    renderIt(<ListsPanel lists={lists} format={{ ...DEFAULT_FORMAT, formatId: 'gen9ag', game: 'sv', meta: false }} data={fixtureData} onChange={vi.fn()} />);
    expect(picker()).toHaveAccessibleName(/^Liste\s*Scarlatto e Violetto\s*attiva/);
    expect(within(favoritesList()).getByText('Meowscarada')).toBeInTheDocument();
    expect(within(favoritesList()).queryByText('Koraidon')).toBeNull();
  });

  it('⋯: Sostituisci svuota prima (annullabile), Rinomina ed Elimina solo per le personalizzate', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const lists: UserLists = {
      ...EMPTY_LISTS, byContext: { ou: { favorites: ['Garchomp'], bans: ['Toxapex'] } },
      custom: [{ id: 'c1', name: 'Pioggia', favorites: ['Pelipper'], bans: [] }], active: { ou: 'c1' },
    };
    const view = renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    await user.click(within(panel()).getByRole('button', { name: 'Altre azioni su Pioggia' }));
    await user.click(screen.getByRole('menuitem', { name: /^Copia da…/ }));
    await user.click(screen.getByRole('menuitem', { name: /^National Dex OU/ }));
    await user.click(screen.getByRole('menuitem', { name: /^Sostituisci/ }));
    expect(onChange.mock.calls[0][0].custom[0]).toMatchObject({ favorites: ['Garchomp'], bans: ['Toxapex'] });
    expect(onChange.mock.calls[0][1]).toEqual({ kind: 'listReplace', from: 'Pioggia' });

    await user.click(within(panel()).getByRole('button', { name: 'Altre azioni su Pioggia' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rinomina' }));
    const name = screen.getByRole('textbox', { name: 'Nuovo nome della raccolta' });
    await user.clear(name);
    await user.type(name, 'Sole{Enter}');
    expect(onChange.mock.calls[1][0].custom[0].name).toBe('Sole');

    await user.click(within(panel()).getByRole('button', { name: 'Altre azioni su Pioggia' }));
    await user.click(screen.getByRole('menuitem', { name: 'Elimina' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Elimina' }));
    expect(onChange.mock.calls[2][0].custom).toEqual([]);
    expect(onChange.mock.calls[2][0].active).toEqual({});

    // Raccolta del formato: Rinomina ed Elimina spenti, Svuota annullabile
    view.rerender(<ListsPanel lists={{ ...lists, active: {} }} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    await user.click(within(panel()).getByRole('button', { name: 'Altre azioni su National Dex OU' }));
    expect(screen.getByRole('menuitem', { name: /^Rinomina/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: /^Elimina/ })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'Svuota' }));
    expect(onChange.mock.calls[3][0].byContext.ou).toEqual({ favorites: [], bans: [] });
    expect(onChange.mock.calls[3][1]).toEqual({ kind: 'clearList', from: 'National Dex OU' });
  });

  it("l'Universale resta sotto la raccolta attiva", () => {
    const lists: UserLists = {
      ...EMPTY_LISTS, universal: { favorites: ['Leafeon'], bans: [] },
      custom: [{ id: 'c1', name: 'Pioggia', favorites: ['Pelipper'], bans: [] }], active: { ou: 'c1' },
    };
    renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    expect(within(favoritesList()).getByText('Pelipper')).toBeInTheDocument();
    expect(within(favoritesList()).getByText('Leafeon').closest('li')).toHaveTextContent('universale');
  });
});
