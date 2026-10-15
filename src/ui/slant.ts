import { useLayoutEffect, type RefObject } from 'react';

/** Pendenza delle card del team (skewX di 8°, vedi --skew). */
export const SLANT = Math.tan((8 * Math.PI) / 180);

/** Distanza delle righe dal bordo inclinato. */
const GAP = 14;

/** Elementi che si spostano con il bordo senza allinearsi a sinistra: sprite (centrato), stella e ×. */
const SHIFTED = '.sprite-wrap, .favorite, .remove';

type Box = { cardHeight: number; top: number; height: number };

/** Di quanto il bordo inclinato è a destra di quello in fondo, all'altezza del centro della riga. */
export function slantShift(row: Box): number {
  return (row.cardHeight - (row.top + row.height / 2)) * SLANT;
}

/**
 * Spostamento orizzontale di una riga perché stia a `gap` px dal bordo inclinato della card.
 * La card è inclinata attorno al lato in basso: lì il bordo coincide col margine sinistro
 * (e con l'inizio della colonna), salendo si sposta a destra.
 */
export function slantOffset(row: Box & { left: number }, gap = GAP): number {
  return slantShift(row) + gap - row.left;
}

/** Fa seguire la diagonale ai figli della card; si ricalcola quando la card cambia dimensione. */
export function useSlant(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card) return;
    const apply = () => {
      for (const child of card.children) {
        if (!(child instanceof HTMLElement)) continue;
        // offsetTop/offsetLeft ignorano lo spostamento già applicato
        const row = { cardHeight: card.offsetHeight, top: child.offsetTop, height: child.offsetHeight, left: child.offsetLeft };
        const dx = child.matches(SHIFTED) ? slantShift(row) : slantOffset(row);
        child.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      }
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(apply);
    observer.observe(card);
    return () => observer.disconnect();
  });
}
