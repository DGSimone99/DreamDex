import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { useMediaQuery } from './useMediaQuery';

/** Schermi col dito senza mouse (telefono, tablet): i tooltip non si aprono passando sopra, ma tenendo premuto. */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';
/** Quanto tenere premuto, e quanto si può muovere il dito senza che diventi uno scorrimento. */
const HOLD_MS = 450;
const SLOP = 10;

/** Il testo del tooltip di un elemento o dei suoi contenitori: data-tip, il fumetto dei pulsanti a icona, title, descrizione. */
function textTipOf(start: Element): string | null {
  for (let el: Element | null = start; el && el !== document.body; el = el.parentElement) {
    const tip = el.getAttribute('data-tip');
    if (tip) return tip;
    if (el.classList.contains('hint-wrap') || el.classList.contains('head-help')) {
      const bubble = el.querySelector(':scope > .hint-bubble:not(.done)');
      if (bubble?.textContent?.trim()) return bubble.textContent.trim();
    }
    const title = el.getAttribute('title');
    if (title) return title;
    const description = el.getAttribute('aria-description');
    if (description) return description;
  }
  return null;
}

type Open = { kind: 'text'; text: string } | { kind: 'rich'; target: Element; tip: HTMLElement };

/**
 * I tooltip col dito: sui telefoni e i tablet un tocco non li apre (resterebbero aperti o lampeggerebbero); tenendo
 * premuto mezzo secondo su un elemento col tooltip la sua spiegazione si apre in un foglio dal basso con la ×, e si
 * chiude anche toccando fuori. I tooltip ricchi (la carta del set di un membro, le barre della Velocità…) si aprono come
 * sempre (il loro elemento riceve il passaggio del mouse) e il loro pannello diventa il foglio. Il tocco lungo non attiva
 * l'elemento (niente clic dopo) e non apre il menu del browser.
 */
export function TouchTips() {
  const t = useT();
  const touch = useMediaQuery(TOUCH_QUERY);
  const [open, setOpen] = useState<Open | null>(null);
  const openRef = useRef<Open | null>(null);
  openRef.current = open;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [closeAt, setCloseAt] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('touch-tips', touch);
    return () => document.documentElement.classList.remove('touch-tips');
  }, [touch]);

  const close = () => {
    const current = openRef.current;
    if (current?.kind === 'rich') {
      delete current.tip.dataset.tipSheet;
      current.target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
    }
    document.documentElement.classList.remove('tip-sheet-open');
    setOpen(null);
  };

  useEffect(() => {
    if (!touch) return;
    let timer = 0;
    let start: { x: number; y: number; target: Element } | null = null;
    let swallowUntil = 0;
    const cancel = () => { window.clearTimeout(timer); start = null; };
    const fire = () => {
      if (!start) return;
      const target = start.target;
      start = null;
      // Prima il tooltip ricco: l'elemento riceve il passaggio del mouse; se compare un pannello nuovo, è quello
      const before = new Set(document.querySelectorAll('.ftip'));
      target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
      // Alcuni tooltip ricchi aspettano un attimo prima di aprirsi (la carta del set, mezzo secondo): si guarda per un po'
      // (poco se l'elemento ha già una spiegazione di testo, che allora si mostra)
      const text = textTipOf(target);
      const until = Date.now() + (text ? 150 : 900);
      swallowUntil = Date.now() + 2000;
      const look = () => {
        const tip = [...document.querySelectorAll<HTMLElement>('.ftip')].find(el => !before.has(el));
        if (!tip && Date.now() < until) { window.setTimeout(look, 40); return; }
        swallowUntil = Date.now() + 700;
        if (tip) {
          tip.dataset.tipSheet = '';
          document.documentElement.classList.add('tip-sheet-open');
          setOpen({ kind: 'rich', target, tip });
          return;
        }
        target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
        if (!text) { swallowUntil = 0; return; }
        document.documentElement.classList.add('tip-sheet-open');
        setOpen({ kind: 'text', text });
      };
      look();
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || openRef.current) return;
      const target = e.target as Element | null;
      // Nei campi si scrive (tenere premuto seleziona il testo), nei fogli si sceglie
      if (!target || target.closest('input, textarea, select, [contenteditable], [data-sheet], .tip-sheet')) return;
      start = { x: e.clientX, y: e.clientY, target };
      window.clearTimeout(timer);
      timer = window.setTimeout(fire, HOLD_MS);
    };
    const move = (e: PointerEvent) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) cancel(); };
    // Dopo un tocco lungo il clic che segue non preme l'elemento; il menu del browser non si apre
    const click = (e: MouseEvent) => { if (Date.now() < swallowUntil) { e.preventDefault(); e.stopPropagation(); swallowUntil = 0; } };
    const menu = (e: Event) => { if (start || Date.now() < swallowUntil || openRef.current) e.preventDefault(); };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', cancel, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('click', click, true);
    document.addEventListener('contextmenu', menu, true);
    return () => {
      cancel();
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', cancel, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('contextmenu', menu, true);
    };
  }, [touch]);

  // Esc chiude; la × del tooltip ricco sta sul suo bordo in alto
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (open?.kind !== 'rich') { setCloseAt(null); return; }
    const place = () => setCloseAt(open.tip.getBoundingClientRect().top);
    place();
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    watch?.observe(open.tip);
    return () => watch?.disconnect();
  }, [open]);
  useEffect(() => { if (open) closeRef.current?.focus({ preventScroll: true }); }, [open]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="tip-sheet-shade" onPointerDown={e => { e.preventDefault(); close(); }} />
      {open.kind === 'text' ? (
        <div className="tip-sheet" role="dialog" aria-modal="true" aria-label={t('touchTip.label')}>
          <p>{open.text}</p>
          <button type="button" className="tip-sheet-close" ref={closeRef} aria-label={t('combobox.close')} onClick={close}><Icon name="close" /></button>
        </div>
      ) : (
        <button type="button" className="tip-sheet-close floating" ref={closeRef} aria-label={t('combobox.close')} onClick={close}
          style={{ top: closeAt === null ? undefined : Math.max(8, closeAt - 52) }}><Icon name="close" /></button>
      )}
    </>,
    document.body,
  );
}
