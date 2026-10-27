import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAGE, usePerPage } from '../../src/ui/usePerPage';
import type { ListStyle } from '../../src/ui/theme';

/** ResizeObserver finto: si tengono le callback per lanciarle a mano. */
function stubObservers() {
  const callbacks: (() => void)[] = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: () => void) { callbacks.push(cb); }
    observe() {}
    disconnect() {}
  });
  return () => act(() => { for (const cb of [...callbacks]) cb(); });
}

/** Un contenitore con altezza e larghezza decise dal test. */
function box(size: { width: number; height: number }) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { get: () => size.height });
  Object.defineProperty(el, 'clientWidth', { get: () => size.width });
  return el;
}

function setup(style: ListStyle, size: { width: number; height: number }, collapsed = false) {
  const el = box(size);
  return renderHook(({ collapsed }) => {
    const ref = useRef<HTMLElement>(el);
    return usePerPage(ref, style, collapsed);
  }, { initialProps: { collapsed } });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('usePerPage', () => {
  it('senza misura (jsdom): PAGE per pagina e un motivo', () => {
    const { result } = setup('cards', { width: 0, height: 0 });
    expect(result.current).toEqual({ perPage: PAGE, reasons: 1 });
  });

  it('il per-pagina non cambia chiudendo il team', () => {
    for (const style of ['cards', 'menu'] as const) {
      const fire = stubObservers();
      const size = { width: 560, height: 532 };
      const { result, rerender } = setup(style, size);
      fire();
      const open = result.current;
      expect(open.perPage).toBeGreaterThan(0);
      // Team chiuso: il contenitore cresce, il numero per pagina resta
      size.height = 712;
      rerender({ collapsed: true });
      fire();
      expect(result.current.perPage).toBe(open.perPage);
      expect(result.current.reasons).toBeGreaterThanOrEqual(open.reasons);
      // E riaprendolo, ancora lo stesso
      size.height = 532;
      rerender({ collapsed: false });
      fire();
      expect(result.current.perPage).toBe(open.perPage);
      vi.unstubAllGlobals();
    }
  });

  it('Carte: colonne e altezza della tessera; Menu: altezza della riga', () => {
    let fire = stubObservers();
    const cards = setup('cards', { width: 560, height: 532 });
    fire();
    expect(cards.result.current.columns).toBeGreaterThanOrEqual(2);
    expect(cards.result.current.tileHeight).toBeGreaterThan(0);
    vi.unstubAllGlobals();
    fire = stubObservers();
    const menu = setup('menu', { width: 560, height: 532 });
    fire();
    expect(menu.result.current.rowHeight).toBeGreaterThan(0);
    expect(menu.result.current.columns).toBeUndefined();
  });

  it('partendo col team chiuso usa l’altezza attuale', () => {
    const fire = stubObservers();
    const { result } = setup('menu', { width: 560, height: 712 }, true);
    fire();
    expect(result.current.perPage).toBeGreaterThan(PAGE);
  });
});
