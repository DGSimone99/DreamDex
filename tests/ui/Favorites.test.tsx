import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

describe('preferiti', () => {
  beforeEach(() => window.localStorage.clear());

  it("la stella si vede nell'anteprima dello slot e resta nei team salvati", async () => {
    const user = await setup('Great Tusk', 'Magikarp');
    await user.click(screen.getByRole('button', { name: 'Preferito Magikarp' }));
    expect(within(screen.getByRole('region', { name: 'Team' })).getByRole('button', { name: 'Preferito Magikarp' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText('Nome team'), 'Prova');
    await user.click(screen.getByRole('button', { name: 'Salva team' }));
    await user.click(screen.getByRole('button', { name: 'Rimuovi Magikarp' }));
    await user.click(screen.getByRole('button', { name: 'Prova' }));
    expect(screen.getByRole('button', { name: 'Preferito Magikarp' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Preferito Great Tusk' })).toHaveAttribute('aria-pressed', 'false');
  });
});
