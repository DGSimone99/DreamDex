import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AlertMark } from '../../src/ui/AlertMark';
import { renderIt } from '../helpers/italian';

describe('AlertMark', () => {
  it('flottante: passando sopra, il tooltip visibile va nel body (fuori dalla casella che taglia)', () => {
    const { container } = renderIt(<div className="card"><AlertMark floating icon="spark" alerts={[{ level: 'info', text: 'Spesso usati insieme: Great Tusk (25%)' }]} /></div>);
    const mark = container.querySelector<HTMLElement>('.alert-mark')!;
    // Per gli screen reader il testo resta sul segno
    expect(screen.getByRole('tooltip')).toHaveTextContent('Spesso usati insieme');
    expect(document.querySelector('.alert-float')).toBeNull();
    fireEvent.mouseEnter(mark);
    const float = document.querySelector<HTMLElement>('.alert-float')!;
    expect(float).toHaveTextContent('Spesso usati insieme: Great Tusk (25%)');
    expect(container.contains(float)).toBe(false);
    fireEvent.mouseLeave(mark);
    expect(document.querySelector('.alert-float')).toBeNull();
  });

  it('normale: niente copia nel body', () => {
    const { container } = renderIt(<AlertMark alerts={[{ level: 'warn', text: 'x' }]} />);
    fireEvent.mouseEnter(container.querySelector('.alert-mark')!);
    expect(document.querySelector('.alert-float')).toBeNull();
  });
});
