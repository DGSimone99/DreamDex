import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { AnalysisPanel } from '../../src/ui/AnalysisPanel';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

describe('AnalysisPanel', () => {
  const team = [tusk, gholdengo];
  const renderPanel = () => render(<AnalysisPanel team={team} analysis={analyzeTeam(team, fixtureData)} />);

  it('anteprime di una riga', () => {
    renderPanel();
    const panel = screen.getByRole('region', { name: 'Analisi' });
    expect(within(panel).getByText('4 problemi')).toBeInTheDocument();
    expect(within(panel).getByText('15/18 tipi')).toBeInTheDocument();
    expect(within(panel).getByText('Dragapult, Corviknight +2')).toBeInTheDocument();
  });

  it('dettaglio debolezze: riga per tipo con moltiplicatori', () => {
    renderPanel();
    const row = screen.getByRole('row', { name: /^Water/ });
    expect(within(row).getByText('×2')).toBeInTheDocument();
  });

  it('dettaglio ruoli', () => {
    renderPanel();
    expect(screen.getByText('Pivot: mancante')).toBeInTheDocument();
    expect(screen.getByText('Rimozione hazard: Great Tusk')).toBeInTheDocument();
  });

  it('dettaglio minacce', () => {
    renderPanel();
    expect(screen.getByText('Kingambit (20.0%): gestito da Great Tusk')).toBeInTheDocument();
    expect(screen.getByText('Dragapult (18.0%): nessun check')).toBeInTheDocument();
  });
});
