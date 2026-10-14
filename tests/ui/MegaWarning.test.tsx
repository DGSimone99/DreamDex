import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const WARNING = 'Seconda Mega: in National Dex ne è ammessa una sola';
const team = () => screen.getByRole('region', { name: 'Team' });

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

describe('avviso seconda Mega', () => {
  it('solo sulla seconda Mega, come avviso e non come errore', async () => {
    await setup('Lopunny-Mega', 'Charizard-Mega-Y');
    expect(within(team()).getAllByText(WARNING)).toHaveLength(1);
    const slot = within(team()).getByText('Charizard-Mega-Y').closest('details')!;
    expect(slot).toHaveClass('warn');
    expect(slot).not.toHaveClass('invalid');
  });

  it('"Lo so, tengo un\'altra Mega" nasconde l\'avviso e resta attivo', async () => {
    const user = await setup('Lopunny-Mega', 'Charizard-Mega-Y');
    await user.click(screen.getByRole('button', { name: "Lo so, tengo un'altra Mega" }));
    expect(within(team()).queryByText(WARNING)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Rimuovi Charizard-Mega-Y' }));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Venusaur-Mega{Enter}');
    expect(within(team()).queryByText(WARNING)).toBeNull();
  });

  it('una sola Mega: nessun avviso', async () => {
    await setup('Lopunny-Mega', 'Great Tusk');
    expect(within(team()).queryByText(WARNING)).toBeNull();
  });
});
