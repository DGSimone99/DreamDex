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
    expect(rating).not.toHaveTextContent('Sinergia');
  });

  it('mostra le ridondanze con il dettaglio', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Great Tusk\n- Stealth Rock\n\nGarchomp\n- Stealth Rock');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const rating = screen.getByRole('group', { name: 'Valutazione team' });
    expect(rating).toHaveTextContent(/Penalità −\d+/);
    expect(rating).toHaveTextContent('2 setter di Stealth Rock (−2)');
  });

  it('mostra il bonus del meteo e la nota sotto la tabella delle debolezze', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Ninetales\nAbility: Drought\n- Flamethrower\n\nGreat Tusk\n- Headlong Rush');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(screen.getByRole('group', { name: 'Valutazione team' })).toHaveTextContent('Bonus +4');
    expect(screen.getByText('Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo')).toBeInTheDocument();
  });

  it('nessuna riga ridondanze se non ce ne sono', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(screen.getByRole('group', { name: 'Valutazione team' })).not.toHaveTextContent('Penalità');
  });

  it('nessuna valutazione con il team vuoto', () => {
    render(<App data={fixtureData} />);
    expect(screen.queryByRole('group', { name: 'Valutazione team' })).toBeNull();
  });

  it('aree senza dati mostrate come n/d', async () => {
    const user = userEvent.setup();
    render(<App data={{ stats: null, sets: null }} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    expect(screen.getByRole('group', { name: 'Valutazione team' })).toHaveTextContent('Forza n/d');
  });
});
