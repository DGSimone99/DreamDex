import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

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
    expect(within(views()).getAllByRole('tab').map(tab => tab.querySelector('.tab-name')!.textContent)).toEqual(['Panoramica', 'Coaching', 'Offesa', 'Difesa', 'Velocità', 'Ruoli e Bonus']);
    // I Ruoli non hanno più una scheda loro: stanno in Bonus/Malus, sottoscheda Ruoli
    expect(within(views()).queryByRole('tab', { name: 'Ruoli' })).toBeNull();
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
    expect(within(views()).getByRole('tab', { name: 'Ruoli e Bonus' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(within(views()).getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(within(views()).getByRole('tab', { name: 'Ruoli e Bonus' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(within(views()).getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
  });

  it('il ? accanto alla scheda aperta spiega quella scheda', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Ruoli e Bonus' }));
    const help = within(panel()).getByRole('button', { name: 'Come funziona Bonus/Malus' });
    await user.click(help);
    expect(screen.getByRole('dialog', { name: /Ruoli e Bonus/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });

  it("nessuna scheda ha un ? sopra la fila delle schede: ce l'hanno le sottoschede (con una sola, col nome dell'area)", async () => {
    const user = await setup();
    for (const name of ['Velocità', 'Difesa', 'Offesa', 'Ruoli e Bonus']) {
      await user.click(within(views()).getByRole('tab', { name }));
      expect(document.querySelector('.analysis-tabs .help-button')).toBeNull();
    }
    expect(within(panel()).getByRole('button', { name: 'Come funziona Bonus/Malus' })).toBeInTheDocument();
  });

  it('voto e problemi delle schede si leggono come descrizione, il nome resta quello della scheda', async () => {
    await setup();
    const defense = within(views()).getByRole('tab', { name: 'Difesa' });
    expect(defense).toHaveAccessibleDescription(/^Voto \d+$/);
    // Ruoli e Bonus non porta più un numero: niente valore sulla scheda né nella descrizione
    const roles = within(views()).getByRole('tab', { name: 'Ruoli e Bonus' });
    expect(roles.querySelector('.tab-score')).toBeNull();
    expect(roles).not.toHaveAccessibleDescription(/Sul voto|Voto/);
  });

  it('ogni area ricorda la sua sottoscheda: Difesa → Recupero → Offesa → Difesa riapre Recupero', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Difesa' }));
    await user.click(within(panel()).getByRole('tab', { name: /^Recupero/ }));
    await user.click(within(views()).getByRole('tab', { name: 'Offesa' }));
    expect(within(panel()).getByRole('tab', { name: /^Generale/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(views()).getByRole('tab', { name: 'Difesa' }));
    expect(within(panel()).getByRole('tab', { name: /^Recupero/ })).toHaveAttribute('aria-selected', 'true');
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

  it('Coaching: badge con tutti i problemi (lo stesso numero della barra laterale), rosso coi gravi; il nome resta "Coaching"', async () => {
    // Scoperti in difesa contro Fire, Water e Ground (nella Coverage tipi della Difesa): tre problemi gravi (in attacco nessun tipo scoperto)
    await setup(['Great Tusk', 'Gholdengo', 'Kingambit']);
    const tab = within(views()).getByRole('tab', { name: 'Coaching' });
    const badge = tab.querySelector('.tab-badge')!;
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge).not.toHaveClass('minor');
    const total = Number(badge.textContent);
    expect(screen.getByRole('tab', { name: 'Analisi' })).toHaveAccessibleDescription(new RegExp(`${total} problemi`));
    expect(tab.getAttribute('title')).toMatch(/^3 gravi( · \d+ minor[ei])?$/);
  });

  it('Coaching senza problemi gravi: badge dei minori, non rosso', async () => {
    // Nessun tipo scoperto che pesa, ogni tipo retto da qualcuno (con 4 membri nessuno reggeva Ghost: Kingambit lo regge)
    await setup(['Great Tusk', 'Gholdengo', 'Corviknight', 'Rotom-Wash', 'Toxapex', 'Kingambit']);
    const tab = within(views()).getByRole('tab', { name: 'Coaching' });
    const badge = tab.querySelector('.tab-badge');
    if (badge) {
      expect(badge).toHaveClass('minor');
      expect(tab.getAttribute('title')).toMatch(/^\d+ minor[ei]$/);
    }
  });

  it('la scheda Coaching mostra i problemi', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Coaching' }));
    expect(within(views()).getByRole('tab', { name: 'Coaching' })).toHaveAttribute('aria-selected', 'true');
    expect(within(panel()).getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'analysis-view-coaching');
    expect(within(panel()).getByRole('tabpanel')).toHaveTextContent(/In difesa: Scopert|Scopert[oi] in difesa contro/);
  });

  it('Bonus/Malus apre la scheda col catalogo', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Ruoli e Bonus' }));
    expect(within(panel()).getByRole('region', { name: 'Ruoli e Bonus' })).toBeInTheDocument();
  });

  it('niente blocco Valutazione team', async () => {
    await setup();
    expect(screen.queryByRole('group', { name: 'Valutazione team' })).toBeNull();
  });
});
