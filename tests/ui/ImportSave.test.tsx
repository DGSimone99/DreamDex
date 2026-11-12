import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const team = () => screen.getByRole('region', { name: 'Team' });

describe('import / export / salvataggio', () => {
  beforeEach(() => window.localStorage.clear());

  it('importa un team Showdown', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Corviknight @ Leftovers\nAbility: Pressure\n- Defog\n\nToxapex\nAbility: Regenerator\n- Toxic');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(within(team()).getByRole('heading', { name: 'Team (2/6)' })).toBeInTheDocument();
    expect(within(team()).getByText('Corviknight')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('un set non letto ferma tutto: niente importato, una finestra dice cosa correggere, il testo resta', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    const text = 'Corviknight @ Leftovers\nAbility: Pressure\n- Defog\n\n- Tackle\n\nToxapex\nAbility: Regenerator\n- Toxic';
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste(text);
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Niente importato' });
    expect(within(dialog).getByText('Set 2 non letto ("- Tackle"): la prima riga deve essere il nome del Pokémon')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(team()).queryByText('Corviknight')).toBeNull();
    expect(screen.getByLabelText('Testo Showdown')).toHaveValue(text);
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
