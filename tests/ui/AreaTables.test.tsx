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
  await user.click(within(document.querySelector<HTMLElement>('.band')!).getByRole('button', { name: new RegExp(`^${area} [\\d/]+, .*apri il dettaglio`) }));
  return user;
}

describe('tabelle complete nelle schede d\'area', () => {
  it('Difesa: la tabella dei tipi, membri × tipi, in Coverage tipi', async () => {
    const user = await openTab('Difesa');
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    const table = within(view()).getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(19); // angolo e 18 tipi
    // Testata, 2 membri, poi Regge (la Copertura sta nel suggerimento della pillola)
    expect(within(table).getAllByRole('row')).toHaveLength(4);
  });

  it('le legende dei colori stanno a destra sulla riga dei problemi, non sotto la tabella; le schede senza legenda non ne hanno', async () => {
    const user = await openTab('Difesa');
    const legend = () => view().querySelector('.area-problems-row > .area-legend');
    expect(legend()).toBeNull(); // Generale
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(legend()).toHaveTextContent('Colpo forte del lato peggiore:OHKO2HKO3HKO4HKO+');
    expect(view().querySelector('.area-panel .hold-chip')).toBeNull();
  });

  it('Offesa: la legenda di Coverage tipi sulla riga dei problemi', async () => {
    const user = await openTab('Offesa');
    const legend = () => view().querySelector('.area-problems-row > .area-legend');
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(legend()).toHaveTextContent('Forte (oltre 66%)Conta (oltre 33%)');
    expect(view().querySelector('.area-panel .area-legend-swatch')).toBeNull();
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

  it('Ruoli (Bonus/Malus → Ruoli): con Tutti il tipo di team, cosa manca e i ruoli coperti; i livelli nei filtri', async () => {
    await openTab('Ruoli');
    expect(within(view()).getByRole('region', { name: 'Ruoli che mancano' })).toBeInTheDocument();
    expect(view()).toHaveTextContent(/[Gg]iudicati come|giudicati come per un/);
    expect(within(view()).getByRole('button', { name: /^Essenziali/ })).toBeInTheDocument();
  });
});
