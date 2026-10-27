import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { cardsLayout, menuLayout } from './listLayout';
import type { ListStyle } from './theme';

/** Candidati per pagina senza misura (jsdom, layout stretto). */
export const PAGE = 10;

/** Solo con lista e scheda affiancate la lista ha un'altezza sua: sotto, crescerebbe col contenuto. */
const WIDE = '(min-width: 1100px)';

export interface PerPage {
  perPage: number;
  /** Carte: colonne e altezza di ogni casella. */
  columns?: number;
  tileHeight?: number;
  /** Menu: altezza di ogni riga. */
  rowHeight?: number;
  /** Quanti motivi entrano sotto il nome. */
  reasons: number;
}

interface Measure {
  width: number;
  height: number;
  /** L'ultima altezza misurata col team aperto (null: non ancora, si è partiti col team chiuso). */
  open: number | null;
  windowHeight: number;
}

const wide = () => typeof matchMedia !== 'function' || matchMedia(WIDE).matches;

/**
 * Quanti candidati per pagina, dallo spazio del contenitore della lista (ResizeObserver).
 * Il numero si calcola come se il team fosse aperto: chiudendolo le caselle crescono, il numero resta.
 */
export function usePerPage(ref: RefObject<HTMLElement | null>, style: ListStyle, teamCollapsed: boolean): PerPage {
  const [measure, setMeasure] = useState<Measure | null>(null);
  // Letto dalla callback: dopo un cambio, la misura nuova arriva quando il prop è già aggiornato
  const collapsedRef = useRef(teamCollapsed);
  collapsedRef.current = teamCollapsed;
  // La lista compare e sparisce (lista vuota, team pieno): si osserva l'elemento del momento
  const observed = useRef<{ el: HTMLElement; observer: ResizeObserver } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (observed.current?.el === el) return;
    observed.current?.observer.disconnect();
    observed.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      // Scheda nascosta (0×0): si tiene l'ultima misura
      if (!width || !height) return;
      if (!wide()) { setMeasure(null); return; }
      setMeasure(prev => {
        const open = collapsedRef.current ? prev?.open ?? null : height;
        const windowHeight = window.innerHeight;
        if (prev && prev.width === width && prev.height === height && prev.open === open && prev.windowHeight === windowHeight) return prev;
        return { width, height, open, windowHeight };
      });
    });
    observer.observe(el);
    observed.current = { el, observer };
  });
  useLayoutEffect(() => () => { observed.current?.observer.disconnect(); observed.current = null; }, []);

  return useMemo<PerPage>(() => {
    if (!measure) return { perPage: PAGE, reasons: 1 };
    // Partendo col team chiuso, l'altezza attuale finché il team non si apre
    const open = measure.open ?? measure.height;
    if (style === 'menu') {
      const { perPage, rowHeight, reasons } = menuLayout(open, measure.height, measure.windowHeight);
      return { perPage, rowHeight, reasons };
    }
    const { perPage, columns, tileHeight, reasons } = cardsLayout(measure.width, open, measure.height);
    return { perPage, columns, tileHeight, reasons };
  }, [measure, style]);
}
