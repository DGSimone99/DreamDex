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

describe('tastiera: finestre e salto al contenuto', () => {
  it('con una finestra aperta la pagina sotto è inerte; chiusa torna attiva', async () => {
    const user = userEvent.setup();
    const { container } = render(<div id="root" />);
    const root = container.querySelector('#root')!;
    const { unmount } = render(<App initialLang="it" data={fixtureData} />, { container: root as HTMLElement });
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    expect(screen.getByRole('dialog', { name: 'Impostazioni' })).toBeInTheDocument();
    expect(root).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(root).not.toHaveAttribute('inert');
    unmount();
  });

  it('"Vai al contenuto" è il primo elemento e porta il fuoco alla colonna principale', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Vai al contenuto' });
    expect(skip).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(document.getElementById('main-content')).toHaveFocus();
  });
});
