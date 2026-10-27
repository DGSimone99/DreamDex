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
  it('senza misura (jsdom): Menu PAGE per pagina e un motivo, Carte 6 con 2 motivi (3 a team nascosto)', () => {
    expect(setup('menu', { width: 0, height: 0 }).result.current).toEqual({ perPage: PAGE, reasons: 1 });
    expect(setup('cards', { width: 0, height: 0 }).result.current).toEqual({ perPage: 6, columns: 3, reasons: 2 });
    expect(setup('cards', { width: 0, height: 0 }, true).result.current.reasons).toBe(3);
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

  it('Menu: team aperto un motivo anche con righe alte, team nascosto di più', () => {
    const fire = stubObservers();
    const size = { width: 560, height: 100 };
    const { result, rerender } = setup('menu', size);
    fire();
    expect(result.current.rowHeight).toBeGreaterThanOrEqual(60);
    expect(result.current.reasons).toBe(1);
    size.height = 712;
    rerender({ collapsed: true });
    fire();
    expect(result.current.reasons).toBeGreaterThan(1);
  });

  it('Carte: 6 per pagina, carta dall’altezza (max 260), motivi 2 → 3 nascondendo il team', () => {
    const fire = stubObservers();
    const size = { width: 560, height: 400 };
    const { result, rerender } = setup('cards', size);
    fire();
    expect(result.current).toEqual({ perPage: 6, columns: 3, tileHeight: 186, reasons: 2 });
    size.height = 900;
    rerender({ collapsed: true });
    fire();
    expect(result.current).toEqual({ perPage: 6, columns: 3, tileHeight: 260, reasons: 3 });
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
