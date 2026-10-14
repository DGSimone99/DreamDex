import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

describe('App: struttura', () => {
  it('titolo e mese dei dati', () => {
    render(<App data={fixtureData} />);
    expect(screen.getByRole('heading', { name: 'DreamDex' })).toBeInTheDocument();
    expect(screen.getByText('Statistiche: 2026-09 (rating 1695+)')).toBeInTheDocument();
  });

  it('avviso se mancano i dati', () => {
    render(<App data={{ stats: null, sets: null }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('npm run fetch-data');
  });

  it('il selettore di generazione cambia valore', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} />);
    await user.selectOptions(screen.getByLabelText('Generazione massima'), '4');
    expect(screen.getByLabelText('Generazione massima')).toHaveValue('4');
  });
});
