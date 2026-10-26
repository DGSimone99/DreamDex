import { useLayoutEffect, useState } from 'react';

/** Basso dell'elemento rispetto all'alto del contenitore. */
const bottomIn = (item: Element, top: number) => item.getBoundingClientRect().bottom - top;

/**
 * Quante voci (gli elementi con `data-fit` dentro il contenitore) stanno intere nell'altezza del contenitore.
 * Prima si mostrano tutte e si misura. Se non stanno tutte e c'è un "+N" (`more`, l'elemento con `data-fit-more`),
 * si mostra il "+N" e si toglie una voce alla volta finché anche lui sta: se sta sulla stessa riga, non si perde niente.
 * Mai meno di `min`. Si rimisura quando cambia `key` (contenuto) o la misura del contenitore. Senza layout (test) stanno tutte.
 */
export function useFit<T extends HTMLElement>(key: string, count: number, { more = false, min = 0 } = {}) {
  // Ref a funzione: il contenitore può comparire dopo (es. dal primo problema in poi)
  const [box, ref] = useState<T | null>(null);
  // fit null: da misurare (si mostrano tutte); check: si controlla che il "+N" stia; round cambia a ogni nuova misura
  const [state, setState] = useState<{ fit: number | null; check: boolean; round: number; key: string }>({ fit: null, check: false, round: 0, key });
  if (state.key !== key) setState({ fit: null, check: false, round: state.round + 1, key });
  const { fit, check, round } = state;

  useLayoutEffect(() => {
    if (!box || (fit !== null && !check)) return;
    // Tutto da getBoundingClientRect: con lo zoom di html (schermi 2K/4K) clientHeight è in un'altra scala
    const { top, height: limit } = box.getBoundingClientRect();
    // Senza altezza (scheda nascosta, test) stanno tutte: si rimisura quando compare
    if (!limit) {
      setState(s => (s.round === round ? { ...s, fit: count, check: false } : s));
      return;
    }
    if (fit === null) {
      let n = 0;
      for (const item of box.querySelectorAll<HTMLElement>('[data-fit]')) {
        if (bottomIn(item, top) > limit + 0.5) break;
        n++;
      }
      const cut = n < count;
      setState(s => (s.round === round ? { ...s, fit: cut ? Math.max(min, n) : n, check: cut && more } : s));
      return;
    }
    // Il "+N" è comparso: se non sta, una voce in meno
    const plus = box.querySelector('[data-fit-more]');
    const over = plus && bottomIn(plus, top) > limit + 0.5 && fit > min;
    setState(s => (s.round === round ? (over ? { ...s, fit: fit - 1 } : { ...s, check: false }) : s));
  }, [box, fit, check, round, count, more, min]);

  // Il contenitore cambia misura (team ridotto, finestra, scheda che si apre): si rimisura
  useLayoutEffect(() => {
    if (!box || typeof ResizeObserver === 'undefined') return;
    let last = '';
    const observer = new ResizeObserver(() => {
      // Scheda nascosta (0×0): si tiene l'ultima misura e si rimisura quando ricompare
      if (!box.clientWidth && !box.clientHeight) {
        last = '';
        return;
      }
      const size = `${box.clientWidth}x${box.clientHeight}`;
      if (size === last) return;
      last = size;
      setState(s => ({ ...s, fit: null, check: false, round: s.round + 1 }));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);

  // measured: la misura è finita (si può aggiungere altro, come i dettagli, solo dopo)
  return { ref, box, shown: fit ?? count, measured: fit !== null && !check, round };
}

/**
 * Quante righe in più (`data-fit-sub`, es. i dettagli sotto un gruppo) si possono mostrare: si parte da `max` e se
 * qualcosa esce dal contenitore se ne toglie una alla volta. Si riparte da `max` quando cambia `key`.
 */
export function useShrink(box: HTMLElement | null, key: string, max: number) {
  const [state, setState] = useState({ key, n: max });
  if (state.key !== key) setState({ key, n: max });
  const n = state.key === key ? state.n : max;

  // Senza dipendenze di proposito: si ricontrolla dopo ogni render (il contenuto cambia senza che cambi il contenitore);
  // si ferma da sé quando niente esce o non resta niente da togliere
  useLayoutEffect(() => {
    if (!box || n <= 0) return;
    const { top, height: limit } = box.getBoundingClientRect();
    if (!limit) return;
    const over = [...box.querySelectorAll('[data-fit], [data-fit-sub]')].some(item => bottomIn(item, top) > limit + 0.5);
    if (over) setState(s => (s.key === key ? { ...s, n: s.n - 1 } : s));
  });

  return n;
}
