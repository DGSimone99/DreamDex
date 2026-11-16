import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const view = () => within(document.getElementById('panel-analysis')!).getAllByRole('region').find(r => r.classList.contains('area-view'))!;

async function openTab(area: 'Difesa' | 'Offesa' | 'Ruoli', paste = 'Great Tusk\n- Headlong Rush\n\nGholdengo\n- Make It Rain') {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(paste);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  await user.click(within(document.querySelector<HTMLElement>('.band')!).getByRole('button', { name: new RegExp(`^${area} (punti )?[\\d/+−]+, .*apri il dettaglio`) }));
  return user;
}

describe('tabelle complete nelle schede d\'area', () => {
  it('Difesa: la tabella dei tipi, membri × tipi, in Coverage tipi', async () => {
    const user = await openTab('Difesa');
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    const table = within(view()).getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(19); // angolo e 18 tipi
    // Testata, 2 membri, poi Copertura e Il migliore (come nell'Offesa)
    expect(within(table).getAllByRole('row')).toHaveLength(5);
  });

  it('le legende dei colori stanno nella riga della legenda, dentro il pannello; le schede senza legenda non ne hanno', async () => {
    const user = await openTab('Difesa');
    const legend = () => view().querySelector('.area-panel .rob-legend > .area-legend');
    // Generale: la legenda della Sostenibilità (i pezzi di Tipi e Meta hanno la loro etichetta dentro)
    expect(view().querySelector('.area-legend')).toHaveTextContent('RecuperoPerdite');
    expect(view().querySelector('.area-tools-row')).toBeNull();
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(legend()).toHaveTextContent('OHKO2HKO3HKO4HKO+');
    // La riga in fondo viene dopo la tabella
    const table = within(view()).getByRole('table');
    expect(table.compareDocumentPosition(legend()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(within(view()).getByRole('tab', { name: /^Sostenibilit/ }));
    expect(view().querySelector('.area-legend')).toBeNull();
  });

  it('Offesa: la legenda di Coverage tipi nella riga in fondo alla tabella', async () => {
    const user = await openTab('Offesa');
    const legend = () => view().querySelector('.area-panel .rob-legend > .area-legend');
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(legend()).toHaveTextContent('OHKOForteMedio');
  });

  it('Difesa: la nota del meteo sotto la tabella', async () => {
    const user = await openTab('Difesa', 'Ninetales\nAbility: Drought\n- Flamethrower\n\nGreat Tusk\n- Headlong Rush');
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(within(view()).getByText((_, el) => !!el?.classList.contains('ht-notes') && el.textContent === 'Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo')).toBeInTheDocument();
  });

  it('Offesa: Coverage tipi ha una tabella sola', async () => {
    const user = await openTab('Offesa');
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(within(view()).getAllByRole('table')).toHaveLength(1);
  });

  it('Ruoli (Ruoli e Bonus → Ruoli): il tipo di team e le fasce dei livelli, senza filtri', async () => {
    await openTab('Ruoli');
    // Il tipo di team come titolo, sulla sua targa
    expect(view().querySelector('.rl-type')).toHaveTextContent(/\w+/);
    expect(within(view()).getByRole('region', { name: 'Essenziali' })).toBeInTheDocument();
    expect(within(view()).queryByRole('group', { name: 'Quali ruoli mostrare' })).toBeNull();
  });
});
