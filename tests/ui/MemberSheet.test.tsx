import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const panel = () => document.getElementById('panel-analysis')!;

// Riga Membri messa da parte: i test tornano quando trova posto
describe.skip('membri nella Panoramica', () => {
  it('una scheda per membro e posti liberi; nessuna scheda col team vuoto', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    expect(within(panel()).queryByRole('region', { name: 'Membri' })).toBeNull();
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const members = within(panel()).getByRole('region', { name: 'Membri' });
    const cards = within(members).getAllByRole('button').filter(c => !c.getAttribute('aria-label')!.startsWith('Posto libero'));
    expect(cards.map(c => c.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^Great Tusk · (Sweeper|Wallbreaker|Muro|Pivot|Supporto) · voto \d+$/),
      expect.stringMatching(/^Gholdengo · /),
    ]);
    expect(within(members).getAllByRole('button', { name: 'Posto libero: aggiungi un Pokémon' })).toHaveLength(4);
  });

  it('il profilo: voto nel ruolo, sotto-ruoli col nome completo, statistiche reali', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(within(within(panel()).getByRole('region', { name: 'Membri' })).getByRole('button', { name: /^Great Tusk/ }));
    const profile = within(panel()).getByRole('region', { name: 'Great Tusk' });
    expect(within(profile).getByRole('heading', { name: 'Great Tusk' })).toBeInTheDocument();
    expect(profile.querySelectorAll('.sheet-tag').length).toBeGreaterThan(0);
    for (const term of ['Ruoli', 'Velocità', 'Attacco', 'Coverage', 'Robustezza', 'Tipi', 'Supporto']) {
      expect(within(profile).getByText(term, { selector: 'dt' })).toBeInTheDocument();
    }
  });
});
