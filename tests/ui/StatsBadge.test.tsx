import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatsBadge } from '../../src/ui/StatsBadge';

describe('badge Stats', () => {
  it('tooltip con le 6 statistiche base e il totale', () => {
    render(<StatsBadge species="Garchomp" />);
    const tip = screen.getByRole('tooltip');
    expect(screen.getByText('Stats')).toHaveAttribute('aria-describedby', tip.id);
    expect(tip).toHaveTextContent('HP108');
    expect(tip).toHaveTextContent('Spe102');
    expect(tip).toHaveTextContent('Totale600');
  });

  it('con la pietra mostra le statistiche della Mega', () => {
    render(<StatsBadge species="Garchomp" item="Garchompite" />);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Garchomp-Mega');
    expect(tip).toHaveTextContent('Totale700');
  });
});
