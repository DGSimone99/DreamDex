import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { cardsLayout, cardsReasons } from './listLayout';
import { useMediaQuery } from './useMediaQuery';

/** Candidati per pagina senza misura (jsdom, telefono e tablet stretto): 6 (3 × 2 o 2 × 3). */
export const PAGE = 6;
/** Tablet da 760 px: la lista a tutta larghezza; le carte per riga vanno da 4 a 2 con la larghezza vera della lista
 *  (in orizzontale c'è la colonna del team), almeno TABLET_CARD_MIN px l'una; la pagina sono due file piene. */
const TABLET_WIDE = '(min-width: 760px) and (max-width: 1099px)';
const TABLET_CARD_MIN = 150;
/** Padding e spazio fra le carte della griglia (suggestions.css, .suggestions.cards). */
const GRID_PAD = 28;
const GRID_GAP = 8;
const tabletCols = (width: number) => Math.max(2, Math.min(4, Math.floor((width - GRID_PAD + GRID_GAP) / (TABLET_CARD_MIN + GRID_GAP))));

/** Solo con lista e scheda affiancate la lista ha un'altezza sua: sotto, crescerebbe col contenuto. */
const WIDE = '(min-width: 1100px)';

export interface PerPage {
  perPage: number;
  /** Colonne e altezza di ogni carta. */
  columns?: number;
  tileHeight?: number;
  /** Quanti motivi entrano sotto il nome. */
  reasons: number;
  /** Larghezza fissa della lista (solo su desktop, con la misura). */
  listWidth?: number;
}

interface Measure {
  /** Larghezza della scheda (lista + dettaglio) e altezza della lista. */
  width: number;
  height: number;
}

const wide = () => typeof matchMedia !== 'function' || matchMedia(WIDE).matches;

/**
 * Quanti candidati per pagina (ResizeObserver): le colonne dalla larghezza della scheda (`pickerRef`, lista + dettaglio),
 * le file dall'altezza della lista (`ref`). Col team nascosto la lista è più alta: più file, più carte.
 */
export function usePerPage(ref: RefObject<HTMLElement | null>, pickerRef: RefObject<HTMLElement | null>, teamCollapsed: boolean): PerPage {
  const [measure, setMeasure] = useState<Measure | null>(null);
  const tabletWide = useMediaQuery(TABLET_WIDE);
  // Tablet: quante carte per riga ci stanno nella lista (misurata)
  const [cols, setCols] = useState(4);
  // La lista compare e sparisce (lista vuota, team pieno): si osserva l'elemento del momento
  const observed = useRef<{ el: HTMLElement; observer: ResizeObserver } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (observed.current?.el === el) return;
    observed.current?.observer.disconnect();
    observed.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const width = pickerRef.current?.clientWidth || el.clientWidth;
      const height = el.clientHeight;
      // Scheda nascosta (0×0): si tiene l'ultima misura
      if (!width || !height) return;
      if (!wide()) {
        setMeasure(null);
        if (typeof matchMedia === 'function' && matchMedia(TABLET_WIDE).matches) setCols(tabletCols(el.clientWidth));
        return;
      }
      setMeasure(prev => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    if (pickerRef.current) observer.observe(pickerRef.current);
    observed.current = { el, observer };
  });
  useLayoutEffect(() => () => { observed.current?.observer.disconnect(); observed.current = null; }, []);

  return useMemo<PerPage>(() => {
    // Senza misura (jsdom, layout stretto) l'altezza della carta resta quella del CSS
    if (!measure) return tabletWide
      ? { perPage: cols * 2, columns: cols, reasons: cardsReasons(teamCollapsed) }
      : { perPage: PAGE, columns: 3, reasons: cardsReasons(teamCollapsed) };
    const { perPage, columns, tileHeight, reasons, listWidth } = cardsLayout(measure.height, teamCollapsed, measure.width);
    return { perPage, columns, tileHeight, reasons, listWidth };
  }, [measure, teamCollapsed, tabletWide, cols]);
}
