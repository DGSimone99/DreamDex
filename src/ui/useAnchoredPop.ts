import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Il browser sa mettere un elemento nello strato in cima a tutto (popover): niente z-index né contenitori che lo tagliano. */
export const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

/** Spazio dal bordo della finestra e dal campo. */
const EDGE = 8;
const GAP = 4;

/** Telefono: le tendine diventano fogli che salgono dal fondo dello schermo, larghi quanto lo schermo. */
export const SHEET_QUERY = '(max-width: 599px)';
/** Tendine e menu come fogli dal basso: telefono e tablet in verticale col dito (in orizzontale, e col mouse, restano a tendina). */
export const PICK_SHEET_QUERY = '(max-width: 599px), (max-width: 1099px) and (orientation: portrait) and (pointer: coarse)';
export const isSheetScreen = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PICK_SHEET_QUERY).matches;
/** Larghezza massima di un foglio: sul tablet una colonna comoda al centro, non tutto lo schermo. */
const SHEET_MAX_W = 600;

interface Options {
  /** Larghezza minima (il menu resta largo quanto il campo, o di più se il campo è stretto). */
  minWidth?: number;
  /** Larghezza fissa al posto di quella del campo (es. il menu Set, più largo del suo pulsante); 'content': quella del contenuto. */
  width?: number | 'content';
  /** Da che lato allinearsi al campo quando il menu è più largo: inizio (sinistra) o fine (destra). */
  align?: 'start' | 'end';
  /** Lato preferito: sotto, se non ci sta e sopra c'è più posto si apre sopra (e viceversa). */
  prefer?: 'below' | 'above';
  /** Distanza dal campo (0: la tendina continua il campo, senza stacco). */
  gap?: number;
  /** Quanto la tendina entra nel campo, in frazione della sua altezza (0.5: arriva a metà, alle punte del rombo). */
  overlap?: number;
  /** Quanto la tendina sborda dal campo a destra e a sinistra (es. 2px per allinearsi all'anello di selezione). */
  bleed?: number;
  /** Avvisa da che lato si è aperta (sotto o sopra), ogni volta che cambia. */
  onSide?: (side: 'below' | 'above') => void;
  /** Sul telefono (e sul tablet in verticale) diventa un foglio dal basso (con lo sfondo scuro dietro: toccarlo chiude,
   *  vedi onDismiss); 'always': foglio a ogni misura in cui è aperto (es. le Impostazioni di Completa team su telefono e tablet). */
  sheet?: boolean | 'always';
  /** Tocco sullo sfondo scuro dietro il foglio: va chiuso. */
  onDismiss?: () => void;
}

/**
 * Tendina attaccata al suo campo: sta nello strato in cima alla pagina (non la copre nulla, non allunga i pannelli e non
 * fa comparire barre di scorrimento), si apre dove c'è posto (sotto o sopra), larga quanto il campo, e non esce mai
 * dalla finestra: se manca posto si accorcia e scorre dentro. Segue il campo quando la pagina scorre o cambia misura.
 * L'elemento deve avere `popover="manual"` (vedi `supportsPopover`); senza, si posiziona comunque fisso.
 */
export function useAnchoredPop(anchor: RefObject<HTMLElement | null>, pop: RefObject<HTMLElement | null>, open: boolean, options: Options = {}): void {
  const { minWidth = 0, width, align = 'start', prefer = 'below', gap: baseGap = GAP, bleed = 0, overlap = 0 } = options;
  const onSide = useRef(options.onSide);
  onSide.current = options.onSide;
  const onDismiss = useRef(options.onDismiss);
  onDismiss.current = options.onDismiss;
  const sheet = options.sheet ?? false;
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    if (supportsPopover && el.hasAttribute('popover') && !el.matches(':popover-open')) el.showPopover();
    if (sheet === 'always' || (sheet && isSheetScreen())) return openSheet(el, () => onDismiss.current?.());
    // L'altezza massima del CSS (es. 340px): la tendina non supera mai quella, anche con tanto spazio
    el.style.maxHeight = '';
    const cssMax = parseFloat(getComputedStyle(el).maxHeight) || Infinity;
    const place = () => {
      const a = anchor.current;
      if (!a || !el.isConnected) return;
      const box = a.getBoundingClientRect();
      const r = { left: box.left - bleed, right: box.right + bleed, width: box.width + 2 * bleed, top: box.top, bottom: box.bottom };
      const gap = baseGap - overlap * box.height;
      // L'altezza del campo, per le forme che lo abbracciano (es. la tacca a rombo della Natura)
      el.style.setProperty('--anchor-h', `${box.height}px`);
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      if (width === 'content') el.style.width = '';
      const own = width === 'content' ? Math.max(el.offsetWidth, minWidth) : width;
      const w = Math.min(own ?? Math.max(r.width, minWidth), vw - 2 * EDGE);
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(EDGE, Math.min(left, vw - EDGE - w));
      const below = vh - r.bottom - gap - EDGE;
      const above = r.top - gap - EDGE;
      // Quanto sarebbe alta senza limiti di spazio
      el.style.maxHeight = `${cssMax === Infinity ? vh : cssMax}px`;
      const natural = Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), cssMax);
      const down = prefer === 'below' ? below >= natural || below >= above : !(above >= natural || above >= below);
      const room = Math.max(80, down ? below : above);
      el.style.position = 'fixed';
      el.style.margin = '0';
      el.style.inset = 'auto';
      el.style.left = `${Math.round(left)}px`;
      el.style.width = `${Math.round(w)}px`;
      el.style.maxHeight = `${Math.floor(Math.min(cssMax, room))}px`;
      if (down) el.style.top = `${Math.round(r.bottom + gap)}px`;
      else el.style.bottom = `${Math.round(vh - r.top + gap)}px`;
      const side = down ? 'below' : 'above';
      if (el.dataset.side !== side) {
        el.dataset.side = side;
        // Anche il campo sa da che lato è aperta la sua tendina (es. il rombo della Natura cambia forma da quel lato)
        a.dataset.popSide = side;
        onSide.current?.(side);
      }
    };
    place();
    // Il campo può spostarsi senza scorrimento né cambi di misura (animazioni dell'editor, contenuti che arrivano dopo):
    // a ogni fotogramma si guarda dov'è, e se si è mosso la tendina lo segue
    let last = '';
    let frame = 0;
    const follow = () => {
      const a = anchor.current;
      if (a) {
        const r = a.getBoundingClientRect();
        const key = `${r.left},${r.top},${r.width},${r.height}`;
        if (key !== last) { if (last) place(); last = key; }
      }
      frame = requestAnimationFrame(follow);
    };
    if (typeof requestAnimationFrame !== 'undefined') frame = requestAnimationFrame(follow);
    // Lo scorrimento della tendina stessa non la sposta
    const onScroll = (e: Event) => { if (!(e.target instanceof Node && el.contains(e.target))) place(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (anchor.current) watch?.observe(anchor.current);
    // Il contenuto cambia (ricerca, linguette): si ricalcola il lato
    const content = typeof MutationObserver !== 'undefined' ? new MutationObserver(place) : null;
    content?.observe(el, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      watch?.disconnect();
      content?.disconnect();
      delete el.dataset.side;
      if (anchor.current) delete anchor.current.dataset.popSide;
      if (supportsPopover && el.isConnected && el.matches(':popover-open')) el.hidePopover();
    };
  }, [open, anchor, pop, minWidth, width, align, prefer, baseGap, bleed, overlap, sheet]);
}

/**
 * Il foglio dal basso del telefono: largo quanto lo schermo, appoggiato sopra la tastiera quando c'è (la parte visibile
 * della pagina, visualViewport), alto al massimo tre quarti di quello che si vede. Lo sfondo scuro lo disegna il foglio
 * (un'ombra grande quanto lo schermo); un tocco fuori da ogni foglio lo chiude e non arriva a quello che c'è sotto.
 */
function openSheet(el: HTMLElement, dismiss: () => void): () => void {
  el.dataset.sheet = '';
  const vv = window.visualViewport;
  const place = () => {
    const visible = vv ? vv.height : window.innerHeight;
    const keyboard = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    el.style.position = 'fixed';
    const w = Math.min(window.innerWidth, SHEET_MAX_W);
    el.style.inset = `auto auto auto ${Math.round((window.innerWidth - w) / 2)}px`;
    el.style.margin = '0';
    el.style.width = `${w}px`;
    el.style.bottom = `${Math.round(keyboard)}px`;
    el.style.maxHeight = `${Math.round(Math.min(visible * 0.78, visible - 48))}px`;
  };
  place();
  // Il clic che segue il tocco sullo sfondo non deve attivare quello che c'è sotto (un'altra tendina, un pulsante)
  let swallowUntil = 0;
  const away = (e: PointerEvent) => {
    const target = e.target as Element | null;
    // Dentro un foglio (questo o uno aperto sopra, es. lo Strumento nelle Impostazioni della Sfida): niente da chiudere
    if (target?.closest?.('[data-sheet]')) return;
    e.preventDefault();
    e.stopPropagation();
    swallowUntil = Date.now() + 600;
    dismiss();
  };
  const swallow = (e: Event) => { if (Date.now() < swallowUntil) { e.preventDefault(); e.stopPropagation(); swallowUntil = 0; } };
  document.addEventListener('pointerdown', away, true);
  document.addEventListener('click', swallow, true);
  vv?.addEventListener('resize', place);
  vv?.addEventListener('scroll', place);
  window.addEventListener('resize', place);
  return () => {
    document.removeEventListener('pointerdown', away, true);
    // Il clic del tocco arriva subito dopo: lo si lascia ancora intercettare per un attimo
    setTimeout(() => document.removeEventListener('click', swallow, true), 650);
    vv?.removeEventListener('resize', place);
    vv?.removeEventListener('scroll', place);
    window.removeEventListener('resize', place);
    delete el.dataset.sheet;
    if (supportsPopover && el.isConnected && el.matches(':popover-open')) el.hidePopover();
  };
}
