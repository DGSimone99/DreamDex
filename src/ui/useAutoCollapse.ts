import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * Telefono: il team si riduce da solo quando la pagina scorre oltre il team intero e resta fermo in alto, sotto la barra;
 * torna grande solo risalendo fino in cima (o tirando giù col dito quando si è già in cima, per le pagine corte).
 * Riducendosi la pagina viene spostata di quanto si accorcia il team: il contenuto non salta e non si innesca un
 * "riduci, ingrandisci" a ripetizione. `collapseToTop` lo riduce e riporta la pagina all'inizio (la barra in basso).
 */
export function useAutoCollapse(enabled: boolean, bandRef: RefObject<HTMLElement | null>) {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  // Gli scorrimenti fatti dal codice (la compensazione, il ritorno in cima) non contano come gesti
  const ignoreUntil = useRef(0);

  useEffect(() => {
    if (!enabled) { setCollapsed(false); return; }
    const html = document.documentElement;
    const topH = () => parseFloat(getComputedStyle(html).getPropertyValue('--top-h')) || 0;
    // Con un pannello a tutto schermo aperto la pagina sotto non conta
    const blocked = () => html.classList.contains('modal-open');
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const band = bandRef.current;
      if (!band || blocked() || performance.now() < ignoreUntil.current) { lastY = y; return; }
      if (!collapsedRef.current) {
        // Il team è uscito tutto sotto la barra in alto: si riduce, e la pagina si sposta di quanto si è accorciato
        if (y > lastY && band.getBoundingClientRect().bottom <= topH()) {
          const before = band.offsetHeight;
          flushSync(() => setCollapsed(true));
          // Il browser può già aver compensato da solo (ancoraggio dello scorrimento): si sposta solo il resto
          const shift = before - band.offsetHeight - (y - window.scrollY);
          if (shift > 0) { ignoreUntil.current = performance.now() + 120; window.scrollBy(0, -shift); }
        }
      } else if (y <= 2 && lastY > 2) {
        setCollapsed(false);
      }
      lastY = window.scrollY;
    };
    // Pagina corta, già in cima: tirare giù col dito (o la rotella verso l'alto) lo riapre
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => { touchY = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null; };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null || !collapsedRef.current || blocked()) return;
      if (e.touches[0].clientY - touchY > 48) { touchY = null; setCollapsed(false); }
    };
    const onWheel = (e: WheelEvent) => {
      if (collapsedRef.current && !blocked() && e.deltaY < 0 && window.scrollY <= 0) setCollapsed(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('wheel', onWheel);
    };
  }, [enabled, bandRef]);

  const collapseToTop = useCallback(() => {
    if (!enabled) return;
    ignoreUntil.current = performance.now() + 400;
    flushSync(() => setCollapsed(true));
    window.scrollTo({ top: 0 });
  }, [enabled]);

  return { collapsed, collapseToTop };
}
