import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { supportsPopover } from './useAnchoredPop';

/** Quanto aspetta prima di aprirsi: passando col mouse sopra la griglia non si accende a ogni casella. */
const OPEN_DELAY = 140;
/** Distanza dal riquadro di partenza e margine minimo dai bordi della finestra. */
const GAP = 9;
const EDGE = 8;

/** L'ultimo gesto: un tasto o il puntatore (per chi non sa dire :focus-visible, come jsdom). */
let lastInput: 'key' | 'pointer' = 'key';
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { lastInput = 'key'; }, true);
  window.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);
}

/** Fuoco da tastiera (non dal clic): :focus-visible, o l'ultimo gesto è stato un tasto. */
export const keyboardFocus = (el: Element): boolean => {
  try { if (el.matches(':focus-visible')) return true; } catch { /* selettore sconosciuto: decide l'ultimo gesto */ }
  return lastInput === 'key';
};

/**
 * Quanto resta aperto il tooltip dopo che il mouse ha lasciato la casella o il tooltip: il tempo di attraversare lo
 * spazio tra i due (WCAG 1.4.13, il tooltip si può raggiungere col mouse).
 */
export const LEAVE_GRACE = 160;

/** Il legame tra un tooltip aperto e chi l'ha aperto: il tooltip dice quando il mouse ci entra e ne esce. */
interface TipLink { attach: (tip: HTMLElement) => () => void }
/** Ogni riquadro aperto da useFloatAnchor porta al suo legame: FloatTip lo trova dal `rect` che riceve. */
const links = new WeakMap<DOMRect, TipLink>();

/** La stessa chiave (anche un oggetto nuovo con gli stessi valori, es. `{ slot, type }` rifatto a ogni passaggio). */
const sameKey = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

/** Un'uscita del mouse (dalla casella): chiude dopo LEAVE_GRACE, non subito. */
const isLeave = (e: unknown): boolean => {
  const type = (e as { type?: unknown } | null)?.type;
  return type === 'mouseleave' || type === 'pointerleave' || type === 'mouseout' || type === 'pointerout';
};

/**
 * Il punto di partenza del tooltip: chi lo apre passa il suo riquadro e una chiave (quale casella). `open` dopo un
 * attimo (`delay`, 140 ms; più lungo dove il mouse passa spesso, come le carte del team). Un solo stato per tutta una
 * griglia: ogni casella chiama `open` con la sua chiave.
 * Il tooltip si può raggiungere col mouse (WCAG 1.4.13): resta aperto finché il mouse sta sulla casella o sul tooltip, e
 * si chiude LEAVE_GRACE dopo che li ha lasciati tutti e due. `leave` (o `close` con l'evento di uscita del mouse, es.
 * `onMouseLeave={close}`) è questa uscita con l'attesa; `close()` senza evento, il fuoco che esce, Esc, scorrere e
 * ridimensionare chiudono subito. Passando da una casella alla vicina il tooltip passa all'altra (resta il vecchio finché
 * il nuovo si apre, o si chiude se il mouse non si ferma).
 * `focus(key)`: i gestori del fuoco per l'elemento (si apre col fuoco da tastiera, si chiude uscendo; Esc lo chiude);
 * `bind(key)`: mouse e fuoco insieme, per chi non ha altro da fare all'entrata del mouse.
 */
export function useFloatAnchor<K>(delay = OPEN_DELAY) {
  const [anchor, setAnchor] = useState<{ key: K; rect: DOMRect } | null>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  /** L'ultimo elemento chiesto (anche se non ancora aperto): Esc lo ferma. */
  const source = useRef<Element | null>(null);
  /** L'elemento del tooltip aperto: se sparisce dalla pagina (la lista cambia sotto il mouse) il tooltip si chiude. */
  const shown = useRef<Element | null>(null);
  /** Il tooltip aperto (se si lascia raggiungere col mouse) e l'ultimo elemento sotto il mouse. */
  const tipEl = useRef<HTMLElement | null>(null);
  const pointer = useRef<EventTarget | null>(null);
  const shownKey = useRef<K | undefined>(undefined);
  const stopClose = () => { window.clearTimeout(closeTimer.current); closeTimer.current = undefined; };
  const close = useCallback((e?: unknown) => {
    if (isLeave(e)) { leaveRef.current(); return; }
    window.clearTimeout(openTimer.current);
    stopClose();
    source.current = null; shown.current = null; shownKey.current = undefined;
    setAnchor(null);
  }, []);
  /** Il mouse ha lasciato la casella o il tooltip: se non è sull'altro dei due entro LEAVE_GRACE, si chiude. */
  const awayCheck = () => {
    closeTimer.current = undefined;
    const at = pointer.current;
    if (at instanceof Node && (shown.current?.contains(at) || tipEl.current?.contains(at))) return;
    close();
  };
  const leave = () => {
    window.clearTimeout(openTimer.current);
    // Niente di aperto, un tooltip che non si raggiunge (il fumetto piccolo) o col dito (il foglio dal basso lo chiude
    // TouchTips): si chiude subito, come prima
    if (!shown.current || !tipEl.current || document.documentElement.classList.contains('touch-tips')) { close(); return; }
    if (closeTimer.current === undefined) closeTimer.current = window.setTimeout(awayCheck, LEAVE_GRACE);
  };
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  const stableLeave = useCallback(() => leaveRef.current(), []);
  const open = useCallback((key: K, el: Element) => {
    window.clearTimeout(openTimer.current);
    source.current = el;
    // Di nuovo sulla casella del tooltip aperto, con la stessa chiave (tornando dal tooltip): resta com'è
    if (shown.current === el && sameKey(shownKey.current, key)) { stopClose(); return; }
    const rect = el.getBoundingClientRect();
    openTimer.current = window.setTimeout(() => {
      if (!el.isConnected) return;
      stopClose();
      shown.current = el;
      shownKey.current = key;
      pointer.current = null;
      const link: TipLink = {
        attach: tip => {
          tipEl.current = tip;
          // Il mouse entra nel tooltip: niente chiusura e niente altra casella in arrivo (attraversata per raggiungerlo)
          const enter = () => { window.clearTimeout(openTimer.current); stopClose(); source.current = shown.current; };
          const out = () => leaveRef.current();
          tip.addEventListener('mouseenter', enter);
          tip.addEventListener('mouseleave', out);
          return () => {
            tip.removeEventListener('mouseenter', enter);
            tip.removeEventListener('mouseleave', out);
            if (tipEl.current === tip) tipEl.current = null;
          };
        },
      };
      links.set(rect, link);
      setAnchor({ key, rect });
    }, delay);
  }, [delay]);
  useEffect(() => () => { window.clearTimeout(openTimer.current); window.clearTimeout(closeTimer.current); }, []);
  // Esc anche prima che si apra (il fuoco è appena arrivato): niente tooltip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && (source.current || shown.current)) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  // Scorrere o ridimensionare sposterebbe la casella sotto il tooltip: si chiude. Se la casella esce dalla pagina
  // mentre il mouse ci sta sopra, il browser non manda l'uscita del mouse: si controlla a ogni cambio della pagina
  // e a ogni movimento del mouse (che dice anche dov'è il mouse, per la chiusura con l'attesa).
  useEffect(() => {
    if (!anchor) return;
    const check = () => { if (!shown.current?.isConnected) close(); };
    const move = (e: Event) => { pointer.current = e.target; check(); };
    const now = () => close();
    const watch = new MutationObserver(check);
    watch.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', now, true);
    window.addEventListener('resize', now);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('mouseover', move, true);
    return () => {
      watch.disconnect();
      window.removeEventListener('scroll', now, true); window.removeEventListener('resize', now);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('mouseover', move, true);
    };
  }, [anchor, close]);
  const focus = useCallback((key: K) => ({
    onFocus: (e: FocusEvent<Element>) => { if (keyboardFocus(e.currentTarget)) open(key, e.currentTarget); },
    onBlur: () => close(),
  }), [open, close]);
  const bind = useCallback((key: K) => ({
    onMouseEnter: (e: { currentTarget: Element }) => open(key, e.currentTarget),
    onMouseLeave: stableLeave,
    ...focus(key),
  }), [open, stableLeave, focus]);
  return { anchor, open, close, leave: stableLeave, focus, bind };
}

/**
 * Il tooltip DreamDex: un pannello nel body (posizione fissa, mai tagliato dai contenitori), sotto il riquadro di
 * partenza o sopra se sotto non c'è posto, tenuto dentro la finestra; la punta indica il centro del riquadro.
 * `tone`: il colore dell'alone e della testata (es. il colore del tipo). Solo visivo (aria-hidden): lo stesso
 * contenuto in parole sta già sull'elemento di partenza (aria-label).
 * `side`: di lato (a destra, a sinistra se a destra non c'è posto; con `'left'` prima a sinistra), centrato in altezza sul riquadro e tenuto dentro la
 * finestra: per gli elementi alti, come le barre della Velocità. Anche senza `side`, se non c'è posto né sotto né sopra
 * si apre di lato.
 */
export function FloatTip({ rect, tone, className = '', side = false, layer = false, children }: { rect: DOMRect; tone: string; className?: string; side?: boolean | 'left'; layer?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // `layer`: nello strato in cima alla pagina (popover), per i tooltip che partono da dentro una tendina o una scheda già lì
  const top = layer && supportsPopover;
  useLayoutEffect(() => {
    const el = ref.current;
    if (top && el && !el.matches(':popover-open')) el.showPopover();
  }, [top]);
  const [place, setPlace] = useState<{ left: number; top: number; arrow: number; at: 'below' | 'above' | 'right' | 'left' } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const fitsBelow = rect.bottom + GAP + height <= vh - EDGE;
    const fitsAbove = rect.top - GAP - height >= EDGE;
    if (side || (!fitsBelow && !fitsAbove)) {
      const fitsRight = rect.right + GAP + width <= vw - EDGE;
      const fitsLeft = rect.left - GAP - width >= EDGE;
      // Il lato preferito se c'è posto, altrimenti l'altro
      const right = side === 'left' ? !fitsLeft && fitsRight : fitsRight;
      const left = right ? rect.right + GAP : Math.max(EDGE, rect.left - GAP - width);
      const middle = rect.top + rect.height / 2;
      const top = Math.max(EDGE, Math.min(middle - height / 2, vh - height - EDGE));
      setPlace({ left, top, arrow: Math.max(14, Math.min(middle - top, height - 14)), at: right ? 'right' : 'left' });
      return;
    }
    const center = rect.left + rect.width / 2;
    const left = Math.max(EDGE, Math.min(center - width / 2, vw - width - EDGE));
    const above = !fitsBelow && fitsAbove;
    const top = above ? rect.top - GAP - height : rect.bottom + GAP;
    setPlace({ left, top, arrow: Math.max(14, Math.min(center - left, width - 14)), at: above ? 'above' : 'below' });
  }, [rect, side]);
  // Raggiungibile col mouse (WCAG 1.4.13): chi l'ha aperto con useFloatAnchor sa quando il mouse entra e esce dal
  // tooltip (la punta compresa). Il fumetto piccolo (`hint`) no: si chiude uscendo dalla casella.
  const hoverable = !/\bhint\b/.test(className);
  useEffect(() => {
    const el = ref.current;
    const link = links.get(rect);
    if (!el || !link || !hoverable) return undefined;
    return link.attach(el);
  }, [rect, hoverable]);
  // Il tooltip non si clicca: un clic dentro non arriva alla casella né a chi sta sotto nell'albero di React (il
  // tooltip è spesso figlio della casella), non chiude le tendine e non sposta il fuoco (la casella resta col suo tooltip)
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return createPortal(
    <div ref={ref} className={`ftip${place ? ` at-${place.at}` : ''} ${className}`} aria-hidden="true" popover={top ? 'manual' : undefined}
      onClick={stop} onPointerDown={stop} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }} onPointerUp={stop} onMouseUp={stop}
      style={{ '--tc': tone, left: place?.left ?? -9999, top: place?.top ?? 0, '--arrow': `${place?.arrow ?? 20}px`, visibility: place ? 'visible' : 'hidden' } as CSSProperties}>
      {children}
    </div>,
    document.body,
  );
}

/**
 * Il testo della descrizione per lo screen reader (aria-describedby) di un elemento piccolo, come un pezzo della barra:
 * nascosto e fuori dall'elemento (nel body), così non entra nel suo testo né nella casella che lo contiene.
 */
export function HiddenText({ id, children }: { id: string; children: ReactNode }) {
  return createPortal(<span id={id} hidden>{children}</span>, document.body);
}

/**
 * Il piede dei tooltip il cui elemento porta da qualche parte col clic: una riga Accent Ink sotto un filo, "Clic: vai a
 * {place}" e la freccia. Solo un'indicazione (il tooltip non si clicca): il clic resta sull'elemento. Il modello comune per
 * ogni tooltip che naviga (un'altra scheda, sottoscheda o vista: Coaching, Coverage tipi/meta, Offesa, Difesa, Ruoli...);
 * `place` è il nome della destinazione come lo mostra l'interfaccia (es. "Coverage meta"). `verb="open"`: il clic apre
 * una finestra invece di cambiare scheda ("Clic: apri i rivali"). Il piede è solo visivo: le stesse parole stanno nella
 * descrizione dell'elemento (goText, con HiddenText e aria-describedby) o già nel suo nome.
 */
export function TipGo({ place, verb = 'go' }: { place: string; verb?: 'go' | 'open' }) {
  const t = useT();
  return <p className="ftip-go">{goText(t, place, verb)}<Icon name="next" /></p>;
}

/** Le parole del piede di TipGo ("Clic: vai a Coverage meta"), per la descrizione dell'elemento ai lettori di schermo. */
export const goText = (t: ReturnType<typeof useT>, place: string, verb: 'go' | 'open' = 'go') =>
  t(verb === 'open' ? 'tip.open' : 'tip.go', { place });
