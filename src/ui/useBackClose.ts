import { useEffect, useRef } from 'react';
import { mediaMatches } from './useMediaQuery';

/** Telefono e tablet: la scheda del candidato si apre toccando la carta (a tutto schermo sul telefono, da destra sul tablet). */
export const DETAIL_SHEET = '(max-width: 1099px)';
/** Telefono e tablet: l'editor del membro copre tutto lo schermo. */
export const SMALL = '(max-width: 1099px)';


/**
 * Una pagina a tutto schermo (scheda del candidato, editor del membro) si chiude anche col tasto o il gesto
 * "indietro" del telefono: aprendola si aggiunge un passo alla cronologia, tornare indietro la chiude.
 * Solo quando `query` vale (sul PC la pagina non copre niente e la cronologia resta com'è).
 * Restituisce la funzione per chiuderla da un pulsante: torna indietro di un passo, se l'aveva aggiunto.
 */
export function useBackClose(open: boolean, close: () => void, query: string): () => void {
  const pushed = useRef(false);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open || !mediaMatches(query)) return;
    history.pushState({ ...(history.state ?? {}), dreamdexSheet: true }, '');
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Chiusa in un altro modo (azione, Esc): il passo aggiunto si toglie, così "indietro" non trova una pagina vuota
      if (pushed.current) {
        pushed.current = false;
        history.back();
      }
    };
  }, [open, query]);
  return () => {
    if (pushed.current) history.back();
    else close();
  };
}
