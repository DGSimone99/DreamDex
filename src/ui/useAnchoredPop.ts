import { useLayoutEffect, type RefObject } from 'react';

/** Il browser sa mettere un elemento nello strato in cima a tutto (popover): niente z-index né contenitori che lo tagliano. */
export const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

/** Spazio dal bordo della finestra e dal campo. */
const EDGE = 8;
const GAP = 4;

interface Options {
  /** Larghezza minima (il menu resta largo quanto il campo, o di più se il campo è stretto). */
  minWidth?: number;
  /** Larghezza fissa al posto di quella del campo (es. il menu Set, più largo del suo pulsante); 'content': quella del contenuto. */
  width?: number | 'content';
  /** Da che lato allinearsi al campo quando il menu è più largo: inizio (sinistra) o fine (destra). */
  align?: 'start' | 'end';
  /** Lato preferito: sotto, se non ci sta e sopra c'è più posto si apre sopra (e viceversa). */
  prefer?: 'below' | 'above';
  /** Distanza dal campo. */
  gap?: number;
}

/**
 * Tendina attaccata al suo campo: sta nello strato in cima alla pagina (non la copre nulla, non allunga i pannelli e non
 * fa comparire barre di scorrimento), si apre dove c'è posto (sotto o sopra), larga quanto il campo, e non esce mai
 * dalla finestra: se manca posto si accorcia e scorre dentro. Segue il campo quando la pagina scorre o cambia misura.
 * L'elemento deve avere `popover="manual"` (vedi `supportsPopover`); senza, si posiziona comunque fisso.
 */
export function useAnchoredPop(anchor: RefObject<HTMLElement | null>, pop: RefObject<HTMLElement | null>, open: boolean, options: Options = {}): void {
  const { minWidth = 0, width, align = 'start', prefer = 'below', gap = GAP } = options;
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    if (supportsPopover && el.hasAttribute('popover') && !el.matches(':popover-open')) el.showPopover();
    // L'altezza massima del CSS (es. 340px): la tendina non supera mai quella, anche con tanto spazio
    el.style.maxHeight = '';
    const cssMax = parseFloat(getComputedStyle(el).maxHeight) || Infinity;
    const place = () => {
      const a = anchor.current;
      if (!a || !el.isConnected) return;
      const r = a.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      if (width === 'content') el.style.width = '';
      const own = width === 'content' ? Math.max(el.offsetWidth, minWidth) : width;
      const w = Math.min(own ?? Math.max(r.width, minWidth), vw - 2 * EDGE);
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(EDGE, Math.min(left, vw - EDGE - w));
      const below = vh - r.bottom - gap - EDGE;
      const above = r.top - gap - EDGE;
      // Quanto sarebbe alta senza limiti di spazio
      el.style.maxHeight = `${cssMax === Infinity ? vh : cssMax}px`;
      const natural = Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), cssMax);
      const down = prefer === 'below' ? below >= natural || below >= above : !(above >= natural || above >= below);
      const room = Math.max(80, down ? below : above);
      el.style.position = 'fixed';
      el.style.margin = '0';
      el.style.inset = 'auto';
      el.style.left = `${Math.round(left)}px`;
      el.style.width = `${Math.round(w)}px`;
      el.style.maxHeight = `${Math.floor(Math.min(cssMax, room))}px`;
      if (down) el.style.top = `${Math.round(r.bottom + gap)}px`;
      else el.style.bottom = `${Math.round(vh - r.top + gap)}px`;
      el.dataset.side = down ? 'below' : 'above';
    };
    place();
    // Lo scorrimento della tendina stessa non la sposta
    const onScroll = (e: Event) => { if (!(e.target instanceof Node && el.contains(e.target))) place(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (anchor.current) watch?.observe(anchor.current);
    // Il contenuto cambia (ricerca, linguette): si ricalcola il lato
    const content = typeof MutationObserver !== 'undefined' ? new MutationObserver(place) : null;
    content?.observe(el, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      watch?.disconnect();
      content?.disconnect();
      if (supportsPopover && el.isConnected && el.matches(':popover-open')) el.hidePopover();
    };
  }, [open, anchor, pop, minWidth, width, align, prefer, gap]);
}
