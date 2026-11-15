import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Quanto aspetta prima di aprirsi: passando col mouse sopra la griglia non si accende a ogni casella. */
const OPEN_DELAY = 140;
/** Distanza dal riquadro di partenza e margine minimo dai bordi della finestra. */
const GAP = 9;
const EDGE = 8;

/**
 * Il punto di partenza del tooltip: chi lo apre passa il suo riquadro e una chiave (quale casella). `open` dopo un
 * attimo (`delay`, 140 ms; più lungo dove il mouse passa spesso, come le carte del team), `close` subito. Un solo stato
 * per tutta una griglia: ogni casella chiama `open` con la sua chiave.
 */
export function useFloatAnchor<K>(delay = OPEN_DELAY) {
  const [anchor, setAnchor] = useState<{ key: K; rect: DOMRect } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const open = useCallback((key: K, el: Element) => {
    window.clearTimeout(timer.current);
    const rect = el.getBoundingClientRect();
    timer.current = window.setTimeout(() => setAnchor({ key, rect }), delay);
  }, [delay]);
  const close = useCallback(() => { window.clearTimeout(timer.current); setAnchor(null); }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Scorrere o ridimensionare sposterebbe la casella sotto il tooltip: si chiude
  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); window.removeEventListener('keydown', onKey); };
  }, [anchor, close]);
  return { anchor, open, close };
}

/**
 * Il tooltip DreamDex: un pannello nel body (posizione fissa, mai tagliato dai contenitori), sotto il riquadro di
 * partenza o sopra se sotto non c'è posto, tenuto dentro la finestra; la punta indica il centro del riquadro.
 * `tone`: il colore dell'alone e della testata (es. il colore del tipo). Solo visivo (aria-hidden): lo stesso
 * contenuto in parole sta già sull'elemento di partenza (aria-label).
 * `side`: di lato (a destra, a sinistra se a destra non c'è posto), centrato in altezza sul riquadro e tenuto dentro la
 * finestra: per gli elementi alti, come le barre della Velocità. Anche senza `side`, se non c'è posto né sotto né sopra
 * si apre di lato.
 */
export function FloatTip({ rect, tone, className = '', side = false, children }: { rect: DOMRect; tone: string; className?: string; side?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; arrow: number; at: 'below' | 'above' | 'right' | 'left' } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const fitsBelow = rect.bottom + GAP + height <= vh - EDGE;
    const fitsAbove = rect.top - GAP - height >= EDGE;
    if (side || (!fitsBelow && !fitsAbove)) {
      const right = rect.right + GAP + width <= vw - EDGE;
      const left = right ? rect.right + GAP : Math.max(EDGE, rect.left - GAP - width);
      const middle = rect.top + rect.height / 2;
      const top = Math.max(EDGE, Math.min(middle - height / 2, vh - height - EDGE));
      setPlace({ left, top, arrow: Math.max(14, Math.min(middle - top, height - 14)), at: right ? 'right' : 'left' });
      return;
    }
    const center = rect.left + rect.width / 2;
    const left = Math.max(EDGE, Math.min(center - width / 2, vw - width - EDGE));
    const above = !fitsBelow && fitsAbove;
    const top = above ? rect.top - GAP - height : rect.bottom + GAP;
    setPlace({ left, top, arrow: Math.max(14, Math.min(center - left, width - 14)), at: above ? 'above' : 'below' });
  }, [rect, side]);
  return createPortal(
    <div ref={ref} className={`ftip${place ? ` at-${place.at}` : ''} ${className}`} aria-hidden="true"
      style={{ '--tc': tone, left: place?.left ?? -9999, top: place?.top ?? 0, '--arrow': `${place?.arrow ?? 20}px`, visibility: place ? 'visible' : 'hidden' } as CSSProperties}>
      {children}
    </div>,
    document.body,
  );
}
