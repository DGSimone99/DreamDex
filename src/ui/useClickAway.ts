import { useEffect, useRef } from 'react';

/**
 * Un clic fuori chiude (menu, tendine, pannelli): finché `active`, a ogni pressione sulla pagina che non cade dentro
 * (`isInside`) chiama `onAway`. Usa sempre le versioni aggiornate delle due funzioni.
 * `event`: 'mousedown' dove la tendina deve chiudersi prima del clic di un pulsante sotto (i filtri).
 */
export function useClickAway(isInside: (target: Element) => boolean, onAway: () => void, { active = true, event = 'pointerdown' }: { active?: boolean; event?: 'pointerdown' | 'mousedown' } = {}) {
  const latest = useRef({ isInside, onAway });
  latest.current = { isInside, onAway };
  useEffect(() => {
    if (!active) return;
    const away = (e: Event) => { if (!latest.current.isInside(e.target as Element)) latest.current.onAway(); };
    document.addEventListener(event, away);
    return () => document.removeEventListener(event, away);
  }, [active, event]);
}
