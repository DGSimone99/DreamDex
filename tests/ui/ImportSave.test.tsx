import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import { spyClipboard } from '../helpers/clipboard';

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

  it('Copia team mette negli appunti il testo Showdown del team', async () => {
    const user = userEvent.setup();
    const copied = spyClipboard();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.click(screen.getByRole('button', { name: 'Copia team' }));
    expect(copied()).toContain('Great Tusk @ Booster Energy');
    expect(await screen.findByText('Copiato', { selector: '[role="status"]' })).toBeInTheDocument();
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

  it('Salva team è spento senza nome o con il team vuoto; senza team salvati lo dice', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    expect(screen.getByText(/^Nessun team salvato/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome team'), 'Prova');
    expect(screen.getByRole('button', { name: 'Salva team' })).toBeDisabled();
    await user.clear(screen.getByLabelText('Nome team'));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    expect(screen.getByRole('button', { name: 'Salva team' })).toBeDisabled();
    await user.type(screen.getByLabelText('Nome team'), '   ');
    expect(screen.getByRole('button', { name: 'Salva team' })).toBeDisabled();
    await user.type(screen.getByLabelText('Nome team'), 'Prova');
    expect(screen.getByRole('button', { name: 'Salva team' })).toBeEnabled();
  });
});

