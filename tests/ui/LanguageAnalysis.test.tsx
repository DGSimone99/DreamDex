import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('analisi in inglese', () => {
  it('schede, Panoramica e coaching', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="en" />);
    await user.click(document.querySelector<HTMLElement>('[data-hint="Paste a team written for Showdown"]')!);
    await user.click(screen.getByLabelText('Showdown text'));
    await user.paste('Great Tusk\n\nGholdengo\n\nKingambit');
    await user.click(screen.getByRole('button', { name: 'Import' }));
    // Analisi e Meta si disegnano la prima volta che si aprono
    await user.click(screen.getByRole('tab', { name: /^Analysis/ }));
    const analysis = screen.getByRole('region', { name: 'Analysis' });
    for (const title of ['Overview', 'Coaching', 'Defense', 'Offense', 'Roles', 'Speed']) {
      expect(within(analysis).getAllByText(title).length).toBeGreaterThan(0);
    }
    // La scheda Meta: il tuo team e i Pokémon del meta
    await user.click(document.getElementById('tab-meta')!);
    const meta = screen.getByRole('region', { name: 'Meta' });
    for (const title of ['Your team', 'Meta Pokémon']) expect(within(meta).getAllByText(title).length).toBeGreaterThan(0);
    // In fondo alla Panoramica la riga dei problemi; nel Voto il tipo di team, ancora da riconoscere
    // I consigli si calcolano solo con l'Analisi aperta
    await user.click(screen.getByRole('tab', { name: /^Analysis/ }));
    const fix = await within(analysis).findByRole('region', { name: 'To fix' }, { timeout: 5000 });
    expect(within(fix).getByRole('button', { name: /^Go to Coaching/ })).toBeInTheDocument();
    expect(document.querySelector('.grade-badge .grade-type')).toHaveTextContent(/^Incomplete · [1-5]\/6$/);
    // Il Coaching: la carta grande e la classifica in inglese, col loro nome e i pulsanti in inglese
    await user.click(within(analysis).getByRole('tab', { name: 'Coaching' }));
    const list = within(analysis).getByRole('region', { name: 'Proposals, most useful first' });
    const name = / (instead of .+|in a free slot|on .+), grade [+±−]\d+$/;
    const hero = await within(list).findByRole('article', {}, { timeout: 5000 });
    expect(hero.querySelector('h4')!.textContent).toMatch(name);
    expect(within(hero).getByRole('button', { name: /^Apply: / })).toHaveTextContent('Apply');
    // A sinistra la classifica: ogni riga apre una proposta, col suo nome in inglese
    const rail = within(analysis).getByRole('complementary', { name: /^Proposals/ });
    const heads = within(rail).getAllByRole('button', { name: /^Open in the card: / });
    expect(heads.length).toBeGreaterThan(0);
    for (const row of heads) expect(row.getAttribute('aria-label')!.replace(/^Open in the card: /, '')).toMatch(name);
    expect(within(rail).getByRole('heading', { name: /^Proposals/ })).toBeInTheDocument();
  });
});
