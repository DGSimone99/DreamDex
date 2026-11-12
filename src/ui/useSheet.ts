import { useEffect, useRef, type RefObject } from 'react';

/**
 * Scheda a tutto schermo sul telefono (es. il dettaglio del candidato): finché è aperta si comporta come una finestra.
 * - il resto della pagina è inerte (il Tab e i lettori di schermo restano nella scheda);
 * - il fuoco entra nella scheda e, chiudendola, torna dov'era (la carta che l'ha aperta);
 * - Esc la chiude.
 * `parts` sono gli elementi della scheda (la scheda e il suo pulsante Indietro), fratelli nello stesso contenitore;
 * l'ultimo (la scheda) prende il fuoco.
 */
export function useSheet(active: boolean, container: RefObject<HTMLElement | null>, parts: string, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const box = container.current;
    if (!active || !box) return;
    const keep = [...box.querySelectorAll<HTMLElement>(parts)].filter(el => el.parentElement === box);
    if (!keep.length) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Inerte tutto quello che non è la scheda: i fratelli nel contenitore, poi i fratelli di ogni antenato fino a #root
    const changed: HTMLElement[] = [];
    const mark = (parent: Element, skip: (el: Element) => boolean) => {
      for (const child of parent.children) {
        if (!(child instanceof HTMLElement) || skip(child) || child.hasAttribute('inert')) continue;
        child.setAttribute('inert', '');
        changed.push(child);
      }
    };
    mark(box, el => keep.includes(el as HTMLElement));
    let node: Element = box;
    while (node.parentElement && node.id !== 'root' && node.parentElement !== document.body) {
      const parent: Element = node.parentElement;
      const current = node;
      mark(parent, el => el === current);
      node = parent;
    }
    keep[keep.length - 1].focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      changed.forEach(el => el.removeAttribute('inert'));
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [active, container, parts]);
}
