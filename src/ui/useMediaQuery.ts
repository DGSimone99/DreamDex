import { useEffect, useState } from 'react';

/**
 * Schermo da computer basso (portatili 1366×657, 1280×620): l'editor ha bisogno dello spazio del team. Dai 760 px di
 * altezza in su (es. 2K col ridimensionamento al 150%, 1707×780) team compatto ed editor stanno insieme: niente chiusura.
 */
export const SHORT_SCREEN = '(min-width: 1100px) and (max-height: 759px)';

const matches = (query: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

/** Vero finché la finestra corrisponde alla media query; si aggiorna quando la finestra cambia misura. */
export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const change = () => setValue(list.matches);
    change();
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, [query]);
  return value;
}
