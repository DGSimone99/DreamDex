import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('Barra laterale', () => {
  it('contiene la fascia del formato (tre famiglie, nome e riassunto) e le sezioni; niente pulsanti del meta', () => {
    render(<App initialLang="it" data={fixtureData} />);
    const rail = within(screen.getByRole('complementary', { name: 'Barra laterale' }));
    const band = within(rail.getByRole('group', { name: 'Formato' }));
    expect(band.getByRole('button', { name: 'Competitivo' })).toHaveAttribute('aria-current', 'true');
    expect(band.getByRole('button', { name: 'Giochi' })).not.toHaveAttribute('aria-current');
    expect(band.getByRole('button', { name: 'No Format' })).toBeInTheDocument();
    expect(band.getByRole('button', { name: /^Formato National Dex OU, Smogon, Singolo/ })).toBeInTheDocument();
    expect(rail.queryByRole('button', { name: 'Col meta' })).toBeNull();
    expect(rail.queryByRole('button', { name: 'Senza meta' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rail.getByRole('tablist', { name: 'Sezioni' })).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('una famiglia nella fascia apre la finestra su di lei senza cambiare il formato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('button', { name: 'No Format' }));
    const dialog = screen.getByRole('dialog', { name: 'Scegli il formato' });
    expect(within(dialog).getByText('Tutto ammesso: niente tier, niente ban, niente meta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Competitivo' })).toHaveAttribute('aria-current', 'true');
  });

  it('le frecce su e giù scorrono le sezioni', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    screen.getByRole('tab', { name: /^Pokémon/ }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('tab', { name: /^Analisi/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
  });

  it("l'avviso dei dati mancanti sta nella colonna principale, fuori dall'area della sezione", () => {
    const { container } = render(<App initialLang="it" data={{ stats: null, sets: null }} />);
    const banner = screen.getByRole('alert');
    expect(container.querySelector('.main')).toContainElement(banner);
    expect(container.querySelector('.workspace')).not.toContainElement(banner);
  });
});
