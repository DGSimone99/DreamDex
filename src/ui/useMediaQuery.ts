import { useEffect, useState } from 'react';

/**
 * Schermo da computer basso (portatili 1366×657, 1280×620): l'editor ha bisogno dello spazio del team. Dai 760 px di
 * altezza in su (es. 2K col ridimensionamento al 150%, 1707×780) team compatto ed editor stanno insieme: niente chiusura.
 */
export const SHORT_SCREEN = '(min-width: 1100px) and (max-height: 759px)';
/** Telefono: l'Analisi senza Panoramica (si apre sul Coaching, il voto del team nella barra delle schede). */
export const PHONE_QUERY = '(max-width: 599px)';
/** Editor a schede (Set, Statistiche, Sfida) sotto la testata a riepilogo: telefono e tablet. */
export const EDITOR_TABS_QUERY = '(max-width: 1099px)';
/** Telefono e tablet piccolo in verticale (fino a 767 px): il team si riduce da solo scorrendo e toccando una sezione si
 *  torna in cima col team ridotto (AutoBand). Più larghi resta il tasto per ridurlo a mano. */
/** Telefono e tablet piccolo in verticale (fino a 767 px): le tabelle dell'Analisi in colonna stretta (Generale con le
 *  barre una sopra l'altra, Coverage tipi e meta girate coi membri in colonna). */
export const NARROW_TABLES_QUERY = '(max-width: 767px)';
export const AUTO_BAND_QUERY = '(max-width: 767px)';
/** Tablet in orizzontale, e il computer a mezzo schermo (da 900 px col mouse, anche con la finestra più alta che larga):
 *  il team è una colonna a sinistra (come la squadra nei giochi), la sezione e l'editor a destra. */
export const TABLET_SIDE_QUERY = '(min-width: 760px) and (max-width: 1099px) and (orientation: landscape) and (min-height: 501px), (min-width: 900px) and (max-width: 1099px) and (pointer: fine)';

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
