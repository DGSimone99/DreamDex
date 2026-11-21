import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('Barra laterale', () => {
  it('contiene la targa del formato (nome, famiglia e riassunto) e le sezioni; niente famiglie né pulsanti del meta', () => {
    render(<App initialLang="it" data={fixtureData} />);
    const rail = within(screen.getByRole('complementary', { name: 'Barra laterale' }));
    const format = rail.getByRole('button', { name: 'Formato National Dex OU, Competitivo, Smogon, Singolo: cambia' });
    expect(format).toHaveTextContent('National Dex OU');
    expect(format).toHaveTextContent('Competitivo');
    // Le famiglie si scelgono solo nella finestra
    expect(rail.queryByRole('button', { name: 'Giochi' })).toBeNull();
    expect(rail.queryByRole('button', { name: 'No Format' })).toBeNull();
    expect(rail.queryByRole('button', { name: 'Col meta' })).toBeNull();
    expect(rail.queryByRole('button', { name: 'Senza meta' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rail.getByRole('tablist', { name: 'Sezioni' })).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('la targa apre la finestra sulla famiglia del formato attivo', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('button', { name: /^Formato / }));
    const dialog = screen.getByRole('dialog', { name: 'Scegli il formato' });
    expect(within(dialog).getByRole('radio', { name: 'Competitivo' })).toBeChecked();
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
