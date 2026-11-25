import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { EMPTY_LISTS, type UserLists } from '../../src/engine/lists';
import { ListsPanel } from '../../src/ui/ListsPanel';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const ou = (favorites: string[], bans: string[] = []): UserLists => ({ ...EMPTY_LISTS, byContext: { ou: { favorites, bans } } });
const narrow = () => vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 1099px)', media: query, addEventListener() {}, removeEventListener() {} }));

describe('Liste su telefono e tablet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('al posto dei box due pulsanti col conto; niente Espandi le liste', () => {
    narrow();
    renderIt(<ListsPanel lists={ou(['Great Tusk', 'Kingambit'], ['Magikarp'])} format={DEFAULT_FORMAT} data={fixtureData} onChange={() => {}} />);
    expect(document.querySelector('section.lbox')).toBeNull();
    const tabs = screen.getByRole('group', { name: 'Le tue liste' });
    expect(within(tabs).getByRole('button', { name: 'Preferiti: 2, apri' })).toHaveTextContent('2');
    expect(within(tabs).getByRole('button', { name: 'Bannati: 1, apri' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Espandi le liste/ })).toBeNull();
  });

  it('un pulsante apre la sua lista in un foglio; il cuore acceso toglie; Torna al Pokédex chiude', async () => {
    narrow();
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderIt(<ListsPanel lists={ou(['Great Tusk', 'Kingambit'])} format={DEFAULT_FORMAT} data={fixtureData} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Preferiti: 2, apri' }));
    const sheet = screen.getByRole('dialog', { name: 'Preferiti' });
    expect(sheet).toHaveFocus();
    expect(within(sheet).getAllByRole('listitem').map(li => li.querySelector('.dex-name')?.textContent)).toEqual(['Great Tusk', 'Kingambit']);
    await user.click(within(sheet).getByRole('button', { name: /Great Tusk/, pressed: true }));
    expect(onChange.mock.calls[0][0].byContext.ou.favorites).toEqual(['Kingambit']);
    await user.click(screen.getByRole('button', { name: 'Torna al Pokédex' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('lista vuota: il foglio dice come aggiungere al tocco', async () => {
    narrow();
    const user = userEvent.setup();
    renderIt(<ListsPanel lists={ou([])} format={DEFAULT_FORMAT} data={fixtureData} onChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Bannati: 0, apri' }));
    expect(screen.getByRole('dialog', { name: 'Bannati' })).toHaveTextContent('tocca il divieto');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('tablet: un clic fuori dal foglio (sul velo) lo chiude', async () => {
    narrow();
    const user = userEvent.setup();
    renderIt(<ListsPanel lists={ou(['Great Tusk'])} format={DEFAULT_FORMAT} data={fixtureData} onChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Preferiti: 1, apri' }));
    const scrim = document.querySelector<HTMLElement>('.lists-sheet-scrim')!;
    expect(scrim).not.toHaveAttribute('inert');
    await user.click(scrim);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
