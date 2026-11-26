import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Lift } from './slotTypes';

/**
 * La carta del team che segue il mouse trascinando (al posto della copia sfumata del browser): la stessa carta del
 * team, piena, appena inclinata e con l'ombra. Sta nel body (sopra a tutto, mai tagliata) dentro i contenitori del team
 * (band, team, slots: senza scatola, per gli stili); il mouse si legge da "dragover", che arriva ovunque nella pagina.
 */
export function SlotGhost({ at, children }: { at: Lift; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = (x: number, y: number) => { el.style.translate = `${x - at.dx}px ${y - at.dy}px`; };
    place(at.x, at.y);
    const move = (e: DragEvent) => { if (e.clientX || e.clientY) place(e.clientX, e.clientY); };
    document.addEventListener('dragover', move, true);
    return () => document.removeEventListener('dragover', move, true);
  }, [at]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={ref} className="slot-ghost" aria-hidden="true" style={{ width: at.w, height: at.h, transformOrigin: `${at.dx}px ${at.dy}px` }}>
      <div className={`band${at.collapsed ? ' collapsed' : ''}`}><section className={`team${at.collapsed ? ' collapsed' : ''}`}><div className="slots">{children}</div></section></div>
    </div>,
    document.body,
  );
}
