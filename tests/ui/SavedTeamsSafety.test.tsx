import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { loadSavedTeams } from '../../src/storage';
import { fixtureData } from '../fixtures/data';

async function setup() {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
  return user;
}

beforeEach(() => window.localStorage.clear());

describe('team salvati: niente perso per sbaglio', () => {
  it('Invio nel campo del nome salva', async () => {
    const user = await setup();
    await user.type(screen.getByLabelText('Nome team'), 'Prova{Enter}');
    expect(screen.getByRole('button', { name: 'Prova' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome team')).toHaveValue('');
  });

  it('eliminare un team salvato si può annullare', async () => {
    const user = await setup();
    await user.type(screen.getByLabelText('Nome team'), 'Prova{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Altro{Enter}');
    await user.click(screen.getByRole('button', { name: 'Elimina Prova' }));
    expect(screen.queryByRole('button', { name: 'Prova' })).toBeNull();
    const toast = screen.getByText('Team "Prova" eliminato').closest('.undo-toast') as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Annulla' }));
    expect(loadSavedTeams().map(t => t.name)).toEqual(['Prova', 'Altro']);
    expect(screen.getByRole('button', { name: 'Prova' })).toBeInTheDocument();
  });

  it('un nome già usato chiede prima di sovrascrivere', async () => {
    const user = await setup();
    await user.type(screen.getByLabelText('Nome team'), 'Prova{Enter}');
    const before = loadSavedTeams()[0].text;
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Gholdengo{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Prova{Enter}');
    const dialog = screen.getByRole('alertdialog', { name: 'Sovrascrivere il team salvato?' });
    expect(dialog).toHaveTextContent('C\'è già un team salvato col nome "Prova"');
    // Annulla: resta il team di prima, il nome scritto pure
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(loadSavedTeams()[0].text).toBe(before);
    expect(screen.getByLabelText('Nome team')).toHaveValue('Prova');
    await user.click(screen.getByRole('button', { name: 'Salva team' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Sovrascrivi' }));
    expect(loadSavedTeams()).toHaveLength(1);
    expect(loadSavedTeams()[0].text).toContain('Gholdengo');
  });
});
