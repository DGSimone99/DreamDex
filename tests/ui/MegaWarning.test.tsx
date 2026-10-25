import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const WARNING = 'Seconda Mega: in National Dex ne è ammessa una sola';
const team = () => screen.getByRole('region', { name: 'Team' });

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
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
    // Triangolo giallo sullo sprite, con la spiegazione nel tooltip
    const mark = slot.querySelector('.sprite-wrap .alert-mark')!;
    expect(mark).toHaveClass('warn');
    expect(within(mark as HTMLElement).getByRole('tooltip')).toHaveTextContent(WARNING);
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

  it('seconda Mega anche bannata: triangolo rosso e giallo insieme, ognuno col suo tooltip', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Lopunny @ Lopunnite\nAbility: Limber\n- Fake Out\n\nMewtwo @ Mewtwonite Y\nAbility: Pressure\n- Psystrike');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const slot = within(team()).getByText('Mewtwo-Mega-Y', { selector: '.name' }).closest('details')!;
    const danger = slot.querySelector('.sprite-alerts .alert-mark.danger') as HTMLElement;
    const warn = slot.querySelector('.sprite-alerts .alert-mark.warn') as HTMLElement;
    expect(within(danger).getByRole('tooltip')).toHaveTextContent(/Tier troppo alto per National Dex OU/);
    expect(within(warn).getByRole('tooltip')).toHaveTextContent(WARNING);
  });
});

