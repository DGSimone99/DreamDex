import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const team = () => screen.getByRole('region', { name: 'Team' });
const list = () => suggestions().querySelector<HTMLElement>('.suggestions')!;
const rowNames = () => [...list().querySelectorAll('.name-line strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

describe('SuggestionsPanel', () => {
  it('mostra suggerimenti ordinati con punteggio e motivazione', async () => {
    await setup('Great Tusk', 'Gholdengo');
    // Corviknight, Kingambit, Rotom-Wash, Toxapex (Dragapult è Uber in National Dex)
    expect(within(suggestions()).getAllByRole('button', { name: /^Aggiungi .+ al team$/ })).toHaveLength(4);
    expect(within(suggestions()).getAllByLabelText(/^Punteggio \d+$/)).toHaveLength(4);
  });

  it('il dettaglio mostra il primo candidato: parti del punteggio e voto del team prima e dopo', async () => {
    await setup('Great Tusk');
    const first = rowNames()[0];
    const detail = screen.getByRole('complementary', { name: `Dettaglio di ${first}` });
    expect([...detail.querySelectorAll('.detail-parts dt')].map(dt => dt.textContent)).toEqual(['Difesa', 'Coverage', 'Ruoli', 'Statistiche']);
    expect(detail.querySelector('.detail-grade')).toHaveTextContent(/^Voto del team[SABCD] \d+[SABCD] \d+(\+\d+|−\d+|±0)$/);
    const areas = [...detail.querySelectorAll('.detail-areas dt')].map(dt => dt.textContent);
    expect(areas).toEqual(expect.arrayContaining(['Coverage offensiva', 'Coverage difensiva', 'Offesa', 'Robustezza', 'Ruoli']));
    expect(within(detail).getByRole('list', { name: 'Mosse' }).children.length).toBeGreaterThan(0);
  });

  it('cliccare un altro candidato lo apre nel dettaglio', async () => {
    const user = await setup('Great Tusk');
    const second = rowNames()[1];
    const pick = () => within(list()).getByRole('button', { name: new RegExp(`${second}$`) });
    expect(pick()).toHaveAttribute('aria-pressed', 'false');
    await user.click(pick());
    expect(pick()).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByRole('complementary', { name: `Dettaglio di ${second}` });
    await user.click(within(detail).getByRole('button', { name: 'Aggiungi al team' }));
    expect(within(team()).getByText(second)).toBeInTheDocument();
  });

  it('team vuoto: nota e, nel dettaglio, solo le Statistiche', async () => {
    await setup();
    expect(within(suggestions()).getByText('Aggiungi un Pokémon per vedere come si adatta al team — per ora ordinati per uso nel meta')).toBeInTheDocument();
    const detail = screen.getByRole('complementary', { name: /^Dettaglio di / });
    expect([...detail.querySelectorAll('.detail-parts dt')].map(dt => dt.textContent)).toEqual(['Statistiche']);
    expect(Number(detail.querySelector('.detail-parts dd')!.textContent)).toBeGreaterThan(0);
    expect(detail.querySelector('.detail-grade .gain')).toBeNull();
  });

  it('mostra i tag sulle righe', async () => {
    await setup('Great Tusk', 'Gholdengo');
    expect(within(list()).getByText('Spesso usati insieme: Great Tusk (25%)')).toBeInTheDocument();
  });

  it('pagine da 10: la seconda continua la numerazione', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'a');
    const pager = await screen.findByRole('navigation', { name: 'Pagine dei suggerimenti' });
    expect(rowNames()).toHaveLength(10);
    expect(within(pager).getByRole('button', { name: 'Pagina precedente' })).toBeDisabled();
    await user.click(within(pager).getByRole('button', { name: 'Pagina 2' }));
    expect(within(pager).getByRole('button', { name: 'Pagina 2' })).toHaveAttribute('aria-current', 'page');
    expect(list().querySelector('.rank')!.textContent).toBe('11');
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
    render(<App initialLang="it" data={{ stats: null, sets: null }} />);
    expect(within(suggestions()).getByText('Servono i dati Smogon per i suggerimenti. Puoi comunque cercare un Pokémon per nome.')).toBeInTheDocument();
  });
});
