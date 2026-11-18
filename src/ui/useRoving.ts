import { useCallback, useEffect, useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent } from 'react';

/** I pezzi raggiungibili con le frecce dentro un gruppo (`useRoving`), se il gruppo non ne sceglie altri. */
export const ROVING_ITEM = '[data-nav]';

/**
 * Le caselle di una griglia di Coverage (tabella con role="grid"): le testate delle colonne (non quella in alto a
 * sinistra, che tiene le pagine), le testate delle righe e tutte le caselle; non la riga vuota che riempie lo spazio.
 */
export const GRID_CELLS = ':scope > thead > tr > th:not(.def-mon-h), :scope > tbody > tr:not(.og-fill) > th, :scope > tbody > tr:not(.og-fill) > td, :scope > tfoot > tr > th, :scope > tfoot > tr > td';

/** I riquadri visibili (un pezzo nascosto non si raggiunge). */
const visible = (el: HTMLElement) => el.getClientRects().length > 0;

/**
 * Un solo posto nel giro del Tab per tutto un gruppo (una griglia, la tabella della Generale): il Tab entra sull'ultimo
 * pezzo toccato (all'inizio il primo), le frecce si muovono fra i pezzi come si vedono sullo schermo (destra e sinistra
 * sulla stessa riga, su e giù alla riga sopra o sotto, sul pezzo più vicino in orizzontale), Home e End vanno al primo e
 * all'ultimo della riga (con Ctrl al primo e all'ultimo di tutti). Invio e Spazio restano al pezzo (il suo clic).
 * `selector`: quali elementi sono i pezzi (di base quelli con `data-nav`). Restituisce `ref` per il contenitore e i due
 * gestori da mettergli.
 */
export function useRoving<T extends HTMLElement>(selector: string = ROVING_ITEM) {
  const ref = useRef<T | null>(null);
  const current = useRef<HTMLElement | null>(null);
  const items = useCallback(() => (ref.current ? [...ref.current.querySelectorAll<HTMLElement>(selector)] : []), [selector]);
  // Un pezzo solo con tabindex 0 (l'ultimo toccato, se c'è ancora; se no il primo), gli altri -1
  const sync = useCallback(() => {
    const list = items();
    if (!list.length) return;
    const active = current.current && list.includes(current.current) ? current.current : list[0];
    for (const el of list) {
      const want = el === active ? 0 : -1;
      if (el.tabIndex !== want || !el.hasAttribute('tabindex')) el.tabIndex = want;
    }
  }, [items]);
  // A ogni disegno e quando cambiano i pezzi (pagine di Coverage meta, righe che arrivano)
  useLayoutEffect(() => { sync(); });
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof MutationObserver === 'undefined') return;
    const watch = new MutationObserver(sync);
    watch.observe(root, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [sync]);

  // Il pezzo che contiene l'elemento (closest non va: il selettore può usare :scope, che vale per il contenitore)
  const itemOf = useCallback((node: Node) => items().find(el => el.contains(node)) ?? null, [items]);

  const onFocus = useCallback((e: FocusEvent<T>) => {
    const item = itemOf(e.target as Node);
    if (!item || item === current.current) return;
    current.current = item;
    sync();
  }, [itemOf, sync]);

  const onKeyDown = useCallback((e: KeyboardEvent<T>) => {
    if (e.altKey || e.metaKey || e.defaultPrevented) return;
    const from = itemOf(e.target as Node);
    if (!from) return;
    const list = items().filter(visible);
    const box = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; };
    const here = box(from);
    const boxes = list.map(el => ({ el, ...box(el) }));
    // Sulla stessa riga: i centri a meno di mezza altezza
    const sameRow = (y: number, b: { y: number; h: number }) => Math.abs(b.y - y) < Math.max(4, b.h / 2);
    const row = (y: number) => boxes.filter(b => sameRow(y, b)).sort((a, b) => a.x - b.x);
    const nearestX = (bs: typeof boxes) => bs.reduce<(typeof boxes)[number] | null>((best, b) => (!best || Math.abs(b.x - here.x) < Math.abs(best.x - here.x) ? b : best), null);
    let next: HTMLElement | null | undefined = null;
    const line = row(here.y);
    switch (e.key) {
      case 'ArrowRight': next = line.find(b => b.x > here.x + 1)?.el; break;
      case 'ArrowLeft': next = [...line].reverse().find(b => b.x < here.x - 1)?.el; break;
      case 'ArrowDown':
      case 'ArrowUp': {
        const down = e.key === 'ArrowDown';
        const beyond = boxes.filter(b => (down ? b.y > here.y + here.h / 2 : b.y < here.y - here.h / 2));
        if (!beyond.length) break;
        const edge = beyond.reduce((a, b) => (down ? (b.y < a.y ? b : a) : (b.y > a.y ? b : a)));
        next = nearestX(row(edge.y))?.el;
        break;
      }
      case 'Home': next = (e.ctrlKey ? boxes[0] : line[0])?.el; break;
      case 'End': next = (e.ctrlKey ? boxes[boxes.length - 1] : line[line.length - 1])?.el; break;
      default: return;
    }
    e.preventDefault();
    if (!next || next === from) return;
    current.current = next;
    sync();
    next.focus();
  }, [items, itemOf, sync]);

  return { ref, onFocus, onKeyDown };
}
