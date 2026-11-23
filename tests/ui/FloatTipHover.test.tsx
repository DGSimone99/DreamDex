import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatTip, LEAVE_GRACE, useFloatAnchor } from '../../src/ui/FloatTip';

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
/** Il mouse arriva su un elemento: il movimento (che dice dov'è il mouse) e l'entrata. */
const moveTo = (el: Element) => { fireEvent.pointerMove(el); fireEvent.mouseOver(el); };
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('FloatTip: si lascia raggiungere col mouse (WCAG 1.4.13)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('resta aperto passando dalla casella dentro il tooltip, e mentre il mouse ci sta', () => {
    const { getByTestId } = render(<Grid />);
    fireEvent.mouseEnter(getByTestId('cell-A'));
    wait(20);
    expect(tipText()).toBe('A');
    const tip = document.querySelector('.ftip')!;
    // Esce dalla casella e entra nel tooltip prima che scada l'attesa
    fireEvent.mouseLeave(getByTestId('cell-A'));
    wait(LEAVE_GRACE / 2);
    moveTo(tip);
    fireEvent.mouseEnter(tip);
    wait(LEAVE_GRACE * 4);
    expect(tipText()).toBe('A');
  });

  it('si chiude dopo l\'attesa quando il mouse ha lasciato casella e tooltip', () => {
    const { getByTestId } = render(<Grid />);
    fireEvent.mouseEnter(getByTestId('cell-A'));
    wait(20);
    const tip = document.querySelector('.ftip')!;
    fireEvent.mouseLeave(getByTestId('cell-A'));
    moveTo(tip);
    fireEvent.mouseEnter(tip);
    wait(LEAVE_GRACE * 2);
    expect(tipText()).toBe('A');
    // Fuori da tutti e due: non subito (lo spazio fra i due), ma dopo l'attesa sì
    moveTo(getByTestId('away'));
    fireEvent.mouseLeave(tip);
    expect(tipText()).toBe('A');
    wait(LEAVE_GRACE + 5);
    expect(tipText()).toBeNull();
  });

  it('uscendo dalla casella verso il resto della pagina si chiude dopo l\'attesa', () => {
    const { getByTestId } = render(<Grid />);
    fireEvent.mouseEnter(getByTestId('cell-A'));
    wait(20);
    moveTo(getByTestId('away'));
    fireEvent.mouseLeave(getByTestId('cell-A'));
    wait(LEAVE_GRACE + 5);
    expect(tipText()).toBeNull();
  });

  it('passando da una casella alla vicina il tooltip passa all\'altra, senza restare bloccato', () => {
    const { getByTestId } = render(<Grid />);
    fireEvent.mouseEnter(getByTestId('cell-A'));
    wait(20);
    expect(tipText()).toBe('A');
    fireEvent.mouseLeave(getByTestId('cell-A'));
    moveTo(getByTestId('cell-B'));
    fireEvent.mouseEnter(getByTestId('cell-B'));
    wait(20);
    expect(tipText()).toBe('B');
    // Avanti ancora: C, poi fuori; nessun tooltip rimasto
    fireEvent.mouseLeave(getByTestId('cell-B'));
    moveTo(getByTestId('cell-C'));
    fireEvent.mouseEnter(getByTestId('cell-C'));
    wait(20);
    expect(tipText()).toBe('C');
    expect(document.querySelectorAll('.ftip')).toHaveLength(1);
    moveTo(getByTestId('away'));
    fireEvent.mouseLeave(getByTestId('cell-C'));
    wait(LEAVE_GRACE + 5);
    expect(tipText()).toBeNull();
  });

  it('una casella attraversata per raggiungere il tooltip non lo sostituisce', () => {
    const { getByTestId } = render(<Grid />);
    fireEvent.mouseEnter(getByTestId('cell-A'));
    wait(20);
    const tip = document.querySelector('.ftip')!;
    fireEvent.mouseLeave(getByTestId('cell-A'));
    // B è nello spazio fra A e il suo tooltip: ci passa sopra per poco
    moveTo(getByTestId('cell-B'));
    fireEvent.mouseEnter(getByTestId('cell-B'));
    wait(5);
    fireEvent.mouseLeave(getByTestId('cell-B'));
    moveTo(tip);
    fireEvent.mouseEnter(tip);
    wait(LEAVE_GRACE * 3);
    expect(tipText()).toBe('A');
  });

  it('Esc lo chiude anche col mouse dentro, e un clic dentro non arriva a chi lo contiene', () => {
    const onCell = vi.fn();
    const { getByTestId } = render(<Grid onCell={onCell} />);
    fireEvent.mouseEnter(getByTestId('cell-A'));
    wait(20);
    const tip = document.querySelector('.ftip')!;
    fireEvent.mouseLeave(getByTestId('cell-A'));
    moveTo(tip);
    fireEvent.mouseEnter(tip);
    fireEvent.click(tip.querySelector('.tip-body')!);
    expect(onCell).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(tipText()).toBeNull();
  });

  it('il tooltip riceve il mouse (niente pointer-events: none), il fumetto piccolo no', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/floattip.css'), 'utf8');
    const rule = css.match(/\n\.ftip \{[^}]*\}/)![0];
    expect(rule).not.toMatch(/pointer-events:\s*none/);
    expect(css).toMatch(/\.ftip\.hint \{ pointer-events: none; \}/);
  });

  it('il fuoco che esce chiude subito (tastiera)', () => {
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
