import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const team = () => screen.getByRole('region', { name: 'Team' });

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

describe('SuggestionsPanel', () => {
  it('mostra suggerimenti ordinati con punteggio e motivazione', async () => {
    await setup('Great Tusk', 'Gholdengo');
    // Corviknight, Kingambit, Rotom-Wash, Toxapex (Dragapult è Uber in National Dex)
    const items = within(suggestions()).getAllByRole('button', { name: 'Aggiungi al team' });
    expect(items.length).toBe(4);
    expect(within(suggestions()).getAllByLabelText(/^Punteggio \d+$/)).toHaveLength(4);
  });

  it('barre delle carte: Difesa, Coverage, Ruoli, Statistiche', async () => {
    await setup('Great Tusk');
    const card = suggestions().querySelector('details.suggestion')!;
    expect([...card.querySelectorAll('.bars dt')].map(dt => dt.textContent)).toEqual(['Difesa', 'Coverage', 'Ruoli', 'Statistiche']);
  });

  it('team vuoto: nota e solo la barra Statistiche', async () => {
    await setup();
    expect(within(suggestions()).getByText('Aggiungi un Pokémon per vedere come si adatta al team — per ora ordinati per uso nel meta')).toBeInTheDocument();
    const card = suggestions().querySelector('details.suggestion')!;
    expect([...card.querySelectorAll('.bars dt')].map(dt => dt.textContent)).toEqual(['Statistiche']);
    expect(Number(card.querySelector('.bars meter')!.getAttribute('value'))).toBeGreaterThan(0);
  });

  it('mostra i tag sulle carte', async () => {
    await setup('Great Tusk', 'Gholdengo');
    expect(within(suggestions()).getByText('Spesso usati insieme: Great Tusk (25%)')).toBeInTheDocument();
  });

  it('aggiunge un suggerimento al team', async () => {
    const user = await setup('Great Tusk');
    await user.click(within(suggestions()).getAllByRole('button', { name: 'Aggiungi al team' })[0]);
    expect(within(team()).getByRole('heading', { name: 'Team (2/6)' })).toBeInTheDocument();
  });

  it('team completo: messaggio al posto dei suggerimenti', async () => {
    await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex');
    expect(within(suggestions()).getByText(/Team completo/)).toBeInTheDocument();
  });

  it('sostituzione: modalità, diff e sostituzione del membro', async () => {
    const user = await setup('Great Tusk', 'Gholdengo');
    await user.click(screen.getByRole('button', { name: 'Sostituisci Great Tusk' }));
    expect(within(suggestions()).getByRole('heading', { name: 'Sostituisci Great Tusk' })).toBeInTheDocument();
    expect(within(suggestions()).getAllByText(/\+Pivot/).length).toBeGreaterThan(0);

    await user.click(within(suggestions()).getByRole('button', { name: 'Sostituto simile' }));
    expect(within(suggestions()).getByRole('button', { name: 'Sostituto simile' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(suggestions()).getAllByText(/^Somiglianza: \d+%$/).length).toBeGreaterThan(0);

    await user.click(within(suggestions()).getAllByRole('button', { name: 'Sostituisci con questo' })[0]);
    expect(within(team()).queryByText('Great Tusk')).toBeNull();
    expect(within(team()).getByRole('heading', { name: 'Team (2/6)' })).toBeInTheDocument();
    expect(within(suggestions()).getByRole('heading', { name: 'Suggerimenti' })).toBeInTheDocument();
  });

  it('senza dati: messaggio', () => {
    render(<App data={{ stats: null, sets: null }} />);
    expect(within(suggestions()).getByText('Servono i dati Smogon per i suggerimenti. Puoi comunque cercare un Pokémon per nome.')).toBeInTheDocument();
  });
});
