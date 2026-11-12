import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { initGameNames } from '../../src/i18n/game';
import { fixtureData } from '../fixtures/data';
import { spyClipboard } from '../helpers/clipboard';

const italian = {
  moves: { earthquake: { name: 'Terremoto', desc: 'Colpisce tutti i Pokémon vicini.' } },
  abilities: {}, items: { leftovers: { name: 'Avanzi' } },
  types: { ground: 'Terra', fighting: 'Lotta' }, natures: { jolly: 'Allegra' },
};
afterEach(() => initGameNames(null));

describe('editor in italiano con i nomi del gioco', () => {
  it('cerca e mostra "Terremoto" ma salva ed esporta "Earthquake"', async () => {
    initGameNames(italian);
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Great Tusk'));
    const move = within(team).getByLabelText('Mossa 4');
    await user.clear(move);
    await user.type(move, 'Terrem');
    await user.click(within(screen.getByRole('listbox', { name: 'Mossa 4: opzioni' })).getByText('Terremoto'));
    expect(move).toHaveValue('Terremoto');
    expect(within(team).queryAllByText('Terra').length).toBeGreaterThan(0);

    const copied = spyClipboard();
    await user.click(screen.getByRole('button', { name: 'Copia team' }));
    expect(copied()).toContain('- Earthquake');
  });

  it('switching language keeps the team in English', async () => {
    initGameNames(italian);
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.click(within(screen.getByRole('group', { name: 'Lingua' })).getByRole('button', { name: 'EN' }));
    const copied = spyClipboard();
    await user.click(screen.getByRole('button', { name: 'Copy team' }));
    expect(copied()).toMatch(/^Great Tusk/);
  });
});

describe('ricerca nei menu in due lingue', () => {
  it('in italiano si trova anche col nome inglese: "Earthquake" trova Terremoto, "Lefto" trova Avanzi', async () => {
    initGameNames(italian);
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Great Tusk'));
    const move = within(team).getByLabelText('Mossa 4');
    await user.clear(move);
    await user.type(move, 'Earthquake');
    expect(within(screen.getByRole('listbox', { name: 'Mossa 4: opzioni' })).getAllByRole('option')[0]).toHaveTextContent('Terremoto');
    await user.keyboard('{Escape}');
    const item = within(team).getByLabelText('Strumento');
    await user.clear(item);
    await user.type(item, 'Lefto');
    expect(within(screen.getByRole('listbox', { name: 'Strumento: opzioni' })).getAllByRole('option')[0]).toHaveTextContent('Avanzi');
  });
});
