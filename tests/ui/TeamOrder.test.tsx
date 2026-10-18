import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

async function importTeam(user: ReturnType<typeof userEvent.setup>, text: string) {
  render(<App data={fixtureData} initialLang="it" />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  return screen.getByRole('region', { name: 'Team' });
}

const names = (team: HTMLElement) => [...team.querySelectorAll('.slot .name')].map(n => n.textContent);

describe('ordine del team e editor', () => {
  it('Alt + freccia sposta il membro; quello aperto resta aperto', async () => {
    const user = userEvent.setup();
    const team = await importTeam(user, 'Garchomp\n- Earthquake\n\nCorviknight\n- Roost\n\nGreninja\n- Surf');
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    const card = within(team).getByText('Garchomp', { selector: '.name' }).closest('summary') as HTMLElement;
    fireEvent.keyDown(card, { key: 'ArrowRight', altKey: true });
    expect(names(team)).toEqual(['Corviknight', 'Garchomp', 'Greninja']);
    expect(team.querySelector('.slot[open] .name')).toHaveTextContent('Garchomp');
    fireEvent.keyDown(team.querySelector('.slot[open] input') as HTMLElement, { key: 'Escape' });
    expect(team.querySelector('.slot[open]')).toBeNull();
  });

  it('gli EV vanno di 2 in 2 e il totale dice quanti ne restano', async () => {
    const user = userEvent.setup();
    const team = await importTeam(user, 'Garchomp @ Rocky Helmet\nEVs: 252 Atk / 252 Spe\nJolly Nature\n- Earthquake');
    await user.click(within(team).getByText('Garchomp', { selector: '.name' }));
    const evs = within(team).getByRole('group', { name: 'EV' });
    const hp = within(evs).getByLabelText('PS');
    expect(hp).toHaveAttribute('step', '2');
    await user.clear(hp);
    await user.type(hp, '6');
    expect(evs).toHaveTextContent('510');
    expect(evs).toHaveTextContent('0 liberi');
  });
});
