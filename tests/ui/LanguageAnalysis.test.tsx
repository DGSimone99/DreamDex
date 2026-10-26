import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('analisi in inglese', () => {
  it('schede, Panoramica e coaching', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="en" />);
    await user.click(screen.getByText('Import / Export'));
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
    expect(within(analysis).getByText('Incomplete team')).toBeInTheDocument();
    expect(within(analysis).getByText('Strengths')).toBeInTheDocument();
    expect(within(analysis).getByRole('group', { name: 'Problems: Defenses' })).toHaveTextContent(/Weak to /);
  });
});
