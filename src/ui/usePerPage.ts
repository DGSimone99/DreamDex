import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CARDS_COLUMNS, CARDS_ROWS, cardsLayout, cardsReasons } from './listLayout';

/** Candidati per pagina senza misura (jsdom, layout stretto): 6 (3 × 2), come con la misura. */
export const PAGE = CARDS_COLUMNS * CARDS_ROWS;

/** Solo con lista e scheda affiancate la lista ha un'altezza sua: sotto, crescerebbe col contenuto. */
const WIDE = '(min-width: 1100px)';

export interface PerPage {
  perPage: number;
  /** Colonne e altezza di ogni carta. */
  columns?: number;
  tileHeight?: number;
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
 * Fino a 6 carte (3 × 2), la carta segue l'altezza; colonne dalla larghezza, una riga sola se due farebbero carte troppo
 * basse.
 */
export function usePerPage(ref: RefObject<HTMLElement | null>, teamCollapsed: boolean): PerPage {
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
    // Senza misura (jsdom, layout stretto) l'altezza della carta resta quella del CSS
    if (!measure) return { perPage: PAGE, columns: CARDS_COLUMNS, reasons: cardsReasons(teamCollapsed) };
    const { perPage, columns, tileHeight, reasons } = cardsLayout(measure.height, teamCollapsed, measure.width);
    return { perPage, columns, tileHeight, reasons };
  }, [measure, teamCollapsed]);
}
