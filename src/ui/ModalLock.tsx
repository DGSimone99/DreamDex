import { useEffect } from 'react';

/** Quante finestre sono aperte ora (una può aprirsi sopra l'altra: la pagina torna attiva solo quando si chiude l'ultima). */
let open = 0;

/**
 * Da mettere dentro una finestra modale (nel portal, fuori da #root): finché è montata la pagina sotto è inerte, quindi
 * il Tab resta nella finestra e i lettori di schermo leggono solo quella, come una finestra nativa del browser.
 */
export function ModalLock() {
  useEffect(() => {
    const root = document.getElementById('root');
    open += 1;
    root?.setAttribute('inert', '');
    return () => {
      open = Math.max(0, open - 1);
      if (open === 0) root?.removeAttribute('inert');
    };
  }, []);
  return null;
}
