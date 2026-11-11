import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EeveePeek } from '../../src/ui/EeveePeek';

// In jsdom la finestra misura 0x0 in alto a sinistra: c'è spazio sotto e a destra (coda sotto, coda a destra, faccia a
// destra), non a sinistra. Con Math.random fisso il posto scelto è prevedibile: 0 = la prima posa e il primo lato, 0,99 = gli ultimi.
const inFrame = (onBackdrop = vi.fn()) =>
  render(<div className="help-frame with-peek" onClick={onBackdrop}><div className="help-dialog" /><EeveePeek /></div>);
/** Dopo un'uscita: il tempo massimo prima che si riveda (uscita più lunga + 3,4 s). */
const BACK = 450 + 3400;

describe('Eevee che sbircia', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('in alto, cliccato fa un saltello e sparisce senza chiudere la finestra; dopo circa 3 s spunta altrove', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const closeBackdrop = vi.fn();
    const { container } = inFrame(closeBackdrop);
    const head = () => container.querySelector<HTMLElement>('.peek-head');
    // All'apertura sempre in alto
    expect(container.querySelector('.eevee-peek')).not.toHaveClass('at-side');
    fireEvent.click(head()!);
    // Il clic non arriva allo sfondo (che chiuderebbe la finestra)
    expect(closeBackdrop).not.toHaveBeenCalled();
    expect(container.querySelector('.eevee-peek')).toHaveClass('hop');
    // Un secondo clic durante il salto non fa nulla
    fireEvent.click(head()!);
    act(() => { vi.advanceTimersByTime(450); });
    expect(container.querySelector('.eevee-peek')).toBeNull();
    act(() => { vi.advanceTimersByTime(2500); });
    expect(container.querySelector('.eevee-peek')).toBeNull();
    // Circa 3 s dopo: la prima volta la faccia di lato è la più probabile (qui esce lei, a destra)
    act(() => { vi.advanceTimersByTime(200); });
    const side = () => container.querySelector<HTMLElement>('.eevee-peek.at-side');
    expect(side()).toHaveClass('at-right');
    // Col corpo al posto del solo collare
    expect(side()!.querySelector('.peek-collar')!.getAttribute('src')).toMatch(/peek-body/);
    // Cliccata ride e rientra; poi di nuovo altrove (qui in alto, con tutti i pezzi)
    fireEvent.click(side()!.querySelector('.peek-head')!);
    expect(closeBackdrop).not.toHaveBeenCalled();
    expect(side()).toHaveClass('retreat');
    act(() => { vi.advanceTimersByTime(450); });
    expect(side()).toBeNull();
    act(() => { vi.advanceTimersByTime(3400); });
    expect(container.querySelector('.eevee-peek')).not.toHaveClass('at-side');
    expect(container.querySelector('.eevee-peek')!.querySelectorAll('img')).toHaveLength(11);
  });

  it('a volte spunta solo la coda: cliccata si ritira, e la volta dopo non è mai di nuovo la coda', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { container } = inFrame();
    const tail = () => container.querySelector<HTMLElement>('.eevee-tail-peek');
    fireEvent.click(container.querySelector<HTMLElement>('.peek-head')!);
    act(() => { vi.advanceTimersByTime(BACK); });
    expect(tail()).toHaveClass('at-right');
    fireEvent.click(tail()!.querySelector('img')!);
    expect(tail()).toHaveClass('found');
    act(() => { vi.advanceTimersByTime(250); });
    expect(tail()).toBeNull();
    // Mai la coda due volte di fila: ora la faccia di lato
    act(() => { vi.advanceTimersByTime(3400); });
    expect(tail()).toBeNull();
    expect(container.querySelector('.eevee-peek.at-side')).toHaveClass('at-right');
  });

  it('la faccia di lato può uscire anche a sinistra (specchiata), se lì c\'è spazio', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 300, right: 700, top: 100, bottom: 600, width: 400, height: 500, x: 300, y: 100, toJSON: () => ({}) });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = inFrame();
    fireEvent.click(container.querySelector<HTMLElement>('.peek-head')!);
    act(() => { vi.advanceTimersByTime(BACK); });
    expect(container.querySelector('.eevee-peek.at-side')).toHaveClass('at-left');
  });

  it('se intorno alla finestra non c\'è spazio, Eevee torna sempre in alto', () => {
    const { container } = render(<EeveePeek />);
    fireEvent.click(container.querySelector<HTMLElement>('.peek-head')!);
    act(() => { vi.advanceTimersByTime(BACK); });
    expect(container.querySelector('.eevee-tail-peek')).toBeNull();
    expect(container.querySelector('.eevee-peek')).not.toHaveClass('hop');
    expect(container.querySelector('.eevee-peek')).not.toHaveClass('at-side');
  });
});
