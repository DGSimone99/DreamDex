import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('analisi in inglese', () => {
  it('schede, Panoramica e coaching', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="en" />);
    await user.click(screen.getByTitle('Paste a team written for Showdown'));
    await user.click(screen.getByLabelText('Showdown text'));
    await user.paste('Great Tusk\n\nGholdengo');
    await user.click(screen.getByRole('button', { name: 'Import' }));
    const analysis = screen.getByRole('region', { name: 'Analysis' });
    for (const title of ['Overview', 'Coaching', 'Defense', 'Offense', 'Roles', 'Speed']) {
      expect(within(analysis).getAllByText(title).length).toBeGreaterThan(0);
    }
    // Uso nel meta e minacce stanno nella scheda Meta
    const meta = screen.getByRole('region', { name: 'Meta' });
    for (const title of ['Meta usage', 'Meta threats']) expect(within(meta).getAllByText(title).length).toBeGreaterThan(0);
    // In fondo alla Panoramica la riga dei problemi; nel Voto il tipo di team, ancora da riconoscere
    const fix = within(analysis).getByRole('region', { name: 'To fix' });
    expect(within(fix).getByRole('button', { name: 'Go to Coaching' })).toBeInTheDocument();
    expect(document.querySelector('.grade-badge .grade-type')).toHaveTextContent('In progress');
    // I problemi stanno nel Coaching, nella mappa per area, con i titoli in inglese
    await user.click(within(analysis).getByRole('tab', { name: 'Coaching' }));
    expect(within(analysis).getByRole('region', { name: 'Suggestions' })).toBeInTheDocument();
    expect(within(analysis).getByRole('group', { name: 'Defense' })).toHaveTextContent(/Nobody takes /);
  });
});
