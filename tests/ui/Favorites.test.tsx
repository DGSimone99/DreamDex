import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}
const analysis = () => screen.getByRole('region', { name: 'Analisi' });

describe('preferiti', () => {
  beforeEach(() => window.localStorage.clear());

  it('un preferito non riceve suggerimenti di sostituzione', async () => {
    const user = await setup('Great Tusk', 'Gholdengo', 'Magikarp');
    expect(within(analysis()).getByRole('button', { name: 'Vedi sostituti per Magikarp' })).toBeInTheDocument();
    const star = screen.getByRole('button', { name: 'Preferito Magikarp' });
    await user.click(star);
    expect(star).toHaveAttribute('aria-pressed', 'true');
    expect(within(analysis()).queryByRole('button', { name: 'Vedi sostituti per Magikarp' })).toBeNull();
  });

  it("la stella si vede nell'anteprima dello slot e resta nei team salvati", async () => {
    const user = await setup('Great Tusk', 'Magikarp');
    await user.click(screen.getByRole('button', { name: 'Preferito Magikarp' }));
    expect(within(screen.getByRole('region', { name: 'Team' })).getByText('★')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome team'), 'Prova');
    await user.click(screen.getByRole('button', { name: 'Salva team' }));
    await user.click(screen.getByRole('button', { name: 'Rimuovi Magikarp' }));
    await user.click(screen.getByRole('button', { name: 'Prova' }));
    expect(screen.getByRole('button', { name: 'Preferito Magikarp' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Preferito Great Tusk' })).toHaveAttribute('aria-pressed', 'false');
  });
});
