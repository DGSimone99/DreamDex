import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const panel = () => document.getElementById('panel-analysis')!;
const views = () => within(panel()).getByRole('tablist', { name: 'Sezioni dell\'Analisi' });

async function setup(names = ['Great Tusk', 'Gholdengo']) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
  return user;
}

describe('schede interne di Analisi', () => {
  it('schede interne con Panoramica di default', async () => {
    await setup();
    expect(within(views()).getAllByRole('tab').map(tab => tab.querySelector('span')!.textContent)).toEqual(['Panoramica', 'Coaching', 'Offesa', 'Difesa', 'Velocità', 'Ruoli', 'Bonus/Malus']);
    // Il voto di ogni area nella sua scheda, non nella Panoramica
    expect(within(views()).getByRole('tab', { name: 'Difesa' }).querySelector('.tab-score')).toHaveTextContent(/^\d+$/);
    expect(within(views()).getByRole('tab', { name: 'Panoramica' }).querySelector('.tab-score')).toBeNull();
    expect(within(views()).getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
  });

  it('frecce e Home/End muovono la scheda', async () => {
    const user = await setup();
    within(views()).getByRole('tab', { name: 'Panoramica' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(within(views()).getByRole('tab', { name: 'Coaching' })).toHaveAttribute('aria-selected', 'true');
    expect(within(views()).getByRole('tab', { name: 'Coaching' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(within(views()).getByRole('tab', { name: 'Bonus/Malus' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(within(views()).getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(within(views()).getByRole('tab', { name: 'Bonus/Malus' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(within(views()).getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
  });

  it('il ? accanto alla scheda aperta spiega quella scheda', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Bonus/Malus' }));
    const help = within(panel()).getByRole('button', { name: 'Come funziona Bonus/Malus' });
    await user.click(help);
    expect(screen.getByRole('dialog', { name: /Bonus\/Malus/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });

  it("le schede Offesa, Difesa, Velocità e Ruoli non hanno il ? della vista (ce l'hanno le sottoschede)", async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Ruoli' }));
    expect(screen.queryByRole('button', { name: 'Come funziona Ruoli' })).toBeNull();
    await user.click(within(views()).getByRole('tab', { name: 'Velocità' }));
    expect(screen.queryByRole('button', { name: 'Come funziona Velocità' })).toBeNull();
    await user.click(within(views()).getByRole('tab', { name: 'Difesa' }));
    expect(screen.queryByRole('button', { name: 'Come funziona Difesa' })).toBeNull();
    await user.click(within(views()).getByRole('tab', { name: 'Offesa' }));
    expect(screen.queryByRole('button', { name: 'Come funziona Offesa' })).toBeNull();
  });

  it('ogni area ricorda la sua sottoscheda: Difesa → Sostenibilità → Offesa → Difesa riapre Sostenibilità', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Difesa' }));
    await user.click(within(panel()).getByRole('tab', { name: /^Sostenibilità/ }));
    await user.click(within(views()).getByRole('tab', { name: 'Offesa' }));
    expect(within(panel()).getByRole('tab', { name: /^Generale/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(views()).getByRole('tab', { name: 'Difesa' }));
    expect(within(panel()).getByRole('tab', { name: /^Sostenibilità/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('la scheda resta aperta cambiando il team', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Offesa' }));
    await user.click(screen.getByRole('tab', { name: /^Pokémon/ }));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Kingambit{Enter}');
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    expect(within(views()).getByRole('tab', { name: 'Offesa' })).toHaveAttribute('aria-selected', 'true');
    expect(within(panel()).getByRole('region', { name: 'Offesa' })).toBeInTheDocument();
  });

  it('Coaching: badge coi problemi gravi, il nome resta "Coaching"', async () => {
    // Nessuno regge Fire, Water e Ground (nella Coverage tipi della Difesa): tre problemi gravi (in attacco nessun tipo scoperto)
    await setup(['Great Tusk', 'Gholdengo', 'Kingambit']);
    const tab = within(views()).getByRole('tab', { name: 'Coaching' });
    const badge = tab.querySelector('.tab-badge');
    expect(badge).toHaveTextContent(/^\d+$/);
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge).toHaveTextContent('3');
    expect(tab).toHaveAttribute('title', '3 problemi gravi');
  });

  it('Coaching senza problemi gravi: nessun badge', async () => {
    // Nessun tipo scoperto che pesa, ogni tipo retto da qualcuno (con 4 membri nessuno reggeva Ghost: Kingambit lo regge)
    await setup(['Great Tusk', 'Gholdengo', 'Corviknight', 'Rotom-Wash', 'Toxapex', 'Kingambit']);
    expect(within(views()).getByRole('tab', { name: 'Coaching' }).querySelector('.tab-badge')).toBeNull();
  });

  it('la scheda Coaching mostra i problemi', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Coaching' }));
    expect(within(views()).getByRole('tab', { name: 'Coaching' })).toHaveAttribute('aria-selected', 'true');
    expect(within(panel()).getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'analysis-view-coaching');
    expect(within(panel()).getByRole('tabpanel')).toHaveTextContent(/Nessuno regge/);
  });

  it('Bonus/Malus apre la scheda col catalogo', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Bonus/Malus' }));
    expect(within(panel()).getByRole('region', { name: 'Bonus/Malus' })).toBeInTheDocument();
  });

  it('niente blocco Valutazione team', async () => {
    await setup();
    expect(screen.queryByRole('group', { name: 'Valutazione team' })).toBeNull();
  });
});
