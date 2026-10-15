import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { Coaching } from '../../src/engine/coach';
import { CoachPanel } from '../../src/ui/CoachPanel';
import { emptySet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const base = { index: 0, fit: 40, score: 60, similar: false, diff: { gains: { roles: [], covers: [], resists: [] }, losses: { roles: [], covers: [], resists: [] } } };
const coaching: Coaching = {
  verdict: 'Team solido',
  threatFixes: {},
  strengths: [],
  problems: [],
  swaps: [
    { ...base, member: 'Magikarp', replacement: 'Corviknight', set: emptySet('Corviknight'), level: 'recommended' },
    { ...base, index: 1, member: 'Great Tusk', replacement: 'Gliscor', set: emptySet('Gliscor'), level: 'optional' },
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

describe('sostituto selezionato in "Altri sostituti"', () => {
  it('aggiorna la raccomandazione dello stesso membro con i suoi pro e contro', () => {
    const preview = { index: 0, replacement: 'Skarmory', set: emptySet('Skarmory'), score: 35, similar: false,
      diff: { gains: { roles: [], covers: [], resists: ['Ground' as const] }, losses: { roles: [], covers: ['Fire' as const], resists: [] } } };
    render(<CoachPanel coaching={coaching} preview={preview} onReplace={vi.fn()} />);
    const recommended = screen.getByRole('group', { name: 'Valuta di sostituire' });
    expect(within(recommended).getByText('Skarmory')).toBeInTheDocument();
    expect(within(recommended).queryByText('Corviknight')).toBeNull();
    expect(within(recommended).getByText('Selezionato')).toBeInTheDocument();
    expect(within(recommended).getByLabelText('si adatta peggio di 5 punti')).toBeInTheDocument();
    expect(within(recommended).getByRole('list', { name: 'Vantaggi' })).toHaveTextContent('Resistente a Ground');
    expect(within(recommended).getByRole('list', { name: 'Svantaggi' })).toHaveTextContent('Non più forte contro Fire');
    // L'altra raccomandazione resta quella del coaching
    expect(within(screen.getByRole('group', { name: 'Possibili raccomandazioni' })).getByText('Gliscor')).toBeInTheDocument();
  });
});

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
