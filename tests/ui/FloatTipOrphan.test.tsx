import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatTip, useFloatAnchor } from '../../src/ui/FloatTip';

/** Una lista con una casella che può sparire (come Victini che esce dalla lista con un filtro). */
function List() {
  const [shown, setShown] = useState(true);
  const anchor = useFloatAnchor<string>(10);
  return (
    <div>
      <button onClick={() => setShown(false)}>filtra</button>
      {shown && <span data-testid="cell" onMouseEnter={e => anchor.open('Victini', e.currentTarget)} onMouseLeave={anchor.close}>Victini</span>}
      {anchor.anchor && <FloatTip rect={anchor.anchor.rect} tone="red"><b className="tip-body">{anchor.anchor.key}</b></FloatTip>}
    </div>
  );
}

describe('FloatTip: la casella sparisce sotto il mouse', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('il tooltip aperto si chiude quando la casella esce dalla pagina', async () => {
    const { getByTestId, getByText } = render(<List />);
    fireEvent.mouseEnter(getByTestId('cell'));
    act(() => { vi.advanceTimersByTime(20); });
    expect(document.querySelector('.tip-body')).not.toBeNull();
    // La lista cambia: la casella sparisce, l'uscita del mouse non arriva mai
    fireEvent.click(getByText('filtra'));
    await act(async () => { await Promise.resolve(); });
    expect(document.querySelector('.tip-body')).toBeNull();
  });

  it('non si apre se la casella sparisce prima dell\'attesa', () => {
    const { getByTestId, getByText } = render(<List />);
    fireEvent.mouseEnter(getByTestId('cell'));
    fireEvent.click(getByText('filtra'));
    act(() => { vi.advanceTimersByTime(20); });
    expect(document.querySelector('.tip-body')).toBeNull();
  });
});
