import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('Valutazione team', () => {
  it('voto, punteggio, etichetta e aree', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const rating = screen.getByRole('group', { name: 'Valutazione team' });
    expect(rating).toHaveTextContent('C · 69/100 · Discreto (provvisoria)');
    expect(rating).toHaveTextContent('Difesa 73');
    expect(rating).toHaveTextContent('Sinergia 100');
  });

  it('nessuna valutazione con il team vuoto', () => {
    render(<App data={fixtureData} />);
    expect(screen.queryByRole('group', { name: 'Valutazione team' })).toBeNull();
  });

  it('aree senza dati mostrate come n/d', async () => {
    const user = userEvent.setup();
    render(<App data={{ stats: null, sets: null }} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    expect(screen.getByRole('group', { name: 'Valutazione team' })).toHaveTextContent('Minacce n/d');
  });
});
