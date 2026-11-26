import { useEffect, useRef, type RefObject } from 'react';
import { reducedMotion } from './useMediaQuery';

/** Quanto deve correre il dito in orizzontale per cambiare scheda, e la fascia ai bordi lasciata al gesto "indietro". */
export const SWIPE_MIN = 56;
export const SWIPE_EDGE = 24;
/** Una strisciata veloce (un colpo di dito) basta anche se corta: almeno 24 px a 0,4 px/ms. */
const FLICK_MIN = 24;
const FLICK_SPEED = 0.4;
/** Alla prima e all'ultima scheda il contenuto segue il dito con resistenza, fino a 40 px. */
const FOLLOW_END = 0.2;
const FOLLOW_END_MAX = 40;
/** Il passaggio: la scheda vecchia continua nel verso del dito e svanisce, la nuova entra dall'altro lato nello stesso
 *  verso (come sfogliare); quanto corrono (frazione della larghezza) e quanto durano. */
const TRAVEL = 0.3;
const EXIT_MS = 130;
const ENTER_MS = 240;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

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
 * orizzontali (almeno 56 px, più in orizzontale che in verticale; un colpo di dito veloce basta anche se corto), mai dai
 * bordi dello schermo (il gesto "indietro"), dal campo in cui si sta scrivendo, da un elenco aperto o da qualcosa che
 * scorre di lato. Mentre si striscia il contenuto (`parts`, sotto la testata) segue il dito (`--swipe-x` sulla radice);
 * lasciando, la scheda vecchia continua e svanisce, `onSwipe(+1)` (dopo) o `onSwipe(-1)` (prima) cambia scheda e la
 * nuova entra dall'altro lato. `hasPrev` / `hasNext` dicono se c'è dove andare: se no, solo un rimbalzo.
 */
export function useSwipeTabs(ref: RefObject<HTMLElement | null>, opts: { enabled: boolean; hasPrev: boolean; hasNext: boolean; parts: string; onSwipe: (dir: 1 | -1) => void }) {
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    const root = ref.current;
    if (!root || !opts.enabled) return;
    let start: { x: number; y: number } | null = null;
    let horizontal: boolean | null = null;
    let dx = 0;
    let shift = 0;
    // Le ultime due posizioni del dito, per la velocità quando si lascia
    let last = { x: 0, t: 0 };
    let prev = { x: 0, t: 0 };
    let busy = false;

    // Il dito trascina il contenuto 1:1 se da quel lato c'è una scheda, sennò con resistenza
    const follow = (x: number) => {
      const { hasPrev, hasNext } = latest.current;
      const open = x < 0 ? hasNext : hasPrev;
      shift = open ? x : Math.max(-FOLLOW_END_MAX, Math.min(FOLLOW_END_MAX, x * FOLLOW_END));
      root.style.setProperty('--swipe-x', `${shift.toFixed(1)}px`);
    };
    const release = () => {
      root.classList.remove('swiping');
      root.style.removeProperty('--swipe-x');
      start = null;
      horizontal = null;
      dx = 0;
      shift = 0;
    };
    const parts = () => [...root.querySelectorAll<HTMLElement>(latest.current.parts)];
    const commit = (dir: 1 | -1) => {
      const from = shift;
      release();
      if (reducedMotion() || typeof root.animate !== 'function') { latest.current.onSwipe(dir); return; }
      busy = true;
      const travel = Math.max(80, root.clientWidth * TRAVEL);
      const exits = parts().map(el => el.animate(
        // Continua da dove l'ha portata il dito, nello stesso verso
        [{ transform: `translateX(${from}px)`, opacity: 1 }, { transform: `translateX(${from - dir * travel}px)`, opacity: 0 }],
        // A velocità costante: il dito si stava già muovendo, partire piano darebbe uno strappo
        { duration: EXIT_MS, easing: 'linear', fill: 'forwards' }));
      void Promise.all(exits.map(a => a.finished)).catch(() => undefined).then(() => {
        latest.current.onSwipe(dir);
        // Due fotogrammi: React ha disegnato la scheda nuova; entra dall'altro lato, poi si tolgono le uscite
        requestAnimationFrame(() => requestAnimationFrame(() => {
          for (const el of parts()) el.animate(
            [{ transform: `translateX(${dir * travel}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
            { duration: ENTER_MS, easing: EASE_OUT });
          for (const a of exits) a.cancel();
          busy = false;
        }));
      });
    };

    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1) { release(); return; }
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
      last = prev = { x: touch.clientX, t: performance.now() };
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 1) return;
      const touch = e.touches[0];
      dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      prev = last;
      last = { x: touch.clientX, t: performance.now() };
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
      const { hasPrev, hasNext } = latest.current;
      const speed = Math.abs(last.x - prev.x) / Math.max(1, last.t - prev.t);
      const far = Math.abs(dx) >= SWIPE_MIN || (Math.abs(dx) >= FLICK_MIN && speed >= FLICK_SPEED);
      if (far && (dir === 1 ? hasNext : hasPrev)) commit(dir);
      else release();
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
