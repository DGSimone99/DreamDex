import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}
const analysis = () => screen.getByRole('region', { name: 'Analisi' });
const meta = () => screen.getByRole('region', { name: 'Meta' });

describe('CoachPanel', () => {
  it('mostra verdetto, punti di forza e problemi', async () => {
    const user = await setup('Great Tusk', 'Gholdengo');
    // Il giudizio sta in testa alla Panoramica; nella striscia del riassunto i conteggi
    expect(analysis().querySelector('.overview-headline')).toHaveTextContent('Team incompleto');
    // Solo i minori: gli zeri non compaiono
    // 7 + 4 minacce del meta senza check (la riga dei ruoli importanti si aggiunge a quella degli essenziali)
    const strip = analysis().querySelector<HTMLElement>('.summary-strip')!;
    expect(strip).toHaveTextContent('11 minori');
    expect(strip).not.toHaveTextContent(/grav/);
    // Punti di forza e problemi stanno nel Coaching
    await user.click(within(analysis()).getByRole('tab', { name: 'Coaching' }));
    expect(within(analysis()).getAllByRole('listitem').some(li => li.textContent === 'Gestisce bene Poison, Bug, Rock')).toBe(true);
    // Le minacce stanno nella scheda Meta
    const dragapult = within(meta()).getAllByRole('listitem').find(li => li.querySelector('.who strong')?.textContent === 'Dragapult')!;
    expect(dragapult).toHaveTextContent('Nessun check');
    expect(dragapult).toHaveTextContent('Considera Kingambit');
  });

  it('problemi raggruppati per categoria', async () => {
    const user = await setup('Great Tusk', 'Gholdengo');
    await user.click(within(analysis()).getByRole('tab', { name: 'Coaching' }));
    const groups = within(analysis()).getAllByRole('group', { name: /^Problemi: / });
    expect(groups.length).toBeGreaterThan(1);
    expect(within(analysis()).getByRole('group', { name: 'Problemi: Difese' })).toHaveTextContent(/Debole a /);
  });

  it('invito ad aggiungere con meno di 2 membri', async () => {
    await setup('Great Tusk');
    expect(within(analysis()).getByText('Aggiungi almeno 2 Pokémon per ricevere il coaching')).toBeInTheDocument();
  });

});

describe('CoachPanel: bannati dell\'utente', () => {
  it('dice quanti bannati restano fuori dalle sostituzioni', async () => {
    const { CoachPanel } = await import('../../src/ui/CoachPanel');
    const { renderIt } = await import('../helpers/italian');
    const coaching = { verdict: 'x', teamType: null, strengths: [], problems: [], fixes: [], first: null, threatFixes: {}, bannedCount: 1 };
    renderIt(<CoachPanel coaching={coaching} onReplace={() => {}} />);
    expect(screen.getByText('1 bannato escluso')).toBeInTheDocument();
  });
});
