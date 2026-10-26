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
    expect(within(views()).getAllByRole('tab').map(tab => tab.querySelector('span')!.textContent)).toEqual(['Panoramica', 'Difesa', 'Offesa', 'Ruoli', 'Velocità']);
    // Il voto di ogni area nella sua scheda, non nella Panoramica
    expect(within(views()).getByRole('tab', { name: 'Difesa' }).querySelector('.tab-score')).toHaveTextContent(/^\d+$/);
    expect(within(views()).getByRole('tab', { name: 'Panoramica' }).querySelector('.tab-score')).toBeNull();
    expect(within(views()).getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
  });

  it('frecce e Home/End muovono la scheda', async () => {
    const user = await setup();
    within(views()).getByRole('tab', { name: 'Panoramica' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(within(views()).getByRole('tab', { name: 'Difesa' })).toHaveAttribute('aria-selected', 'true');
    expect(within(views()).getByRole('tab', { name: 'Difesa' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(within(views()).getByRole('tab', { name: 'Velocità' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(within(views()).getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
  });

  it('il ? accanto alla scheda aperta spiega quella scheda', async () => {
    const user = await setup();
    await user.click(within(views()).getByRole('tab', { name: 'Difesa' }));
    const help = within(panel()).getByRole('button', { name: 'Come funziona Difesa' });
    await user.click(help);
    expect(screen.getByRole('dialog', { name: /Difesa/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
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

  it('niente blocco Valutazione team', async () => {
    await setup();
    expect(screen.queryByRole('group', { name: 'Valutazione team' })).toBeNull();
  });
});
