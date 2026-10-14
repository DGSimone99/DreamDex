import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const teamRegion = () => screen.getByRole('region', { name: 'Team' });

async function addPokemon(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
}

describe('TeamPanel', () => {
  it('aggiunge un Pokémon dalla ricerca con il set più comune', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    expect(within(teamRegion()).getByText('Great Tusk')).toBeInTheDocument();
    expect(within(teamRegion()).getByRole('heading', { name: 'Team (1/6)' })).toBeInTheDocument();
    expect(within(teamRegion()).getByLabelText('Strumento')).toHaveValue('Booster Energy');
  });

  it('ignora nomi inesistenti', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await addPokemon(user, 'Nonesiste');
    expect(within(teamRegion()).getByRole('heading', { name: 'Team (0/6)' })).toBeInTheDocument();
  });

  it('rimuove un membro', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    await user.click(screen.getByRole('button', { name: 'Rimuovi Great Tusk' }));
    expect(within(teamRegion()).queryByText('Great Tusk')).toBeNull();
  });

  it('modifica una mossa', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    const move = within(teamRegion()).getByLabelText('Mossa 4');
    await user.clear(move);
    await user.type(move, 'Stealth Rock');
    expect(within(teamRegion()).getByLabelText('Mossa 4')).toHaveValue('Stealth Rock');
  });

  it('segnala un membro oltre il limite di generazione senza rimuoverlo', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    await user.selectOptions(screen.getByLabelText('Generazione massima'), '4');
    expect(within(teamRegion()).getByText('Oltre la Gen 4')).toBeInTheDocument();
    expect(within(teamRegion()).getByText('Great Tusk')).toBeInTheDocument();
  });
});
