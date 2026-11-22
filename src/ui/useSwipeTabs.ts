import { useEffect, useRef, type RefObject } from 'react';

/** Quanto deve correre il dito in orizzontale per cambiare scheda, e la fascia ai bordi lasciata al gesto "indietro". */
export const SWIPE_MIN = 56;
export const SWIPE_EDGE = 24;
/** Quanto segue il dito (resistenza): mai oltre 48 px, alla prima e all'ultima scheda ancora meno. */
const FOLLOW = 0.35;
const FOLLOW_END = 0.12;
const FOLLOW_MAX = 48;

/** Dove una strisciata non deve cambiare scheda: un elenco aperto, un cursore, un testo lungo, o la cosa sotto il dito
 *  scorre da sola. I campi sì (nella scheda Set quasi tutto è un campo), tranne quello in cui si sta scrivendo: lì il
 *  dito muove il cursore del testo. */
const NO_SWIPE = 'textarea, select, [contenteditable="true"], [role="listbox"], [role="slider"], input[type="range"], [popover], .no-swipe';

function scrollsSideways(target: Element, root: Element): boolean {
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    const style = getComputedStyle(el);
    if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

/**
 * Strisciare a destra o a sinistra cambia scheda (telefono e tablet, solo col dito). Solo strisciate decise e
 * orizzontali (almeno 56 px, più in orizzontale che in verticale), mai dai bordi dello schermo (il gesto "indietro"),
 * mai dal campo in cui si sta scrivendo, da un elenco aperto o da qualcosa che scorre di lato. Mentre si striscia il contenuto segue un poco il dito
 * (`--swipe-x` sulla radice); lasciando, `onSwipe(+1)` va alla scheda dopo, `onSwipe(-1)` a quella prima.
 * `hasPrev` / `hasNext` dicono se c'è dove andare: se no, solo un piccolo rimbalzo.
 */
export function useSwipeTabs(ref: RefObject<HTMLElement | null>, opts: { enabled: boolean; hasPrev: boolean; hasNext: boolean; onSwipe: (dir: 1 | -1) => void }) {
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    const root = ref.current;
    if (!root || !opts.enabled) return;
    let start: { x: number; y: number } | null = null;
    let horizontal: boolean | null = null;
    let dx = 0;

    const follow = (x: number) => {
      const { hasPrev, hasNext } = latest.current;
      const open = x < 0 ? hasNext : hasPrev;
      const shift = Math.max(-FOLLOW_MAX, Math.min(FOLLOW_MAX, x * (open ? FOLLOW : FOLLOW_END)));
      root.style.setProperty('--swipe-x', `${shift.toFixed(1)}px`);
    };
    const release = () => {
      root.classList.remove('swiping');
      root.style.removeProperty('--swipe-x');
      start = null;
      horizontal = null;
      dx = 0;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { release(); return; }
      const touch = e.touches[0];
      const target = e.target as Element | null;
      const width = window.innerWidth || document.documentElement.clientWidth;
      if (!target || target.closest(NO_SWIPE) || scrollsSideways(target, root)) return;
      const typing = document.activeElement;
      if (typing && typing.tagName === 'INPUT' && typing.contains(target)) return;
      if (touch.clientX < SWIPE_EDGE || (width && touch.clientX > width - SWIPE_EDGE)) return;
      start = { x: touch.clientX, y: touch.clientY };
      horizontal = null;
      dx = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 1) return;
      const touch = e.touches[0];
      dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (horizontal === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        horizontal = Math.abs(dx) > 1.5 * Math.abs(dy);
        if (!horizontal) { start = null; return; }
        root.classList.add('swiping');
      }
      if (horizontal) follow(dx);
    };
    const onEnd = () => {
      if (!start || !horizontal) { release(); return; }
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      const { hasPrev, hasNext, onSwipe } = latest.current;
      const go = Math.abs(dx) >= SWIPE_MIN && (dir === 1 ? hasNext : hasPrev);
      release();
      if (go) onSwipe(dir);
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd);
    root.addEventListener('touchcancel', release);
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', release);
      release();
    };
  }, [ref, opts.enabled]);
}
