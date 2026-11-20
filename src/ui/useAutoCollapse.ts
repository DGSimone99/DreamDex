import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * Telefono: il team si riduce da solo appena della fascia grande resta in vista quanto la striscia ridotta (il fondo
 * delle ultime carte) e resta fermo in alto, sotto la barra; torna grande risalendo fino in cima (o tirando giù
 * col dito quando si è già in cima, per le pagine corte).
 * In tutti e due i versi la pagina viene spostata di quanto il team cambia: il contenuto non salta mai. Tornando grande
 * si vede prima solo la sua parte bassa, e salendo ancora lo si scopre tutto, come se fosse sempre stato lì.
 * Il cambio è immediato (AutoBand ridisegna solo il team): la striscia compare esattamente al punto giusto.
 * `collapseToTop` lo riduce e riporta la pagina all'inizio (la barra in basso).
 */
export function useAutoCollapse(enabled: boolean, bandRef: RefObject<HTMLElement | null>) {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  // Gli scorrimenti fatti dal codice (la compensazione, il ritorno in cima) non contano come gesti
  const ignoreUntil = useRef(0);
  // Un cambio di misura chiesto e non ancora disegnato: l'altezza di prima, per spostare la pagina appena è pronto
  const pending = useRef<number | null>(null);
  // L'altezza della striscia ridotta (misurata a ogni riduzione)
  const stripH = useRef(74);
  // Appena tornato grande non si riduce finché non si scende ancora un po' (niente riduci-riapri sul confine)
  const armY = useRef(-Infinity);

  // Il cambio è disegnato: la pagina si sposta di quanto il team è cambiato, il contenuto resta dov'era
  useLayoutEffect(() => {
    const band = bandRef.current;
    if (!band || pending.current === null) return;
    const shift = band.offsetHeight - pending.current;
    pending.current = null;
    if (collapsed) stripH.current = band.offsetHeight;
    if (shift !== 0) { ignoreUntil.current = performance.now() + 120; window.scrollBy(0, shift); }
    if (!collapsed) armY.current = window.scrollY + 48;
  }, [collapsed, bandRef]);

  useEffect(() => {
    if (!enabled) { pending.current = null; setCollapsed(false); return; }
    const html = document.documentElement;
    const topH = () => parseFloat(getComputedStyle(html).getPropertyValue('--top-h')) || 0;
    // Con un pannello a tutto schermo aperto la pagina sotto non conta
    const blocked = () => html.classList.contains('modal-open');
    // Si riduce quando della fascia grande resta in vista quanto la striscia ridotta: la striscia ne prende il posto
    // esatto e non copre niente. Prima non si può: la pagina dovrebbe salire oltre la cima e il contenuto salterebbe
    let lastY = window.scrollY;
    const resize = (next: boolean) => {
      const band = bandRef.current;
      if (!band || pending.current !== null) return;
      pending.current = band.offsetHeight;
      flushSync(() => setCollapsed(next));
    };
    const onScroll = () => {
      const y = window.scrollY;
      const band = bandRef.current;
      if (!band || blocked() || pending.current !== null || performance.now() < ignoreUntil.current) { lastY = y; return; }
      if (!collapsedRef.current) {
        // Il margine dopo la riapertura vale solo sul confine: risalendo oltre si toglie, la volta dopo si riduce al punto giusto
        if (y < armY.current - 96) armY.current = -Infinity;
        if (y > lastY && y > armY.current && band.getBoundingClientRect().bottom <= topH() + stripH.current) resize(true);
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
    pending.current = null;
    flushSync(() => setCollapsed(true));
    window.scrollTo({ top: 0 });
  }, [enabled]);

  return { collapsed, collapseToTop };
}
