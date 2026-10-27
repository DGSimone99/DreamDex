import { useLayoutEffect, useState } from 'react';

/** Basso dell'elemento rispetto all'alto del contenitore. */
const bottomIn = (item: Element, top: number) => item.getBoundingClientRect().bottom - top;

/**
 * Quante voci (gli elementi con `data-fit` dentro il contenitore) stanno intere nell'altezza del contenitore.
 * Prima si mostrano tutte e si misura. Se non stanno tutte e c'è un "+N" (`more`, l'elemento con `data-fit-more`),
 * si mostra il "+N" e si toglie una voce alla volta finché anche lui sta: se sta sulla stessa riga, non si perde niente.
 * Mai meno di `min`. Si rimisura quando cambia `key` (contenuto) o la misura del contenitore. Senza layout (test) stanno tutte.
 * `outer`: un antenato (selettore) da guardare anche lui, per un contenitore alto quanto il suo contenuto: dopo un
 * taglio non cresce da solo quando lo spazio intorno aumenta.
 */
export function useFit<T extends HTMLElement>(key: string, count: number, { more = false, min = 0, outer }: { more?: boolean; min?: number; outer?: string } = {}) {
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
      // Un "+N" già presente (tetto fisso, es. 6 debolezze) che non sta: si controlla anche se le voci stanno tutte
      const moreOver = more && [...box.querySelectorAll('[data-fit-more]')].some(item => bottomIn(item, top) > limit + 0.5);
      const cut = n < count;
      setState(s => (s.round === round ? { ...s, fit: cut ? Math.max(min, n) : n, check: (cut || moreOver) && more } : s));
      return;
    }
    // Controllo: se una voce mostrata o il "+N" esce, una voce in meno
    const over = fit > min && [...box.querySelectorAll('[data-fit], [data-fit-more]')].some(item => bottomIn(item, top) > limit + 0.5);
    setState(s => (s.round === round ? (over ? { ...s, fit: fit - 1 } : { ...s, check: false }) : s));
  }, [box, fit, check, round, count, more, min]);

  // Il contenitore cambia misura (team ridotto, finestra, scheda che si apre).
  // Se cresce si rimisura da capo (mostrando tutto). Se solo si stringe si controllano le voci già mostrate:
  // un contenitore alto quanto il suo contenuto si stringe proprio perché si è tagliato, e rimisurare da capo
  // lo farebbe ricrescere e ritagliare all'infinito.
  useLayoutEffect(() => {
    if (!box || typeof ResizeObserver === 'undefined') return;
    const watched = [box, ...(outer ? [box.closest(outer)].filter((x): x is Element => !!x) : [])];
    let last: number[] | null = null;
    const observer = new ResizeObserver(() => {
      const size = watched.flatMap(el => [el.clientWidth, el.clientHeight]);
      // Scheda nascosta (0×0): si tiene l'ultima misura e si rimisura quando ricompare
      if (!box.clientWidth && !box.clientHeight) {
        last = null;
        return;
      }
      const prev = last;
      last = size;
      if (prev && size.every((v, i) => v === prev[i])) return;
      if (prev && size.every((v, i) => v <= prev[i])) setState(s => (s.fit === null ? s : { ...s, check: true }));
      else setState(s => ({ ...s, fit: null, check: false, round: s.round + 1 }));
    });
    for (const el of watched) observer.observe(el);
    return () => observer.disconnect();
  }, [box, outer]);

  // measured: la misura è finita (si può aggiungere altro, come i dettagli, solo dopo)
  return { ref, box, shown: fit ?? count, measured: fit !== null && !check, round };
}
