import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import type { Coaching } from '../../src/engine/coach';
import { TeamTypeLine } from '../../src/ui/CoachPanel';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const coaching: Coaching = {
  verdict: 'Team solido',
  teamType: { archetype: 'balance', styles: ['rain'] },
  threatFixes: {},
  strengths: [],
  problems: [],
  fixes: [],
  first: null,
};

describe('interruttore "Più Mega ammesse"', () => {
  const WARNING = 'Seconda Mega: in National Dex ne è ammessa una sola';

  it('si attiva e si disattiva dalla barra in alto', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Lopunny-Mega', 'Charizard-Mega-Y']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const toggle = screen.getByRole('checkbox', { name: 'Più Mega ammesse' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(screen.queryByText(WARNING)).toBeNull();
    await user.click(toggle);
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('"Lo so, tengo un\'altra Mega" spunta l\'interruttore', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Lopunny-Mega', 'Charizard-Mega-Y']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(screen.getByRole('button', { name: "Lo so, tengo un'altra Mega" }));
    expect(screen.getByRole('checkbox', { name: 'Più Mega ammesse' })).toBeChecked();
  });
});

describe('tipo di team', () => {
  it('archetipo e stili in cima alla Panoramica, con la descrizione come tooltip', () => {
    renderIt(<TeamTypeLine teamType={coaching.teamType!} />);
    expect(screen.getByText('Tipo di team')).toBeInTheDocument();
    expect(screen.getByText('Balance')).toHaveAttribute('title', 'Muri e attaccanti in equilibrio');
    expect(screen.getByText('Pioggia')).toHaveAttribute('title', 'Un membro porta la pioggia e almeno un compagno la sfrutta');
  });

  it('senza team completo non compare', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(within(screen.getByRole('region', { name: 'Analisi' })).queryByText('Tipo di team')).toBeNull();
  });
});
