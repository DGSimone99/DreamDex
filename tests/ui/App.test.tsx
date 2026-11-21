import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { chooseDex, chooseGen, chosen, openFormat } from '../helpers/format';
import { fixtureData } from '../fixtures/data';

describe('App: struttura', () => {
  it('titolo e mese dei dati', () => {
    render(<App initialLang="it" data={fixtureData} />);
    expect(screen.getByRole('heading', { name: 'DreamDex' })).toBeInTheDocument();
    expect(screen.getByText('Dati Smogon: 09/2026')).toBeInTheDocument();
  });

  it('avviso se mancano i dati', () => {
    render(<App initialLang="it" data={{ stats: null, sets: null }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('npm run fetch-data');
  });

  it('il selettore di generazione cambia valore', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await chooseGen(user, '4');
    await openFormat(user);
    expect(chosen('format-genlimit')).toBe('4');
  });

  it('la palette segue il gioco del formato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    expect(document.documentElement.dataset.palette).toBe('swsh');
    await chooseDex(user, 'gen9');
    expect(document.documentElement.dataset.palette).toBe('sv');
  });
});
