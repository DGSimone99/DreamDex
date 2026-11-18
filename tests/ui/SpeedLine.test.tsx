import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('Velocità nell’editor', () => {
  it('valore nella riga VEL senza tooltip; sotto le righe il posto nel meta, col tooltip della scheda Velocità; cambia con gli EV', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp @ Rocky Helmet\nAbility: Rough Skin\nEVs: 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    // Il valore della Velocità è un numero come gli altri: niente fuoco, niente tooltip
    const final = within(team).getByTestId('final-spe');
    expect(final).toHaveTextContent(/^333$/);
    expect(final).not.toHaveAttribute('tabindex');
    // La riga sotto le statistiche: "Più veloce del X% del meta"; il confronto intero e i vicini nella descrizione
    const line = within(team).getByTestId('speed-line');
    expect(line).toHaveTextContent(/^Più veloce del \d+% del meta$/);
    expect(line).toHaveAccessibleDescription(/^più veloce del \d+% dei \d+ più usati\. Velocità 333\..*Più lenti: /);
    expect(document.querySelector('.ftip.speed')).toBeNull();
    await user.hover(line);
    // Lo stesso tooltip di Analisi › Velocità: il membro al centro con la sua velocità
    const tip = await screen.findByText((_, el) => !!el?.classList.contains('stip-own'));
    expect(tip).toHaveTextContent('333');
    expect(document.querySelector('.ftip.speed .ftip-foot')).toHaveTextContent('Velocità effettiva dei più usati del meta');
    await user.unhover(line);
    expect(document.querySelector('.ftip.speed')).toBeNull();
    const evs = within(team).getByRole('group', { name: 'Statistiche' });
    await user.clear(within(evs).getByLabelText('VEL'));
    expect(within(team).getByTestId('final-spe')).toHaveTextContent(/^264$/); // Jolly, 0 EV
    expect(within(team).getByTestId('speed-line')).toHaveAccessibleDescription(/Velocità 264\./);
  });

  it('col meta spento: confronto col tier, e lo dice', async () => {
    const user = userEvent.setup();
    render(<App data={{ ...fixtureData, ignoreMeta: true }} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp @ Rocky Helmet\nAbility: Rough Skin\nEVs: 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    const line = within(team).getByTestId('speed-line');
    expect(line).toHaveTextContent(/^Più veloce del \d+% dei Pokémon del tier$/);
    expect(line).toHaveAccessibleDescription(/più veloce del \d+% dei \d+ Pokémon del tier, con Velocità al massimo/);
  });
});
