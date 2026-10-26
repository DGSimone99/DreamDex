import { useLayoutEffect, useState } from 'react';

/**
 * Quante voci (gli elementi con `data-fit` dentro il contenitore) stanno intere nell'altezza del contenitore.
 * Prima si mostrano tutte e si misura; se non stanno tutte si lascia `reserve` posti per il "+N", mai meno di `min`.
 * Si rimisura quando cambia `key` (contenuto) o la misura del contenitore. Senza layout (test) stanno tutte.
 */
export function useFit<T extends HTMLElement>(key: string, count: number, { reserve = 0, min = 0 } = {}) {
  // Ref a funzione: il contenitore può comparire dopo (es. dal primo problema in poi)
  const [box, ref] = useState<T | null>(null);
  // fit null: da misurare (si mostrano tutte); round cambia a ogni nuova misura richiesta
  const [state, setState] = useState<{ fit: number | null; round: number; key: string }>({ fit: null, round: 0, key });
  if (state.key !== key) setState({ fit: null, round: state.round + 1, key });
  const { fit, round } = state;

  useLayoutEffect(() => {
    if (fit !== null || !box) return;
    const limit = box.clientHeight;
    let n = count;
    // Senza altezza (scheda nascosta, test) stanno tutte: si rimisura quando compare
    if (limit) {
      const top = box.getBoundingClientRect().top;
      n = 0;
      for (const item of box.querySelectorAll<HTMLElement>('[data-fit]')) {
        if (item.getBoundingClientRect().bottom - top > limit + 0.5) break;
        n++;
      }
      if (n < count) n = Math.max(min, n - reserve);
    }
    setState(s => (s.round === round ? { ...s, fit: n } : s));
  }, [box, fit, round, count, reserve, min]);

  // Il contenitore cambia misura (team ridotto, finestra, scheda che si apre): si rimisura
  useLayoutEffect(() => {
    if (!box || typeof ResizeObserver === 'undefined') return;
    let last = '';
    const observer = new ResizeObserver(() => {
      const size = `${box.clientWidth}x${box.clientHeight}`;
      if (size === last) return;
      last = size;
      setState(s => ({ ...s, fit: null, round: s.round + 1 }));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);

  return { ref, shown: fit ?? count };
}
