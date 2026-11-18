import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('Velocità nell\u2019editor', () => {
  it('valore finale nella riga VEL; il tooltip dà il posto nel meta e i vicini; cambia con gli EV', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp @ Rocky Helmet\nAbility: Rough Skin\nEVs: 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    // Niente riga sotto le statistiche: il valore finale della Velocità porta il posto nel meta (detto ai lettori di schermo)
    expect(within(team).queryByText(/^Velocità \d/)).toBeNull();
    const final = within(team).getByTestId('final-spe');
    expect(final).toHaveTextContent(/^333$/);
    expect(final).toHaveAccessibleName(/^333, più veloce del \d+% dei \d+ più usati$/);
    expect(within(final).queryByRole('tooltip')).toBeNull();
    await user.hover(final);
    const tip = within(final).getByRole('tooltip');
    expect(tip).toHaveTextContent(/Velocità 333/);
    expect(tip).toHaveTextContent(/più veloce del \d+% dei \d+ più usati/);
    expect(tip).toHaveTextContent(/Più lenti/);
    await user.unhover(final);
    expect(within(final).queryByRole('tooltip')).toBeNull();
    const evs = within(team).getByRole('group', { name: 'Statistiche' });
    await user.clear(within(evs).getByLabelText('VEL'));
    expect(within(team).getByTestId('final-spe')).toHaveTextContent(/^264$/); // Jolly, 0 EV
  });

  it('col meta spento: confronto col tier, e lo dice', async () => {
    const user = userEvent.setup();
    render(<App data={{ ...fixtureData, ignoreMeta: true }} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp @ Rocky Helmet\nAbility: Rough Skin\nEVs: 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    expect(within(team).getByTestId('final-spe')).toHaveAccessibleName(/più veloce del \d+% dei \d+ Pokémon del tier, con Velocità al massimo/);
  });
});
