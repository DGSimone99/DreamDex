import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Il contenuto sborda dal contenitore (in larghezza o in altezza); a 0×0 (scheda nascosta, jsdom) no. */
const overflows = (el: HTMLElement, onlyX = false) => el.scrollWidth > el.clientWidth + 1 || (!onlyX && el.scrollHeight > el.clientHeight + 1);

/**
 * Quanti dei `total` elementi stanno in `ref` senza sbordare: si parte da tutti e, prima del disegno, se ne toglie uno
 * alla volta finché il contenuto (col "+N" che chi chiama mostra al posto dei tolti) sta dentro.
 * Si rimisura da capo quando cambia `key` (gli elementi, la lingua), quando cambia la misura di `watch` (o di `ref`)
 * e quando arrivano i caratteri. `watch`: un contenitore la cui misura non dipende dagli elementi mostrati
 * (se `ref` si stringe col contenuto, osservarlo farebbe ripartire la misura all'infinito).
 * `onlyX`: conta solo la larghezza (una fila con menu che si aprono sotto, che non sono contenuto che sborda).
 * `test`: al posto di "ref sborda", un controllo proprio (es. "una delle carte dentro ref sborda").
 */
export function useFitCount(ref: RefObject<HTMLElement | null>, total: number, key: string, watch?: RefObject<HTMLElement | null>, onlyX = false, test?: (el: HTMLElement) => boolean): number {
  // v conta le ripartenze: un passo misurato prima di una ripartenza non la cancella
  const [fit, setFit] = useState({ key, n: total, v: 0 });
  const n = fit.key === key ? Math.min(fit.n, total) : total;
  if (fit.key !== key) setFit(f => ({ key, n: total, v: f.v + 1 }));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || n === 0 || fit.key !== key || !(test ? test(el) : overflows(el, onlyX))) return;
    setFit(f => (f.v === fit.v ? { ...f, n: n - 1 } : f));
  });

  // Misura nuova: si riparte da tutti (solo se la misura cambia davvero, e mai a 0×0). Un oggetto nuovo
  // anche se si era già a "tutti": così la misura si rifà (la carta si è stretta e ora sborda)
  const last = useRef('');
  const restart = () => setFit(f => ({ key: f.key, n: Number.MAX_SAFE_INTEGER, v: f.v + 1 }));
  useEffect(() => {
    const el = watch?.current ?? ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!el.clientWidth || !el.clientHeight) return;
      const size = `${el.clientWidth}x${el.clientHeight}`;
      if (size === last.current) return;
      last.current = size;
      restart();
    });
    observer.observe(el);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) restart(); });
    return () => { alive = false; observer.disconnect(); };
    // Senza elementi il contenitore può non esserci: si riprova quando ne arrivano
  }, [ref, watch, total > 0]);

  return n;
}
