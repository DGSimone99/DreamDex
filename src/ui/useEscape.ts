import { useEffect, useRef } from 'react';

/**
 * Esc chiude: ascolta il tasto su tutta la pagina finché `active` (una finestra o una scheda aperta). Chiama sempre la
 * versione aggiornata di `onEscape`, così chi lo usa non deve tenerla stabile.
 * `stop`: il tasto non arriva oltre (una finestra dentro l'editor: Esc chiuderebbe anche quello); `prevent`: niente
 * effetto del browser.
 */
export function useEscape(onEscape: () => void, { active = true, stop = false, prevent = false }: { active?: boolean; stop?: boolean; prevent?: boolean } = {}) {
  const latest = useRef(onEscape);
  latest.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (stop) e.stopPropagation();
      if (prevent) e.preventDefault();
      latest.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, stop, prevent]);
}
