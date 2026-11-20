import { useEffect, useLayoutEffect, useRef } from 'react';

/** Quante finestre sono aperte ora (una può aprirsi sopra l'altra: la pagina torna attiva solo quando si chiude l'ultima). */
let open = 0;

/** Durata della chiusura animata (blocks.css, .help-backdrop.closing): Eevee scende, poi la finestra si spegne. */
const CLOSING_MS = 520;

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Da mettere dentro una finestra modale (nel portal, fuori da #root):
 * - finché è montata la pagina sotto è inerte, quindi il Tab resta nella finestra e i lettori di schermo leggono solo
 *   quella, come una finestra nativa del browser;
 * - quando si chiude, una copia ferma della finestra resta un attimo sulla pagina e fa la chiusura animata (Eevee che
 *   scende, poi lo schermo che si spegne). La finestra vera è già chiusa: niente da cliccare, niente da leggere.
 */
export function ModalLock() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = document.getElementById('root');
    open += 1;
    root?.setAttribute('inert', '');
    // La pagina sotto non scorre (col dito lo scorrimento passava alla pagina dove la finestra non scorre)
    document.documentElement.classList.add('modal-open');
    return () => {
      open = Math.max(0, open - 1);
      if (open === 0) { root?.removeAttribute('inert'); document.documentElement.classList.remove('modal-open'); }
    };
  }, []);
  useLayoutEffect(() => {
    const backdrop = mark.current?.closest<HTMLElement>('.help-backdrop') ?? null;
    return () => {
      if (!backdrop || reducedMotion() || typeof document === 'undefined') return;
      // Le posizioni di scorrimento (la copia ripartirebbe dall'inizio): nello stesso ordine degli elementi
      const scrolled = [...backdrop.querySelectorAll<HTMLElement>('*')].map(el => el.scrollTop);
      const ghost = backdrop.cloneNode(true) as HTMLElement;
      ghost.classList.add('closing');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('inert', '');
      // Niente nella copia prende il fuoco (anche dove 'inert' non è conosciuto)
      ghost.querySelectorAll<HTMLElement>('a, button, input, select, textarea, summary, [tabindex]').forEach(el => el.setAttribute('tabindex', '-1'));
      // Senza nome: radio con lo stesso nome della finestra vera (riaperta subito) confonderebbero React e il browser
      ghost.querySelectorAll('input[name]').forEach(el => el.removeAttribute('name'));
      // La copia solo se la finestra è sparita davvero: React (in sviluppo) smonta e rimonta per prova appena aperta, e
      // lì la finestra resta sulla pagina; si controlla appena React ha finito di aggiornare la pagina
      queueMicrotask(() => {
        if (backdrop.isConnected) return;
        document.body.appendChild(ghost);
        [...ghost.querySelectorAll<HTMLElement>('*')].forEach((el, i) => { if (scrolled[i]) el.scrollTop = scrolled[i]; });
        // Via a fine animazione (quella dello sfondo è l'ultima); un timer di sicurezza se l'evento non arriva
        const remove = () => ghost.remove();
        ghost.addEventListener('animationend', e => { if (e.target === ghost) remove(); });
        window.setTimeout(remove, CLOSING_MS * 4);
      });
    };
  }, []);
  return <span ref={mark} hidden />;
}
