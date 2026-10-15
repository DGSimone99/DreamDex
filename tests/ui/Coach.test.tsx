import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}
const analysis = () => screen.getByRole('region', { name: 'Analisi' });

describe('CoachPanel', () => {
  it('mostra verdetto, punti di forza e problemi', async () => {
    await setup('Great Tusk', 'Gholdengo');
    expect(within(analysis()).getByText('Team incompleto: mancano 4 membri · 0 problemi seri, 6 minori')).toBeInTheDocument();
    expect(within(analysis()).getByText('Gestisce bene Poison, Bug, Rock')).toBeInTheDocument();
    const dragapult = within(analysis()).getAllByRole('listitem').find(li => li.querySelector('.who strong')?.textContent === 'Dragapult')!;
    expect(dragapult).toHaveTextContent('Nessun check');
    expect(dragapult).toHaveTextContent('Considera Kingambit');
  });

  it('problemi raggruppati per categoria', async () => {
    await setup('Great Tusk', 'Gholdengo');
    const groups = within(analysis()).getAllByRole('group', { name: /^Problemi: / });
    expect(groups.length).toBeGreaterThan(1);
    expect(within(analysis()).getByRole('group', { name: 'Problemi: Tipi' })).toHaveTextContent(/Debole a /);
  });

  it('invito ad aggiungere con meno di 2 membri', async () => {
    await setup('Great Tusk');
    expect(within(analysis()).getByText('Aggiungi almeno 2 Pokémon per ricevere il coaching')).toBeInTheDocument();
  });

  it('"Altri sostituti" apre la sostituzione del membro', async () => {
    const user = await setup('Great Tusk', 'Gholdengo', 'Magikarp');
    await user.click(within(analysis()).getByRole('button', { name: 'Altri sostituti per Magikarp' }));
    expect(screen.getByRole('heading', { name: 'Sostituisci Magikarp' })).toBeInTheDocument();
  });
});
