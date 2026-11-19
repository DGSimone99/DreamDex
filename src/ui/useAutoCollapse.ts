import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * Telefono: il team si riduce da solo quando la pagina scorre oltre il team intero e resta fermo in alto, sotto la barra;
 * torna grande risalendo fino in cima (o tirando giù col dito quando si è già in cima, per le pagine corte).
 * In tutti e due i versi la pagina viene spostata di quanto il team cambia: il contenuto non salta mai. Tornando grande
 * si vede prima solo la sua parte bassa, e salendo ancora lo si scopre tutto, come se fosse sempre stato lì.
 * `collapseToTop` lo riduce e riporta la pagina all'inizio (la barra in basso).
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
    /** Cambia misura al team e sposta la pagina di quanto è cambiato (al netto di ciò che il browser ha già compensato). */
    const resize = (next: boolean) => {
      const band = bandRef.current;
      if (!band) { setCollapsed(next); return; }
      const y = window.scrollY;
      const before = band.offsetHeight;
      flushSync(() => setCollapsed(next));
      const shift = band.offsetHeight - before - (window.scrollY - y);
      if (shift !== 0) { ignoreUntil.current = performance.now() + 120; window.scrollBy(0, shift); }
    };
    const onScroll = () => {
      const y = window.scrollY;
      const band = bandRef.current;
      if (!band || blocked() || performance.now() < ignoreUntil.current) { lastY = y; return; }
      if (!collapsedRef.current) {
        // Il team è uscito tutto sotto la barra in alto: si riduce, e la pagina si sposta di quanto si è accorciato
        if (y > lastY && band.getBoundingClientRect().bottom <= topH()) resize(true);
      } else if (y <= 2 && lastY > 2) {
        // Arrivati in cima risalendo: torna grande sopra la pagina, che scende di altrettanto (si vede la sua parte bassa)
        resize(false);
      }
      lastY = window.scrollY;
    };
    // Pagina corta, già in cima: tirare giù col dito (o la rotella verso l'alto) lo riapre
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => { touchY = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null; };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null || !collapsedRef.current || blocked()) return;
      if (e.touches[0].clientY - touchY > 48) { touchY = null; resize(false); }
    };
    const onWheel = (e: WheelEvent) => {
      if (collapsedRef.current && !blocked() && e.deltaY < 0 && window.scrollY <= 0) resize(false);
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
