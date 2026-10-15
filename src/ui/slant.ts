import { useLayoutEffect, type RefObject } from 'react';

/** Pendenza delle card del team (skewX di 8°, vedi --skew). */
export const SLANT = Math.tan((8 * Math.PI) / 180);

/** Distanza delle righe dal bordo inclinato. */
const GAP = 14;

/** Elementi che non seguono la diagonale: lo sprite resta centrato, stella e × nell'angolo. */
const FIXED = '.sprite-wrap, .favorite, .remove';

/**
 * Spostamento orizzontale di una riga perché stia a `gap` px dal bordo inclinato della card.
 * Il bordo passa per il margine sinistro a metà altezza (skew attorno al centro):
 * sopra il centro è più a destra, sotto più a sinistra.
 */
export function slantOffset(row: { cardHeight: number; top: number; height: number; left: number }, gap = GAP): number {
  const center = row.top + row.height / 2;
  return (row.cardHeight / 2 - center) * SLANT + gap - row.left;
}

/** Fa seguire la diagonale ai figli della card; si ricalcola quando la card cambia dimensione. */
export function useSlant(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card) return;
    const apply = () => {
      for (const child of card.children) {
        if (!(child instanceof HTMLElement) || child.matches(FIXED)) continue;
        // offsetTop/offsetLeft ignorano lo spostamento già applicato
        const dx = slantOffset({ cardHeight: card.offsetHeight, top: child.offsetTop, height: child.offsetHeight, left: child.offsetLeft });
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
