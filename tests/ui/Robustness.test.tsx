import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { loadDataOrEmpty } from '../../src/data/load';
import { fixtureData } from '../fixtures/data';

const team = () => screen.getByRole('region', { name: 'Team' });

describe('robustezza UI', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('mostra un\'abilità non standard (hackrom/import) nel menu', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp\nAbility: Huge Power\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(within(team()).getByLabelText('Abilità')).toHaveValue('Huge Power');
  });

  it('salvataggio fallito: avviso e nessun team fantasma', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Prova');
    await user.click(screen.getByRole('button', { name: 'Salva team' }));
    expect(screen.getByRole('status')).toHaveTextContent('Salvataggio non riuscito');
    expect(screen.queryByRole('button', { name: 'Prova' })).toBeNull();
  });

  it('dati corrotti: si parte senza statistiche invece di una pagina vuota', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = await loadDataOrEmpty(() => Promise.reject(new SyntaxError('JSON troncato')));
    expect(data).toEqual({ stats: null, sets: null });
  });
});
