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
    await waitFor(() => expect(saved(values).byFormat.ou).toEqual({ favorites: ['Leafeon', 'Toxapex'], bans: [] }));
    expect(search()).toHaveValue('');
  });

  it('ambito universale: la voce ha l\'etichetta, la × la toglie da lì', async () => {
    const { storage, values } = memory();
    const user = await open(storage);
    await user.click(within(panel()).getByRole('button', { name: 'Universale' }));
    await enter(user, 'Garchomp');
    const row = within(favoritesList()).getByText('Garchomp').closest('li')!;
    expect(row).toHaveTextContent('universale');
    await waitFor(() => expect(saved(values).universal.favorites).toEqual(['Garchomp']));
    await user.click(within(row).getByRole('button', { name: 'Togli Garchomp' }));
    await waitFor(() => expect(saved(values).universal.favorites).toEqual([]));
  });

  it('Svuota lista si può annullare', async () => {
    const lists: UserLists = { ...EMPTY_LISTS, byFormat: { ou: { favorites: [], bans: ['Toxapex', 'Blissey'] } } };
    const { storage } = memory({ 'dreamdex.lists': JSON.stringify(lists) });
    const user = await open(storage);
    await user.click(within(panel()).getByRole('button', { name: 'Svuota Bannati' }));
    expect(within(bansList()).queryByText('Toxapex')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Annulla/ }));
    expect(within(bansList()).getByText('Toxapex')).toBeInTheDocument();
  });

  it('copia da un altro formato: salta chi non c\'è o è bannato', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const lists: UserLists = { ...EMPTY_LISTS, byFormat: { ou: { favorites: ['Kyogre', 'Garchomp'], bans: [] } } };
    renderIt(<ListsPanel lists={lists} format={{ ...DEFAULT_FORMAT, formatId: 'gen9ou' }} data={fixtureData} onChange={onChange} />);
    await user.selectOptions(within(panel()).getByLabelText('Copia da…'), 'ou');
    expect(onChange.mock.calls[0][0].byFormat.gen9ou).toEqual({ favorites: ['Garchomp'], bans: [] });
    expect(within(panel()).getByText(/Copiati 1, saltati 1/)).toBeInTheDocument();
  });
});

describe('scheda Liste: forme', () => {
  it('bannare la specie base sbiadisce anche la sua Mega', () => {
    const lists: UserLists = { ...EMPTY_LISTS, byFormat: { ou: { favorites: [], bans: ['Venusaur'] } } };
    renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={vi.fn()} />);
    const cell = (name: string) => [...document.querySelectorAll('.dex-cell')].find(li => li.querySelector('.dex-name')?.textContent === name)!;
    expect(cell('Venusaur')).toHaveClass('ban');
    expect(cell('Venusaur-Mega')).toHaveClass('ban');
    expect(cell('Ivysaur')).not.toHaveClass('ban');
  });
});

describe('scheda Liste: pulsanti della griglia', () => {
  it('premuto solo se la voce è nella lista che si modifica; lo stato ereditato resta sulla cella', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const lists: UserLists = { universal: { favorites: ['Leafeon'], bans: [] }, byFormat: { ou: { favorites: [], bans: ['Charizard'] } } };
    renderIt(<ListsPanel lists={lists} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    const cell = (name: string) => [...document.querySelectorAll('.dex-cell')].find(li => li.querySelector('.dex-name')?.textContent === name)! as HTMLElement;
    expect(cell('Leafeon')).toHaveClass('fav');
    expect(within(cell('Leafeon')).getByRole('button', { name: 'Leafeon nei Preferiti' })).toHaveAttribute('aria-pressed', 'false');
    expect(cell('Charizard-Mega-X')).toHaveClass('ban');
    expect(within(cell('Charizard-Mega-X')).getByRole('button', { name: 'Charizard-Mega-X nei Bannati' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(cell('Charizard')).getByRole('button', { name: 'Charizard nei Bannati' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(cell('Charizard')).getByRole('button', { name: 'Charizard nei Bannati' }));
    expect(onChange.mock.calls[0][0].byFormat.ou.bans).toEqual([]);
  });
});
