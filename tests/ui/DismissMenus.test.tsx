import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const menu = (text: string) => screen.getByText(text).closest('details')!;
const importMenu = () => document.querySelector<HTMLElement>('[data-hint="Incolla un team scritto per Showdown"]')!.closest('details')!;

describe('menu a tendina', () => {
  it('Importa si chiude con un clic fuori, non con un clic dentro', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(document.querySelector<HTMLElement>('[data-hint="Incolla un team scritto per Showdown"]')!);
    expect(importMenu()).toHaveAttribute('open');
    await user.click(screen.getByLabelText('Testo Showdown'));
    expect(importMenu()).toHaveAttribute('open');
    await user.click(document.body);
    expect(importMenu()).not.toHaveAttribute('open');
  });

  it('Importa con del testo scritto resta aperto al clic fuori; Annulla chiude e svuota; Importa spento a scatola vuota', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(document.querySelector<HTMLElement>('[data-hint="Incolla un team scritto per Showdown"]')!);
    const panel = within(importMenu());
    expect(panel.getByRole('button', { name: 'Importa' })).toBeDisabled();
    await user.type(panel.getByLabelText('Testo Showdown'), '   ');
    expect(panel.getByRole('button', { name: 'Importa' })).toBeDisabled();
    await user.type(panel.getByLabelText('Testo Showdown'), 'Toxapex');
    expect(panel.getByRole('button', { name: 'Importa' })).toBeEnabled();
    await user.click(document.body);
    expect(importMenu()).toHaveAttribute('open');
    await user.click(panel.getByRole('button', { name: 'Annulla' }));
    expect(importMenu()).not.toHaveAttribute('open');
    expect(panel.getByLabelText('Testo Showdown')).toHaveValue('');
    expect(document.querySelector<HTMLElement>('[data-hint="Incolla un team scritto per Showdown"]')!).toHaveFocus();
  });

  it('aprirne un altro chiude il primo; Esc chiude e riporta il fuoco al pulsante', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(document.querySelector<HTMLElement>('[data-hint="Incolla un team scritto per Showdown"]')!);
    await user.click(screen.getByText('Team salvati (0)'));
    expect(importMenu()).not.toHaveAttribute('open');
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
