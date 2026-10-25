import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('Barra laterale', () => {
  it('contiene formato, regole e sezioni', () => {
    render(<App initialLang="it" data={fixtureData} />);
    const rail = within(screen.getByRole('complementary', { name: 'Barra laterale' }));
    expect(rail.getByLabelText('Pokédex')).toBeInTheDocument();
    expect(rail.getByLabelText('Tier del formato')).toBeInTheDocument();
    expect(rail.getByLabelText('Generazione massima')).toBeInTheDocument();
    expect(rail.getByRole('button', { name: 'Col meta' })).toBeInTheDocument();
    expect(rail.getByRole('button', { name: 'Senza meta' })).toBeInTheDocument();
    expect(rail.getByRole('checkbox', { name: 'Ignora ban' })).toBeInTheDocument();
    expect(rail.getByRole('checkbox', { name: 'Più Mega ammesse' })).toBeInTheDocument();
    expect(rail.getByRole('tablist', { name: 'Sezioni' })).toHaveAttribute('aria-orientation', 'vertical');
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
