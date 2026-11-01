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
  await user.click(within(document.querySelector<HTMLElement>('.band')!).getByRole('button', { name: new RegExp(`^${area} \\d+, apri il dettaglio`) }));
  return user;
}

describe('tabelle complete nelle schede d\'area', () => {
  it('Difesa: la tabella dei tipi, membri × tipi, in Coverage tipi', async () => {
    const user = await openTab('Difesa');
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    const table = within(view()).getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(19); // angolo e 18 tipi
    // Testata, 2 membri, poi Regge e Copertura
    expect(within(table).getAllByRole('row')).toHaveLength(5);
  });

  it('Difesa: la nota del meteo sotto la tabella', async () => {
    const user = await openTab('Difesa', 'Ninetales\nAbility: Drought\n- Flamethrower\n\nGreat Tusk\n- Headlong Rush');
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(within(view()).getByText((_, el) => el?.textContent === 'Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo')).toBeInTheDocument();
  });

  it('Offesa: Coverage tipi ha una tabella sola', async () => {
    const user = await openTab('Offesa');
    await user.click(within(view()).getByRole('tab', { name: /^Coverage tipi/ }));
    expect(within(view()).getAllByRole('table')).toHaveLength(1);
  });

  it('Ruoli: la tabella completa dei bisogni, con tutti i livelli e la nota sul tipo di team', async () => {
    await openTab('Ruoli');
    const table = within(view()).getByRole('region', { name: 'Ruoli del team' });
    expect(within(table).getByRole('heading', { name: 'Essenziali' })).toBeInTheDocument();
    expect(table).toHaveTextContent(/[Gg]iudicati come/);
  });
});
