import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const band = () => document.querySelector<HTMLElement>('.band')!;

async function setup(names = ['Great Tusk', 'Gholdengo']) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

describe('riquadro Voto: le righe portano alla scheda di Analisi', () => {
  it('Difesa nel riquadro Voto porta ad Analisi sulla scheda Difesa', async () => {
    const user = await setup();
    await user.click(within(band()).getByRole('button', { name: /^Difesa \d+, apri il dettaglio$/ }));
    expect(screen.getByRole('tab', { name: /^Analisi/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(document.getElementById('panel-analysis')!).getByRole('region', { name: 'Difesa' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Bonus/Malus non sta nel riquadro Voto (è nel Coaching)', async () => {
    await setup();
    expect(within(band()).queryByRole('button', { name: /^Bonus\/Malus/ })).toBeNull();
  });

  it('Velocità inattiva nello stall: resta, grigia, e il nome lo dice', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste([
      `Dondozo @ Leftovers
Ability: Unaware
EVs: 252 HP / 252 Def / 4 SpD
Impish Nature
- Body Press
- Liquidation
- Rest
- Sleep Talk`,
      `Blissey @ Leftovers
Ability: Natural Cure
EVs: 4 HP / 252 Def / 252 SpD
Bold Nature
- Protect
- Seismic Toss
- Toxic
- Wish`,
      `Clodsire @ Leftovers
Ability: Unaware
EVs: 252 HP / 4 Def / 252 SpD
Careful Nature
- Amnesia
- Poison Jab
- Recover
- Spikes`,
      `Corviknight @ Leftovers
Ability: Pressure
EVs: 252 HP / 168 Def / 88 SpD
Impish Nature
- Body Press
- Defog
- Iron Defense
- Roost`,
      `Gliscor @ Toxic Orb
Ability: Poison Heal
EVs: 244 HP / 248 Def / 16 Spe
Impish Nature
- Earthquake
- Protect
- Stealth Rock
- Toxic`,
      `Toxapex @ Rocky Helmet
Ability: Regenerator
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Knock Off
- Recover
- Scald
- Toxic Spikes`,
    ].join('\n\n'));
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const speed = within(band()).getByRole('button', { name: /^Velocità \d+, apri il dettaglio/ });
    expect(speed).toHaveAccessibleName(/Non conta nello Stall/);
    expect(speed).toHaveClass('inactive');
    // Si vede anche senza lettore di schermo: il tooltip lo dice
    expect(speed).toHaveAttribute('title', expect.stringContaining('Non conta nello Stall'));
  });

  it('il ? del voto sta nel riquadro', async () => {
    await setup();
    expect(within(band()).getByRole('button', { name: 'Come funziona il voto' })).toBeInTheDocument();
  });
});
