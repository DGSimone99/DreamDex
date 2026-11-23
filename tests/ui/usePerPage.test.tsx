import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAGE, usePerPage } from '../../src/ui/usePerPage';

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

function setup(size: { width: number; height: number }, collapsed = false, pickerWidth = 0) {
  const el = box(size);
  const picker = box({ width: pickerWidth, height: 0 });
  return renderHook(({ collapsed }) => {
    const ref = useRef<HTMLElement>(el);
    const pickerRef = useRef<HTMLElement>(picker);
    return usePerPage(ref, pickerRef, collapsed);
  }, { initialProps: { collapsed } });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('usePerPage', () => {
  it('senza misura (jsdom): PAGE (6) carte per pagina con 2 motivi (3 a team nascosto)', () => {
    expect(PAGE).toBe(6);
    expect(setup({ width: 0, height: 0 }).result.current).toEqual({ perPage: PAGE, columns: 3, reasons: 2 });
    expect(setup({ width: 0, height: 0 }, true).result.current.reasons).toBe(3);
  });

  it('Box: colonne dalla larghezza della scheda, file dall’altezza della lista', () => {
    const fire = stubObservers();
    const { result } = setup({ width: 654, height: 456 }, false, 1182);
    fire();
    expect(result.current).toEqual({ perPage: 8, columns: 4, tileHeight: 210, reasons: 2, listWidth: 654 });
  });

  it('nascondendo il team la lista cresce e le carte per pagina aumentano', () => {
    const fire = stubObservers();
    const size = { width: 654, height: 456 };
    const { result, rerender } = setup(size, false, 1182);
    fire();
    expect(result.current.perPage).toBe(8);
    size.height = 656;
    rerender({ collapsed: true });
    fire();
    expect(result.current).toMatchObject({ perPage: 12, reasons: 3 });
  });
});
