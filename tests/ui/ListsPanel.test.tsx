import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { EMPTY_LISTS, type UserLists } from '../../src/engine/lists';
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
// Selettori diretti: le query per ruolo calcolano il nome di migliaia di elementi della griglia (lentissime in jsdom)
const favoritesList = () => panel().querySelector<HTMLElement>('ul[aria-label="Preferiti"]')!;
const bansList = () => panel().querySelector<HTMLElement>('ul[aria-label="Bannati"]')!;
const picker = () => within(panel()).getByRole('button', { name: /^Liste/ });

/** Nome incollato nel campo e tasto: la griglia ha oltre mille celle, digitare lettera per lettera in jsdom è lento. */
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

  it('il Pokédex in ordine: si parte da Bulbasaur', async () => {
    await open(memory().storage);
    const cells = within(panel()).getAllByRole('listitem').filter(li => li.closest('.dex-grid'));
    expect(cells[0]).toHaveTextContent('Bulbasaur');
    expect(cells[1]).toHaveTextContent('Ivysaur');
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

  it("raccolta Universale: la voce ha l'etichetta, la × la toglie da lì", async () => {
    const { storage, values } = memory();
    const user = await open(storage);
    await user.click(picker());
    await user.click(screen.getByRole('menuitemradio', { name: /^Universale/ }));
    await enter(user, 'Garchomp');
    await waitFor(() => expect(saved(values).universal.favorites).toEqual(['Garchomp']));
    // Tornati alla raccolta del formato, la voce universale si vede sotto, con l'etichetta
    await user.click(picker());
    await user.click(screen.getByRole('menuitemradio', { name: /^National Dex OU/ }));
    const row = within(favoritesList()).getByText('Garchomp').closest('li')!;
    expect(row).toHaveTextContent('universale');
    await user.click(within(row).getByRole('button', { name: 'Togli Garchomp' }));
    await waitFor(() => expect(saved(values).universal.favorites).toEqual([]));
  });

  it('Svuota lista si può annullare', async () => {
    const lists: UserLists = { ...EMPTY_LISTS, byContext: { ou: { favorites: [], bans: ['Toxapex', 'Blissey'] } } };
    const { storage } = memory({ 'dreamdex.lists': JSON.stringify(lists) });
    const user = await open(storage);
    await user.click(within(panel()).getByRole('button', { name: 'Svuota Bannati' }));
    expect(within(bansList()).queryByText('Toxapex')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Annulla/ }));
    expect(within(bansList()).getByText('Toxapex')).toBeInTheDocument();
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
    const lists: UserLists = { ...EMPTY_LISTS, byContext: { ou: { favorites: [], bans: ['Venusaur'] } } };
    renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    const cell = (name: string) => [...document.querySelectorAll('.dex-cell')].find(li => li.querySelector('.dex-name')?.textContent === name)!;
    expect(cell('Venusaur')).toHaveClass('ban');
    expect(cell('Venusaur-Mega')).toHaveClass('ban');
    expect(cell('Ivysaur')).not.toHaveClass('ban');
  });
});

describe('scheda Liste: pulsanti della griglia', () => {
  it('premuto solo se la voce è nella raccolta che si modifica; lo stato ereditato resta sulla cella', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const lists: UserLists = { ...EMPTY_LISTS, universal: { favorites: ['Leafeon'], bans: [] }, byContext: { ou: { favorites: [], bans: ['Charizard'] } } };
    renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    const cell = (name: string) => [...document.querySelectorAll('.dex-cell')].find(li => li.querySelector('.dex-name')?.textContent === name)! as HTMLElement;
    expect(cell('Leafeon')).toHaveClass('fav');
    expect(within(cell('Leafeon')).getByRole('button', { name: 'Leafeon nei Preferiti' })).toHaveAttribute('aria-pressed', 'false');
    expect(cell('Charizard-Mega-X')).toHaveClass('ban');
    expect(within(cell('Charizard-Mega-X')).getByRole('button', { name: 'Charizard-Mega-X nei Bannati' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(cell('Charizard')).getByRole('button', { name: 'Charizard nei Bannati' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(cell('Charizard')).getByRole('button', { name: 'Charizard nei Bannati' }));
    expect(onChange.mock.calls[0][0].byContext.ou.bans).toEqual([]);
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
