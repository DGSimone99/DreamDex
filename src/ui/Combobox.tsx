import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { toID } from '../engine/dex';
import { PICK_SHEET_QUERY, supportsPopover, useAnchoredPop } from './useAnchoredPop';
import { useMediaQuery } from './useMediaQuery';
import { FloatTip } from './FloatTip';
import { Icon } from './icons';
import { useT } from '../i18n/react';

export interface ComboOption {
  value: string;
  /** Nome mostrato e cercato, se diverso dal valore (es. Tera "" → "Nessuno"). */
  label?: string;
  /** Contenuto al posto del nome (es. il chip del tipo). */
  content?: ReactNode;
  /** Nome accessibile della voce, se il contenuto non basta. */
  ariaLabel?: string;
  /** Dettagli a destra del nome (tipo, categoria, potenza…). */
  detail?: ReactNode;
  /** Spiegazione sotto il nome: per intero al passaggio del mouse. */
  description?: string;
  /** Colore del nome (per le mosse: quello del tipo). */
  color?: string;
  /** Icona prima del nome (es. lo strumento). */
  icon?: ReactNode;
  /** Altro nome cercato (il nome inglese con l'interfaccia in italiano): "Earthquake" trova Terremoto. */
  alias?: string;
  /** Scelta tra le più usate: va in cima, con questa etichetta (la quota d'uso, o "Alt" se viene da un preset). */
  common?: string;
  /** Tooltip dell'etichetta (es. "Da un preset Smogon" per "Alt"). */
  commonTitle?: string;
  /** Voce visibile ma non selezionabile (es. una mossa già scelta in un altro slot). */
  disabled?: boolean;
  /** Gruppo della voce (es. il formato del preset): le voci di fila con lo stesso gruppo stanno sotto la sua intestazione. */
  group?: string;
}

/** Testo da confrontare nella ricerca: minuscolo, senza accenti, spazi e segni. */
const searchCache = new Map<string, string>();
const searchID = (text: string): string => {
  let id = searchCache.get(text);
  if (id === undefined) {
    id = toID(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    searchCache.set(text, id);
  }
  return id;
};

/** Oltre questo numero di voci la lista chiede di affinare la ricerca (tutte le mosse ci stanno). */
const MAX_SHOWN = 1000;

interface Props {
  label: string;
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  /** Solo le voci della lista, niente testo libero (come una select). */
  restricted?: boolean;
  /** Con `restricted`: si può comunque scrivere per cercare nella lista (vale solo il nome esatto di una voce). */
  searchable?: boolean;
  description?: string;
  /** Come mostrare il valore scelto nel campo chiuso (solo con `restricted`). */
  display?: ReactNode;
  /** Il nome da scrivere per un valore che non è fra le voci (es. una mossa non legale, nella lingua scelta). */
  valueLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Elemento dentro il campo, a sinistra del testo (es. l'icona dello strumento scelto). */
  leading?: ReactNode;
  /** Elemento dentro il campo, a destra del testo prima della freccia (es. la potenza della mossa). */
  trailing?: ReactNode;
  /** Classe in più sul contenitore (es. `move-combo` per i campi delle mosse a pillola). */
  className?: string;
  /** Intestazione delle voci più usate, se diversa da "Più usati" (es. con il formato da cui vengono). */
  commonLabel?: string;
  /** Larghezza minima del menu, per i campi stretti (di norma il menu è largo quanto il campo). */
  menuMinWidth?: number;
  /** Il menu abbraccia il campo: senza stacco, entra fino a metà della sua altezza e ne sborda di tanto per lato (il rombo della Natura). */
  menuJoined?: number;
  /** Le spiegazioni delle voci non stanno in ogni riga ma in una riga fissa in fondo al menu, quella della voce attiva
   *  (più voci in vista: le mosse e gli strumenti). */
  descriptionFooter?: boolean;
  /** Valore non valido (mossa vietata, non legale…): il motivo, detto ai lettori di schermo prima della descrizione. */
  invalid?: string;
  /** Il tooltip ricco della voce attiva (sotto il mouse o raggiunta con le frecce), di lato al menu, al posto della riga
   *  in fondo e del title: `tone` il colore dell'alone, `content` il contenuto (es. la scheda della mossa). Non sul telefono. */
  optionTip?: (option: ComboOption) => { tone: string; content: ReactNode; className?: string } | null;
}

/** Campo con menu a tendina: cerca mentre scrivi, frecce e Invio per scegliere, ogni voce con la sua descrizione. */
export function Combobox({ label, value, options, onChange, restricted = false, searchable = false, description, display, valueLabel, placeholder, disabled, leading, trailing, className, commonLabel, menuMinWidth, menuJoined, descriptionFooter = false, optionTip, invalid }: Props) {
  const t = useT();
  const listId = useId();
  // Si scrive nel campo: sempre senza `restricted`, e con `restricted` se è `searchable`
  const typing = !restricted || searchable;
  const [open, setOpen] = useState(false);
  // null: mostra tutto (appena aperto); stringa: filtra su quello che hai scritto
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  // Telefono: il menu è un foglio dal basso (titolo, ✕, ricerca, voci grandi); il campo si tocca soltanto
  const sheetScreen = useMediaQuery(PICK_SHEET_QUERY);
  const sheetRef = useRef<HTMLDivElement>(null);
  // Il menu attaccato al campo (il rombo della Natura) solo sul computer: sul telefono è un foglio come gli altri
  const joined = menuJoined !== undefined && !sheetScreen;
  const inputRef = useRef<HTMLInputElement>(null);
  // Campi in cui non si scrive (Natura, Tera): le lettere digitate di fila saltano alla prima voce che inizia così
  const typeahead = useRef({ text: '', at: 0 });
  // La voce a cui saltare quando il menu si apre scrivendo (resta quella anche se l'ordine si capovolge aprendosi sopra)
  const jumpTo = useRef<string | null>(null);
  // Il menu si allinea al campo; un contenitore con `data-pop-anchor` (es. il rombo della Natura) fa da campo al suo posto
  const anchorRef = useRef<HTMLElement | null>(null);
  const setRoot = (node: HTMLDivElement | null) => { anchorRef.current = node ? node.closest<HTMLElement>('[data-pop-anchor]') ?? node : null; };
  // Da che lato si apre il menu: aperto sopra il campo, le voci più vicine al campo sono quelle in fondo
  const [side, setSide] = useState<'below' | 'above'>('below');
  const up = side === 'above' && !sheetScreen;
  /** Chiude il foglio (✕, sfondo, Esc): salva quello che hai scritto e il fuoco torna al campo. */
  const closeSheet = () => { commit(); setOpen(false); setQuery(null); inputRef.current?.focus({ preventScroll: true }); };
  useAnchoredPop(anchorRef, sheetScreen ? sheetRef : listRef, open, {
    minWidth: menuMinWidth,
    sheet: true,
    onDismiss: () => closeSheet(),
    ...(joined ? { gap: 0, bleed: menuJoined, overlap: 0.5 } : {}),
    onSide: next => {
      setSide(next);
      // La voce scelta resta quella attiva anche se l'ordine si capovolge
      const list = byside(next);
      const want = jumpTo.current ?? value;
      jumpTo.current = null;
      const index = list.findIndex(o => o.value === want);
      setActive(index >= 0 && index < MAX_SHOWN ? index : joined ? -1 : 0);
    },
  });

  // Il tooltip della voce attiva: solo dopo un gesto nella lista (mouse sopra una voce, frecce, scrivere), non appena si apre
  const tips = !!optionTip && !sheetScreen;
  const [tipOn, setTipOn] = useState(false);
  const [tipRect, setTipRect] = useState<DOMRect | null>(null);
  // Scorrendo la lista la voce si sposta: il tooltip la segue
  const [tipTick, setTipTick] = useState(0);
  useEffect(() => { if (!open) setTipOn(false); }, [open]);

  // Le più usate vicino al campo, anche mentre cerchi: in cima se il menu si apre sotto, in fondo se si apre sopra
  // (tutte le altre restano in ordine alfabetico)
  // Menu attaccato al campo: la voce scelta è il campo stesso (l'ultima voce, o la prima), non si ripete nella lista
  const listed = useMemo(() => (joined ? options.filter(o => o.value !== value) : options), [options, joined, value]);
  const common = useMemo(() => listed.filter(o => o.common), [listed]);
  const others = useMemo(() => listed.filter(o => !o.common), [listed]);
  const byside = (which: 'below' | 'above') => (which === 'above' ? [...others, ...common] : [...common, ...others]);
  const ordered = useMemo(() => byside(side), [common, others, side]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasCommon = common.length > 0;
  // Intestazioni dei gruppi solo se ce n'è più d'uno (le frecce le saltano: non sono voci)
  const grouped = useMemo(() => new Set(options.map(o => o.group).filter(Boolean)).size > 1, [options]);
  const matches = useMemo(() => {
    if (!query) return ordered;
    const q = searchID(query);
    // Quanto bene una voce risponde a quello che hai scritto: nome esatto, nome che inizia così, una parola del nome che
    // inizia così ("ice" → Ice Beam prima di Hyper Voice), il nome che lo contiene da qualche parte. Vale il nome mostrato
    // o quello inglese, senza accenti ("velocita" trova "Velocità"). Le più usate passano avanti solo dentro lo stesso grado
    const rank = (o: ComboOption): number => {
      let best = 4;
      for (const text of [o.label ?? o.value, ...(o.alias ? [o.alias] : [])]) {
        const id = searchID(text);
        if (id === q) return 0;
        if (id.startsWith(q)) best = Math.min(best, 1);
        else if (text.split(/[\s\-:'’.]+/).some(word => searchID(word).startsWith(q))) best = Math.min(best, 2);
        else if (id.includes(q)) best = Math.min(best, 3);
      }
      return best;
    };
    const scored = listed.map((o, i) => ({ o, i, r: rank(o) })).filter(x => x.r < 4);
    scored.sort((a, b) => a.r - b.r || Number(!!b.o.common) - Number(!!a.o.common) || a.i - b.i);
    const best = scored.map(x => x.o);
    // Aperto sopra: la più adatta in fondo, vicino a quello che scrivi
    return up ? best.reverse() : best;
  }, [listed, ordered, query, up]);
  const shown = up ? matches.slice(-MAX_SHOWN) : matches.slice(0, MAX_SHOWN);
  // Il campo mostra l'etichetta del valore (es. il nome italiano); il valore salvato resta quello della voce
  const shownValue = options.find(o => o.value === value)?.label ?? valueLabel ?? value;
  useLayoutEffect(() => {
    if (!tips || !open || !tipOn || active < 0) { setTipRect(null); return; }
    const item = document.getElementById(`${listId}-${active}`);
    setTipRect(item ? item.getBoundingClientRect() : null);
  }, [tips, open, tipOn, active, listId, tipTick, shown.length, side]);
  const activeTip = tips && open && tipRect && shown[active] ? optionTip!(shown[active]) : null;
  /** Porta la voce in vista scorrendo solo la lista, non la pagina. */
  const reveal = (index: number, center = false) => {
    const list = listRef.current;
    const item = document.getElementById(`${listId}-${index}`);
    if (!list) return;
    // Nessuna voce attiva (menu attaccato): la lista parte dal lato del campo
    if (!item) { if (center && up) list.scrollTop = list.scrollHeight; return; }
    // Se la voce è già visibile partendo dal lato del campo, si resta lì (in cima, o in fondo se il menu è sopra il campo)
    const end = list.scrollHeight - list.clientHeight;
    if (center && up) list.scrollTop = item.offsetTop >= end ? end : item.offsetTop - (list.clientHeight - item.offsetHeight) / 2;
    else if (center) list.scrollTop = item.offsetTop + item.offsetHeight <= list.clientHeight ? 0 : item.offsetTop - (list.clientHeight - item.offsetHeight) / 2;
    else if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  };
  // Appena aperto, la lista parte dalla voce scelta
  useLayoutEffect(() => {
    if (open) reveal(active, true);
  }, [open, side]); // eslint-disable-line react-hooks/exhaustive-deps
  // Scrivendo, la voce attiva è la più adatta: la prima, o l'ultima se il menu è sopra il campo
  useLayoutEffect(() => {
    if (query === null) return;
    const best = up ? shown.length - 1 : 0;
    setActive(Math.max(0, best));
    reveal(Math.max(0, best), up);
  }, [query, up]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = () => {
    setOpen(true);
    setQuery(null);
    // Oltre le prime voci la scelta attuale non sarebbe mostrata: si parte dall'inizio
    const index = ordered.findIndex(o => o.value === value);
    // Menu attaccato: nessuna voce attiva, la scelta è il campo (le frecce partono da lì)
    setActive(index >= 0 && index < MAX_SHOWN ? index : joined ? -1 : 0);
  };
  const pick = (option: ComboOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setQuery(null);
  };
  /** Salva la bozza scritta: il nome di una voce salva il valore della voce, altrimenti il testo libero (hackrom). */
  const commit = () => {
    if (query === null) return;
    const typed = toID(query);
    const exact = typed ? options.find(o => toID(o.label ?? o.value) === typed) : undefined;
    // Scrivere il nome di una voce bloccata non la sceglie; con `restricted` vale solo il nome di una voce
    if (exact?.disabled || (restricted && !exact)) return;
    const next = exact ? exact.value : query.trim();
    if (next !== value) onChange(next);
  };
  const move = (delta: number) => {
    if (!open) return show();
    // Menu attaccato: le frecce passano dal campo (nessuna voce attiva, -1) alla voce più vicina, e ci tornano
    if (joined && query === null) {
      const toward = up ? -1 : 1;
      const next = active < 0 ? (delta === toward ? (up ? shown.length - 1 : 0) : -1)
        : (up && active === shown.length - 1 && delta > 0) || (!up && active === 0 && delta < 0) ? -1
        : Math.min(shown.length - 1, Math.max(0, active + delta));
      setActive(next);
      if (next >= 0) reveal(next);
      return;
    }
    const next = Math.min(shown.length - 1, Math.max(0, active + delta));
    setActive(next);
    reveal(next);
  };

  /** Tasti del campo (e della ricerca nel foglio del telefono): lettere, frecce, Invio, Esc. */
  const onKeys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!typing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key !== ' ' || typeahead.current.text)) {
      const now = Date.now();
      const text = (now - typeahead.current.at < 800 ? typeahead.current.text : '') + e.key;
      typeahead.current = { text, at: now };
      const q = searchID(text);
      const index = q ? ordered.findIndex(o => !o.disabled && [o.label ?? o.value, o.alias ?? ''].some(n => searchID(n).startsWith(q))) : -1;
      if (index < 0 || index >= MAX_SHOWN) return;
      e.preventDefault();
      setActive(index);
      // Chiuso: si apre e la lista parte da quella voce (vedi onSide); aperto: la si porta in vista
      if (!open) { jumpTo.current = ordered[index].value; setOpen(true); setQuery(null); }
      else requestAnimationFrame(() => reveal(index, true));
    }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (open) setTipOn(true); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (open) setTipOn(true); move(-1); }
    else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]); }
    // Invio senza voci da scegliere: si salva il testo libero
    else if (e.key === 'Enter' && query !== null) { e.preventDefault(); commit(); setOpen(false); setQuery(null); }
    // Esc butta la bozza: torna il valore di prima (scrivere di nuovo lo sostituisce)
    else if (e.key === 'Escape' && (open || query !== null)) {
      e.stopPropagation(); if (sheetScreen) { closeSheet(); return; } setOpen(false); setQuery(null);
      const input = e.currentTarget;
      if (typing) requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
    }
  };

  /** Sul telefono la lista sta in un foglio dal basso: il nome del campo, ✕, la ricerca (se si può scrivere) e la lista. */
  const wrap = (list: ReactNode) => (!sheetScreen ? list : (
    <div className="combo-sheet" ref={sheetRef} popover={supportsPopover ? 'manual' : undefined} role="dialog" aria-label={label}>
      <div className="combo-sheet-head">
        <strong>{label}</strong>
        <button type="button" className="combo-sheet-close" aria-label={t('combobox.close')} onClick={closeSheet}><Icon name="close" /></button>
      </div>
      {typing && (
        <input className="combo-sheet-search" type="search" enterKeyHint="done" spellCheck={false} autoComplete="off"
          aria-label={t('combobox.search', { label })} placeholder={t('combobox.search', { label })} aria-controls={listId}
          aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
          value={query ?? ''} onChange={e => setQuery(e.target.value)} onKeyDown={onKeys} />
      )}
      {list}
    </div>
  ));

  /** Clic sulla freccia o sulla coda: il fuoco va al campo (senza perderlo) e il menu si apre o si chiude. */
  const toggleFromArrow = (e: MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    inputRef.current?.focus();
    if (open) setOpen(false);
    else show();
  };

  return (
    <div ref={setRoot} className={`combobox${open ? ' open' : ''}${restricted && display ? ' has-display' : ''}${leading ? ' has-leading' : ''}${trailing ? ' has-trailing' : ''}${className ? ` ${className}` : ''}`}>
      {leading && <span className="combobox-leading" aria-hidden="true">{leading}</span>}
      {trailing && <span className="combobox-trailing" aria-hidden="true" onMouseDown={toggleFromArrow}>{trailing}</span>}
      {/* La freccia (disegnata dal contenitore) si clicca come un pulsante: mano, e apre o chiude il menu */}
      {!disabled && <span className="combobox-arrow" aria-hidden="true" onMouseDown={toggleFromArrow} />}
      {restricted && display && <span className="combobox-display" aria-hidden="true">{display}</span>}
      <input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-description={invalid ? [invalid, description].filter(Boolean).join('. ') : description}
        aria-invalid={invalid ? true : undefined}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        // Nomi di mosse e strumenti: niente sottolineature rosse del correttore, niente suggerimenti del browser
        spellCheck={false}
        autoComplete="off"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        readOnly={!typing || sheetScreen}
        disabled={disabled}
        placeholder={placeholder}
        // Mentre scrivi si vede il testo digitato; l'etichetta del valore torna quando esci dal campo
        value={query ?? shownValue}
        // Entrando nel campo il testo non si evidenzia: il cursore va in fondo (scrivere sostituisce comunque il valore, vedi onChange)
        onFocus={e => { const input = e.currentTarget; input.setSelectionRange(input.value.length, input.value.length); }}
        onMouseUp={e => {
          if (query !== null) return;
          const input = e.currentTarget;
          input.setSelectionRange(input.value.length, input.value.length);
        }}
        onClick={() => (open ? (sheetScreen ? undefined : setOpen(false)) : show())}
        // Uscendo dal campo si salva quello che hai scritto (se hai scritto qualcosa)
        onBlur={() => { if (sheetScreen) return; commit(); setOpen(false); setQuery(null); }}
        onChange={e => {
          // Mentre scrivi è solo una bozza: il set cambia con Invio, con una voce scelta o uscendo dal campo.
          // Il primo tasto sostituisce il valore mostrato (non si aggiunge in coda); cancellare lo svuota
          const next = e.target.value;
          if (query === null) {
            const before = shownValue;
            setQuery(next.startsWith(before) ? next.slice(before.length) : next.length < before.length ? '' : next);
          } else setQuery(next);
          setOpen(true);
          setTipOn(true);
        }}
        onKeyDown={onKeys}
      />
      {open && wrap(
        <ul id={listId} role="listbox" aria-label={t("combobox.options", { label })} ref={listRef} popover={!sheetScreen && supportsPopover ? 'manual' : undefined}
          onScroll={tips ? () => setTipTick(n => n + 1) : undefined}>
          {shown.map((option, i) => [
            !query && hasCommon && option.common && (i === 0 || !shown[i - 1].common)
              ? <li key="common-head" role="presentation" className="group-head common-head">{commonLabel ?? t('combobox.common')}</li> : null,
            !query && hasCommon && !grouped && !option.common && (i === 0 || shown[i - 1].common)
              ? <li key="all-head" role="presentation" className="group-head">{t('combobox.all')}</li> : null,
            !query && grouped && !option.common && option.group && (i === 0 || shown[i - 1].common || shown[i - 1].group !== option.group)
              ? <li key={`group-${option.group}-${i}`} role="presentation" className="group-head format-head">{option.group}</li> : null,
            <li
              key={option.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              aria-label={option.ariaLabel}
              className={[i === active ? 'active' : '', option.common ? 'common' : ''].filter(Boolean).join(' ') || undefined}
              title={tips ? undefined : option.description}
              aria-description={tips ? option.description : undefined}
              onMouseDown={e => { e.preventDefault(); pick(option); }}
              onMouseEnter={() => { setActive(i); if (tips) setTipOn(true); }}
            >
              <span className="option-head">
                {option.icon}
                {option.content ?? <strong style={option.color ? { color: option.color } : undefined}>{option.label ?? option.value}</strong>}
                {option.detail && <span className="option-detail">{option.detail}</span>}
                {option.common && <span className="common-share" title={option.commonTitle}>{option.common}</span>}
              </span>
              {option.description && !descriptionFooter && <small>{option.description}</small>}
            </li>,
          ])}
          {shown.length === 0 && <li className="empty" aria-disabled="true">{t("combobox.none")}</li>}
          {/* La spiegazione della voce attiva (o di quella sotto il mouse), sempre in fondo e sempre alta uguale: la lista
              non salta. Per i lettori di schermo la spiegazione è già nel title della voce */}
          {descriptionFooter && !tips && shown.length > 0 && (
            <li className="option-footer" role="presentation" aria-hidden="true">{shown[active]?.description ?? ''}</li>
          )}
          {matches.length > MAX_SHOWN && (
            <li className="empty" aria-disabled="true">{t("combobox.more", { n: matches.length - MAX_SHOWN })}</li>
          )}
        </ul>
      )}
      {activeTip && tipRect && (
        <FloatTip rect={tipRect} tone={activeTip.tone} className={activeTip.className} side layer>{activeTip.content}</FloatTip>
      )}
    </div>
  );
}
