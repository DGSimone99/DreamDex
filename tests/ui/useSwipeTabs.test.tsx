import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSwipeTabs } from '../../src/ui/useSwipeTabs';

function Box({ onSwipe, hasPrev = true, hasNext = true }: { onSwipe: (dir: 1 | -1) => void; hasPrev?: boolean; hasNext?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipeTabs(ref, { enabled: true, hasPrev, hasNext, onSwipe });
  return <div ref={ref} data-testid="box"><p data-testid="text">testo</p><input data-testid="field" /></div>;
}

const swipe = (el: Element, from: [number, number], to: [number, number]) => {
  fireEvent.touchStart(el, { touches: [{ clientX: from[0], clientY: from[1] }] });
  fireEvent.touchMove(el, { touches: [{ clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: to[0], clientY: to[1] }] });
  fireEvent.touchEnd(el, { touches: [] });
};

describe('strisciare per cambiare scheda', () => {
  it('verso sinistra la scheda dopo, verso destra quella prima', () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(<Box onSwipe={onSwipe} />);
    swipe(getByTestId('text'), [300, 400], [200, 410]);
    swipe(getByTestId('text'), [100, 400], [200, 395]);
    expect(onSwipe.mock.calls).toEqual([[1], [-1]]);
  });

  it('niente se è troppo corta, verticale, dal bordo dello schermo o sul campo in cui si scrive', () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(<Box onSwipe={onSwipe} />);
    swipe(getByTestId('text'), [300, 400], [260, 400]);
    swipe(getByTestId('text'), [300, 400], [230, 520]);
    swipe(getByTestId('text'), [10, 400], [200, 400]);
    getByTestId('field').focus();
    swipe(getByTestId('field'), [300, 400], [150, 400]);
    expect(onSwipe).not.toHaveBeenCalled();
    // Un campo dove non si scrive non ferma la strisciata
    getByTestId('field').blur();
    swipe(getByTestId('field'), [300, 400], [150, 400]);
    expect(onSwipe).toHaveBeenCalledWith(1);
  });

  it('alla prima o all’ultima scheda non va oltre', () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(<Box onSwipe={onSwipe} hasPrev={false} hasNext={false} />);
    swipe(getByTestId('text'), [300, 400], [150, 400]);
    swipe(getByTestId('text'), [100, 400], [260, 400]);
    expect(onSwipe).not.toHaveBeenCalled();
    expect(getByTestId('box').style.getPropertyValue('--swipe-x')).toBe('');
  });
});
