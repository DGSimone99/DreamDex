import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatTip, useFloatAnchor } from '../../src/ui/FloatTip';

/** Una griglia di tre caselle col loro tooltip, come le tabelle di Analisi (un solo stato, una chiave per casella). */
function Grid({ onCell }: { onCell?: () => void }) {
  const tip = useFloatAnchor<string>(10);
  return (
    <div onClick={onCell}>
      {['A', 'B', 'C'].map(k => (
        <span key={k} data-testid={`cell-${k}`} {...tip.bind(k)}>{k}</span>
      ))}
      <span data-testid="away">fuori</span>
      {tip.anchor && <FloatTip rect={tip.anchor.rect} tone="red"><b className="tip-body">{tip.anchor.key}</b></FloatTip>}
    </div>
  );
}

const tipText = () => document.querySelector('.tip-body')?.textContent ?? null;
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/**
 * Il tooltip si chiude appena il mouse lascia la casella (scelta dell'utente, 2026-11-25): prima restava aperto per farsi
 * raggiungere col mouse, e passando da una casella all'altra rallentava la navigazione.
 */
describe('FloatTip: si chiude uscendo dalla casella', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('uscendo dalla casella si chiude subito, anche se il mouse va sul tooltip', () => {
    const { getByTestId } = render(<Grid />);
    fireEvent.mouseEnter(getByTestId('cell-A'));
    wait(20);
    expect(tipText()).toBe('A');
    const tip = document.querySelector('.ftip')!;
    fireEvent.mouseLeave(getByTestId('cell-A'));
    expect(tipText()).toBeNull();
    // Entrare dove stava il tooltip non lo riapre
    fireEvent.mouseEnter(tip);
    wait(500);
    expect(tipText()).toBeNull();
  });

  it('close con l\'evento di uscita del mouse (onMouseLeave={close}) chiude subito', () => {
    function Cell() {
      const tip = useFloatAnchor<string>(10);
      return (
        <>
          <span data-testid="cell" onMouseEnter={e => tip.open('X', e.currentTarget)} onMouseLeave={tip.close}>X</span>
          {tip.anchor && <FloatTip rect={tip.anchor.rect} tone="red"><b className="tip-body">{tip.anchor.key}</b></FloatTip>}
        </>
      );
    }
    const { getByTestId } = render(<Cell />);
    fireEvent.mouseEnter(getByTestId('cell'));
    wait(20);
    expect(tipText()).toBe('X');
    fireEvent.mouseLeave(getByTestId('cell'));
    expect(tipText()).toBeNull();
  });

  it('passando da una casella alla vicina il vecchio si chiude e il nuovo si apre dopo l\'attesa', () => {
    const { getByTestId } = render(<Grid />);
    fireEvent.mouseEnter(getByTestId('cell-A'));
    wait(20);
    expect(tipText()).toBe('A');
    fireEvent.mouseLeave(getByTestId('cell-A'));
    fireEvent.mouseEnter(getByTestId('cell-B'));
    expect(tipText()).toBeNull();
    wait(20);
    expect(tipText()).toBe('B');
    expect(document.querySelectorAll('.ftip')).toHaveLength(1);
    fireEvent.mouseLeave(getByTestId('cell-B'));
    expect(tipText()).toBeNull();
  });

  it('Esc lo chiude, e un clic dentro non arriva a chi lo contiene', () => {
    const onCell = vi.fn();
    const { getByTestId } = render(<Grid onCell={onCell} />);
    fireEvent.mouseEnter(getByTestId('cell-A'));
    wait(20);
    fireEvent.click(document.querySelector('.tip-body')!);
    expect(onCell).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(tipText()).toBeNull();
  });

  it('nessun tooltip prende il mouse (pointer-events: none): non copre la casella sotto', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/floattip.css'), 'utf8');
    const rule = css.match(/\n\.ftip \{[^}]*\}/)![0];
    expect(rule).toMatch(/pointer-events:\s*none/);
  });

  it('il fuoco da tastiera lo apre e il fuoco che esce lo chiude', () => {
    const { getByTestId } = render(<Grid />);
    const cell = getByTestId('cell-A');
    fireEvent.keyDown(window, { key: 'Tab' });
    fireEvent.focus(cell);
    wait(20);
    expect(tipText()).toBe('A');
    fireEvent.blur(cell);
    expect(tipText()).toBeNull();
  });
});
