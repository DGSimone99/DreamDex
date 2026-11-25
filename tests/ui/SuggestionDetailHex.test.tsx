import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

vi.setConfig({ testTimeout: 60000 });

/**
 * Lo spazio misurato sotto Perché basta per l'altezza prevista dell'esagono (HEX_PART_H), ma l'esagono vero è più alto
 * (in Perché lo spazio fra le parti è più largo): messo lì fa scorrere il corpo. Prima l'esagono entrava, il corpo
 * scorreva, l'esagono usciva, c'era di nuovo posto e rientrava, all'infinito: "Maximum update depth exceeded" e la
 * pagina bianca (capitava aggiungendo Pokémon di fila, quando un dettaglio cadeva in quella misura).
 */
function fakeLayout() {
  const proto = HTMLElement.prototype;
  const visibleHex = (el: Element) => [...el.querySelectorAll<HTMLElement>('.hex-part')].some(hex => hex.style.display !== 'none');
  const restore: (() => void)[] = [];
  const define = (name: 'scrollHeight' | 'clientHeight' | 'offsetTop', get: (el: HTMLElement) => number) => {
    const before = Object.getOwnPropertyDescriptor(proto, name);
    Object.defineProperty(proto, name, { configurable: true, get() { return get(this as HTMLElement); } });
    restore.push(() => { if (before) Object.defineProperty(proto, name, before); });
  };
  define('clientHeight', el => (el.classList.contains('detail-body') ? 600 : 0));
  define('scrollHeight', el => (el.classList.contains('detail-body') ? 590 + (visibleHex(el) ? 180 : 0) : 0));
  define('offsetTop', () => 0);
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const parent = this.parentElement;
    const bottom = this.classList.contains('detail-body') ? 600
      : parent?.classList.contains('detail-why') ? 425
      : parent?.classList.contains('detail-run') ? 500 : 0;
    return { top: 0, bottom, left: 0, right: 0, width: 0, height: bottom, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  restore.push(() => rect.mockRestore());
  const media = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query.includes('min-width: 1100px'), media: query, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  }) as MediaQueryList);
  restore.push(() => media.mockRestore());
  return () => { for (const undo of restore.reverse()) undo(); };
}

let undoLayout: (() => void) | null = null;
afterEach(() => { undoLayout?.(); undoLayout = null; });

describe('SuggestionDetail: esagono nel corpo', () => {
  it('se messo lì fa scorrere il corpo, l’esagono esce e non rientra (niente ciclo infinito, niente pagina bianca)', async () => {
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => null) as unknown as typeof window.matchMedia;
    undoLayout = fakeLayout();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const detail = await screen.findByRole('complementary', { name: /^Dettaglio di / });
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/Maximum update depth/);
    // Il dettaglio c'è ancora e l'esagono resta nel fumetto di Stat: nel corpo non entra davvero
    expect(detail.querySelector('.detail-body .hex-part')).toBeNull();
    errors.mockRestore();
  });
});
