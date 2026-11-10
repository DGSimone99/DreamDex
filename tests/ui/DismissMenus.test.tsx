import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const menu = (text: string) => screen.getByText(text).closest('details')!;

describe('menu a tendina', () => {
  it('Import / Export si chiude con un clic fuori, non con un clic dentro', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByText('Import / Export'));
    expect(menu('Import / Export')).toHaveAttribute('open');
    await user.click(screen.getByLabelText('Testo Showdown'));
    expect(menu('Import / Export')).toHaveAttribute('open');
    await user.click(document.body);
    expect(menu('Import / Export')).not.toHaveAttribute('open');
  });

  it('aprirne un altro chiude il primo; Esc chiude e riporta il fuoco al pulsante', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByText('Import / Export'));
    await user.click(screen.getByText(/^Team salvati/));
    expect(menu('Import / Export')).not.toHaveAttribute('open');
    expect(menu('Team salvati (0)')).toHaveAttribute('open');
    await user.keyboard('{Escape}');
    expect(menu('Team salvati (0)')).not.toHaveAttribute('open');
  });
});
