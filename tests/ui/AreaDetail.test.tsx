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
  const dialog = screen.getByRole('dialog', { name: bar.textContent! });
  return { user, bar, dialog };
}

describe("dettaglio dell'Offesa a schede", () => {
  it('quattro schede col loro valore; si parte da Generale con le sottostatistiche e i membri', async () => {
    const { dialog } = await openOffense('it');
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['Generale', 'Potenza', 'Wallbreaking', 'Coverage tipi', 'Coverage meta']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getAllByRole('term').map(term => term.textContent)).toEqual(['Potenza', 'Wallbreaking', 'Coverage tipi', 'Coverage meta']);
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Potenza', 'Wallbreaking', 'Coverage', 'Offesa']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getByRole('rowheader').textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      // Il Wallbreaking, con tra parentesi quanto lo alza il setup nel voto (tooltip "Con il setup")
      expect(cells[1]).toHaveTextContent(/^\d+( \(\+\d+\))?$/);
      expect(cells[2]).toHaveTextContent(/^\d+%$/);
      expect(cells[3]).toHaveTextContent(/^\d+$/);
    }
  });

  it('Potenza: come si calcola e la Potenza di ogni membro col suo colpo migliore', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Potenza/ }));
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/3° miglior attaccante/);
    // La scala: lineare fino a 80, poi sempre più piano, e il 100 non si raggiunge
    expect(panel).toHaveTextContent(/100 non si raggiunge/);
    expect(within(panel).getAllByRole('row').length).toBe(3);
  });

  it('Wallbreaking: muro per muro, il danno di ogni membro (senza colonna delle risposte)', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Wallbreaking/ }));
    const panel = within(dialog).getByRole('tabpanel');
    const rows = within(panel).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      // Solo i due membri: chi sfonda il muro si vede già dalle caselle
      expect(cells).toHaveLength(2);
      for (const cell of cells) expect(cell).toHaveTextContent(/^\d+%( \(\d+%\))?$/);
    }
  });

  it('Coverage tipi: i 18 tipi, i buchi e chi li copre', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage tipi/ }));
    const typesPanel = within(dialog).getByRole('tabpanel');
    expect(within(typesPanel).getAllByRole('row')).toHaveLength(19);
    expect(within(typesPanel).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Tipi', 'Copertura', 'Coperto da']);
  });

  it('Coverage meta: i buchi e ogni bersaglio con chi lo copre', async () => {
    const { user, dialog } = await openOffense('it');
    await user.click(within(dialog).getByRole('tab', { name: /^Coverage meta/ }));
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/Buchi:|Nessun buco/);
    // Al posto del peso, quanto è coperto ogni bersaglio
    expect(within(panel).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Tipi', 'Pokémon', 'Copertura', 'Coperto da']);
    const rows = within(panel).getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    // 70/90/100 per chi manda KO in due colpi; un superefficace da 3HKO copre a metà (35, 45…)
    for (const row of rows) expect(within(row).getAllByRole('cell')[1]).toHaveTextContent(/^\d+%$/);
    // Per i lettori di schermo chi copre è scritto in testo (lo sprite da solo non dice niente)
    const firstCover = panel.querySelector('.ad-cover');
    if (firstCover?.querySelector('img')) expect(firstCover.querySelector('.visually-hidden')?.textContent).toMatch(/\d+%/);
    // Passando sul Pokémon che copre: la mossa e il danno
    const cover = panel.querySelector('.ad-cover [title]');
    if (cover) expect(cover.getAttribute('title')).toMatch(/^.+: .+ \d+%( \(.+\))?$/);
  });

  it('frecce fra le schede; Esc chiude e il focus torna alla barra', async () => {
    const { user, bar, dialog } = await openOffense('it');
    within(dialog).getAllByRole('tab')[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(within(dialog).getByRole('tab', { name: /^Potenza/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bar).toHaveFocus();
  });

  it('in inglese', async () => {
    const { dialog } = await openOffense('en');
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*\d+$/, ''))).toEqual(['General', 'Power', 'Wallbreaking', 'Type coverage', 'Meta coverage']);
    expect(within(dialog).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Power', 'Wallbreaking', 'Coverage', 'Offense']);
  });
});
