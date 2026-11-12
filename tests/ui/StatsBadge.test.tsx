import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatsBadge } from '../../src/ui/StatsBadge';
import { renderIt } from '../helpers/italian';

describe('badge Stats', () => {
  it('tooltip con le 6 statistiche base e il totale', () => {
    renderIt(<StatsBadge species="Garchomp" />);
    const tip = screen.getByRole('tooltip');
    expect(screen.getByText('Stat')).toHaveAttribute('aria-describedby', tip.id);
    expect(tip).toHaveTextContent('PS108');
    expect(tip).toHaveTextContent('Vel102');
    expect(tip).toHaveTextContent('Totale600');
  });

  it('in inglese il badge dice Stats', () => {
    render(<StatsBadge species="Garchomp" />);
    expect(screen.getByText('Stats')).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  });

  it('con la pietra mostra le statistiche della Mega', () => {
    renderIt(<StatsBadge species="Garchomp" item="Garchompite" />);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Garchomp-Mega');
    expect(tip).toHaveTextContent('Totale700');
  });

  it('in una sostituzione confronta ogni statistica con il membro che esce', () => {
    renderIt(<StatsBadge species="Garchomp" compare={{ species: 'Gholdengo' }} />);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('rispetto a Gholdengo');
    const rows = [...tip.querySelectorAll('.stats-row')].map(row => row.querySelector('.stats-diff')?.textContent);
    // PS 108−87, Att 130−60, Dif 95−95, AttSp 80−133, DifSp 85−91, Vel 102−84
    expect(rows).toEqual(['+21', '+70', '±0', '−53', '−6', '+18']);
    expect(tip.querySelector('.stats-total .stats-diff')).toHaveTextContent('+50');
  });
});
