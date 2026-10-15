import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatsBadge } from '../../src/ui/StatsBadge';
import { renderIt } from '../helpers/italian';

describe('badge Stats', () => {
  it('tooltip con le 6 statistiche base e il totale', () => {
    renderIt(<StatsBadge species="Garchomp" />);
    const tip = screen.getByRole('tooltip');
    expect(screen.getByText('Stats')).toHaveAttribute('aria-describedby', tip.id);
    expect(tip).toHaveTextContent('PS108');
    expect(tip).toHaveTextContent('Vel102');
    expect(tip).toHaveTextContent('Totale600');
  });

  it('con la pietra mostra le statistiche della Mega', () => {
    renderIt(<StatsBadge species="Garchomp" item="Garchompite" />);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Garchomp-Mega');
    expect(tip).toHaveTextContent('Totale700');
  });
});
