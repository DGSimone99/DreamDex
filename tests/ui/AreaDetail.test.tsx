import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

async function openOffense(lang: 'it' | 'en') {
  const user = userEvent.setup();
  render(<App initialLang={lang} data={fixtureData} />);
  const add = screen.getByLabelText(lang === 'it' ? 'Aggiungi Pokémon' : 'Add Pokémon');
  for (const name of ['Great Tusk', 'Gholdengo']) await user.type(add, `${name}{Enter}`);
  const rating = screen.getByRole('group', { name: lang === 'it' ? 'Valutazione team' : 'Team rating' });
  const bar = within(rating).getByRole('button', { name: lang === 'it' ? /^Offesa \d+$/ : /^Offense \d+$/ });
  await user.click(bar);
  return { user, bar };
}

describe('dettaglio dell\'Offesa', () => {
  it('cliccando la barra si apre il dettaglio con le sottostatistiche e i membri', async () => {
    const { bar } = await openOffense('it');
    const dialog = screen.getByRole('dialog', { name: bar.textContent! });
    expect(within(dialog).getAllByRole('term').map(term => term.textContent)).toEqual(['Potenza', 'Wallbreaking', 'Coverage', 'Setup']);
    // I bersagli che nessuno scalfisce sono elencati (o si dice che non ce ne sono)
    expect(dialog).toHaveTextContent(/Buchi: |Nessun buco/);
    const table = within(dialog).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Potenza', 'Wallbreaking', 'Coverage', 'Setup', 'Offesa']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getByRole('rowheader').textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    // Senza mossa di potenziamento il Setup è un trattino
    for (const row of rows) expect(within(row).getAllByRole('cell')[3]).toHaveTextContent(/^(\d+|—)$/);
    // La fixture ha pochi muri nel meta: il resto viene dal tier, e la riga lo dice
    expect(dialog).toHaveTextContent(/del meta, gli altri i più robusti del tier/);
  });

  it('Esc chiude e il focus torna alla barra', async () => {
    const { user, bar } = await openOffense('it');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bar).toHaveFocus();
  });

  it('in inglese', async () => {
    const { bar } = await openOffense('en');
    const dialog = screen.getByRole('dialog', { name: bar.textContent! });
    expect(within(dialog).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Power', 'Wallbreaking', 'Coverage', 'Setup', 'Offense']);
  });
});
