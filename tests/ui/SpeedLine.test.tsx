import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('Velocità nell\u2019editor', () => {
  it('valore finale, posto nel meta e vicini; cambia con gli EV', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp @ Rocky Helmet\nAbility: Rough Skin\nEVs: 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    const line = within(team).getByText(/^Velocità/).closest('.speed-line') as HTMLElement;
    expect(line).toHaveTextContent('Velocità 333');
    expect(line).toHaveTextContent(/più veloce del \d+% dei \d+ più usati/);
    expect(within(line).queryByRole('tooltip')).toBeNull();
    await user.hover(within(line).getByText(/più veloce del/));
    expect(within(line).getByRole('tooltip')).toHaveTextContent(/Più lenti/);
    await user.unhover(within(line).getByText(/più veloce del/));
    const evs = within(team).getByRole('group', { name: 'EV' });
    await user.clear(within(evs).getByLabelText('VEL'));
    expect(line).toHaveTextContent('Velocità 264'); // Jolly, 0 EV
  });

  it('col meta spento: confronto col tier, e lo dice', async () => {
    const user = userEvent.setup();
    render(<App data={{ ...fixtureData, ignoreMeta: true }} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp @ Rocky Helmet\nAbility: Rough Skin\nEVs: 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const team = screen.getByRole('region', { name: 'Team' });
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    const line = within(team).getByText(/^Velocità/).closest('.speed-line') as HTMLElement;
    expect(line).toHaveTextContent(/più veloce del \d+% dei \d+ Pokémon del tier al massimo/);
  });
});
