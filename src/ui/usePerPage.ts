import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CARDS_COLUMNS, CARDS_ROWS, MENU_ROWS, cardsLayout, cardsReasons, menuLayout } from './listLayout';
import type { ListStyle } from './theme';

/** Candidati per pagina senza misura (jsdom, layout stretto): come con la misura, 6 in entrambi gli stili. */
export const PAGE = MENU_ROWS;

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
 * Carte: sempre 6 (3 × 2), la carta segue l'altezza. Menu: sempre 6 righe, la riga segue l'altezza (chiudendo
 * il team le righe crescono e mostrano più motivi).
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
    if (style === 'cards') {
      // Senza misura (jsdom, layout stretto) l'altezza della carta resta quella del CSS
      if (!measure) return { perPage: CARDS_COLUMNS * CARDS_ROWS, columns: CARDS_COLUMNS, reasons: cardsReasons(teamCollapsed) };
      const { perPage, columns, tileHeight, reasons } = cardsLayout(measure.height, teamCollapsed);
      return { perPage, columns, tileHeight, reasons };
    }
    if (!measure) return { perPage: PAGE, reasons: 1 };
    const { perPage, rowHeight, reasons } = menuLayout(measure.height, teamCollapsed);
    return { perPage, rowHeight, reasons };
  }, [measure, style, teamCollapsed]);
}
