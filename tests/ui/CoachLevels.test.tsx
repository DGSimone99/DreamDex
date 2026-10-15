import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { Coaching } from '../../src/engine/coach';
import { CoachPanel } from '../../src/ui/CoachPanel';
import { fixtureData } from '../fixtures/data';

const base = { index: 0, fit: 40, score: 60, similar: false, diff: { gains: [], losses: [] } };
const coaching: Coaching = {
  verdict: 'Team solido · 0 problemi seri, 0 minori',
  threatFixes: {},
  strengths: [],
  problems: [],
  swaps: [
    { ...base, member: 'Magikarp', replacement: 'Corviknight', level: 'recommended' },
    { ...base, index: 1, member: 'Great Tusk', replacement: 'Gliscor', level: 'optional' },
  ],
};

describe('sostituzioni gialle e verdi', () => {
  it('due gruppi con colori diversi', () => {
    render(<CoachPanel coaching={coaching} onReplace={vi.fn()} />);
    const recommended = screen.getByRole('group', { name: 'Valuta di sostituire' });
    const optional = screen.getByRole('group', { name: 'Possibili raccomandazioni' });
    expect(recommended).toHaveClass('swaps recommended');
    expect(optional).toHaveClass('swaps optional');
    expect(within(recommended).getByText(/Magikarp/)).toBeInTheDocument();
    expect(within(optional).getByText(/Great Tusk/)).toBeInTheDocument();
  });

  it('un gruppo vuoto non viene mostrato', () => {
    render(<CoachPanel coaching={{ ...coaching, swaps: [coaching.swaps[1]] }} onReplace={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Valuta di sostituire' })).toBeNull();
  });
});

describe('interruttore "Più Mega ammesse"', () => {
  const WARNING = 'Seconda Mega: in National Dex ne è ammessa una sola';

  it('si attiva e si disattiva dalla barra in alto', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
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
    render(<App data={fixtureData} />);
    for (const name of ['Lopunny-Mega', 'Charizard-Mega-Y']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(screen.getByRole('button', { name: "Lo so, tengo un'altra Mega" }));
    expect(screen.getByRole('checkbox', { name: 'Più Mega ammesse' })).toBeChecked();
  });
});
