import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const team = () => screen.getByRole('region', { name: 'Team' });

describe('import / export / salvataggio', () => {
  beforeEach(() => window.localStorage.clear());

  it('importa un team Showdown e mostra gli errori', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Corviknight @ Leftovers\nAbility: Pressure\n- Defog\n\n- Tackle\n\nToxapex\nAbility: Regenerator\n- Toxic');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(within(team()).getByRole('heading', { name: 'Team (2/6)' })).toBeInTheDocument();
    expect(within(team()).getByText('Corviknight')).toBeInTheDocument();
    expect(screen.getByText('Blocco 2 non leggibile: "- Tackle"')).toBeInTheDocument();
  });

  it('esporta il team nel campo di testo', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.click(screen.getByRole('button', { name: 'Esporta team' }));
    expect((screen.getByLabelText('Testo Showdown') as HTMLTextAreaElement).value).toContain('Great Tusk @ Booster Energy');
  });

  it('salva e ricarica un team', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Prova');
    await user.click(screen.getByRole('button', { name: 'Salva team' }));
    await user.click(screen.getByRole('button', { name: 'Rimuovi Great Tusk' }));
    expect(within(team()).queryByText('Great Tusk')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Prova' }));
    expect(within(team()).getByText('Great Tusk')).toBeInTheDocument();
  });

  it('elimina un team salvato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Prova');
    await user.click(screen.getByRole('button', { name: 'Salva team' }));
    await user.click(screen.getByRole('button', { name: 'Elimina Prova' }));
    expect(screen.queryByRole('button', { name: 'Prova' })).toBeNull();
  });
});
