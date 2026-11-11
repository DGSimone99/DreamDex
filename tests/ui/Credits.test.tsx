import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('Crediti e note legali', () => {
  it('dalla barra in fondo: progetto di fan, marchi Pokémon e fonti coi link; Esc chiude', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('button', { name: 'Crediti e note legali' }));
    const dialog = screen.getByRole('dialog', { name: 'Crediti' });
    expect(dialog).toHaveTextContent('progetto non ufficiale');
    expect(dialog).toHaveTextContent('marchi di Nintendo, Creatures Inc. e GAME FREAK inc.');
    for (const name of ['Smogon', 'Pokémon Showdown', 'PokeAPI', '@smogon/calc', 'Eevee · dreamworld.svg']) {
      expect(within(dialog).getByRole('link', { name })).toHaveAttribute('target', '_blank');
    }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Crediti' })).toBeNull();
  });

  it('anche dalle Impostazioni (sul telefono la barra in fondo non c\'è)', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crediti e note legali' }));
    expect(screen.getByRole('dialog', { name: 'Crediti' })).toBeInTheDocument();
  });
});
