import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { AnalysisPanel } from '../../src/ui/AnalysisPanel';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

/** Riga di un elenco dell'analisi, cercata per nome (ruolo o Pokémon). */
const row = (name: string) => screen.getAllByRole('listitem')
  .find(li => li.querySelector('.role, .who strong')?.textContent === name)!;

describe('AnalysisPanel', () => {
  const team = [tusk, gholdengo];
  const renderPanel = () => render(<AnalysisPanel team={team} analysis={analyzeTeam(team, fixtureData)} />);

  it('anteprime di una riga', () => {
    renderPanel();
    const panel = screen.getByRole('region', { name: 'Analisi' });
    // Debolezze: triangoli per gravi e minori, che insieme fanno 4
    const weakSummary = within(panel).getByText('Debolezze difensive').closest('summary')!;
    const counts = [...weakSummary.querySelectorAll('.issue [aria-hidden="true"]')].map(el => Number(el.textContent));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(4);
    expect(weakSummary).toHaveTextContent(/mancanz/);
    expect(within(panel).getByText('15/18 tipi')).toBeInTheDocument();
    expect(within(panel).getByText('Minacce del meta')).toBeInTheDocument();
    expect(within(panel).getByText('Mancano 4')).toBeInTheDocument();
  });

  it('dettaglio debolezze: riga per tipo con moltiplicatori', () => {
    renderPanel();
    const row = screen.getByRole('row', { name: /^Water/ });
    expect(within(row).getByText('×2')).toBeInTheDocument();
  });

  it('ruoli: nel riassunto solo quanti sono coperti, nel dettaglio chi li copre', () => {
    renderPanel();
    expect(screen.getByText(/^\d+\/10 coperti$/)).toBeInTheDocument();
    expect(row('Pivot')).toHaveTextContent('Mancante');
    expect(row('Pivot')).toHaveClass('bad');
    expect(row('Rimozione hazard')).toHaveTextContent('Great Tusk');
  });

  it('dettaglio minacce', () => {
    renderPanel();
    expect(row('Kingambit')).toHaveTextContent('20.0%');
    expect(row('Kingambit')).toHaveTextContent('Gestito da Great Tusk');
    expect(row('Dragapult')).toHaveTextContent('Nessun check');
    expect(row('Dragapult')).toHaveClass('bad');
  });
});
