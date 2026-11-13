import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { toID } from '../engine/dex';
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
  description?: string;
  /** Come mostrare il valore scelto nel campo chiuso (solo con `restricted`). */
  display?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  /** Elemento dentro il campo, a sinistra del testo (es. l'icona dello strumento scelto). */
  leading?: ReactNode;
  /** Intestazione delle voci più usate, se diversa da "Più usati" (es. con il formato da cui vengono). */
  commonLabel?: string;
}

/** Campo con menu a tendina: cerca mentre scrivi, frecce e Invio per scegliere, ogni voce con la sua descrizione. */
export function Combobox({ label, value, options, onChange, restricted = false, description, display, placeholder, disabled, leading, commonLabel }: Props) {
  const t = useT();
  const listId = useId();
  const [open, setOpen] = useState(false);
  // null: mostra tutto (appena aperto); stringa: filtra su quello che hai scritto
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Le più usate in cima, anche mentre cerchi
  const ordered = useMemo(() => [...options.filter(o => o.common), ...options.filter(o => !o.common)], [options]);
  const hasCommon = ordered.length > 0 && !!ordered[0].common;
  // Intestazioni dei gruppi solo se ce n'è più d'uno (le frecce le saltano: non sono voci)
  const grouped = useMemo(() => new Set(options.map(o => o.group).filter(Boolean)).size > 1, [options]);
  const matches = useMemo(() => {
    if (!query) return ordered;
    const q = searchID(query);
    // Nome mostrato e nome inglese, senza accenti ("velocita" trova "Velocità")
    const names = (o: ComboOption) => [searchID(o.label ?? o.value), ...(o.alias ? [searchID(o.alias)] : [])];
    const starts = ordered.filter(o => names(o).some(n => n.startsWith(q)));
    const contains = ordered.filter(o => !starts.includes(o) && names(o).some(n => n.includes(q)));
    const found = [...starts, ...contains];
    return [...found.filter(o => o.common), ...found.filter(o => !o.common)];
  }, [ordered, query]);
  const shown = matches.slice(0, MAX_SHOWN);
  // Il campo mostra l'etichetta del valore (es. il nome italiano); il valore salvato resta quello della voce
  const shownValue = options.find(o => o.value === value)?.label ?? value;
  /** Porta la voce in vista scorrendo solo la lista, non la pagina. */
  const reveal = (index: number, center = false) => {
    const list = listRef.current;
    const item = document.getElementById(`${listId}-${index}`);
    if (!list || !item) return;
    // Se la voce è già visibile partendo dall'inizio, si resta in cima (intestazione "Più usati" compresa)
    if (center) list.scrollTop = item.offsetTop + item.offsetHeight <= list.clientHeight ? 0 : item.offsetTop - (list.clientHeight - item.offsetHeight) / 2;
    else if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  };
  // Appena aperto, la lista parte dalla voce scelta
  useEffect(() => {
    if (open) reveal(active, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = () => {
    setOpen(true);
    setQuery(null);
    // Oltre le prime voci la scelta attuale non sarebbe mostrata: si parte dall'inizio
    const index = ordered.findIndex(o => o.value === value);
    setActive(index >= 0 && index < MAX_SHOWN ? index : 0);
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
    // Scrivere il nome di una voce bloccata non la sceglie
    if (exact?.disabled) return;
    const next = exact ? exact.value : query.trim();
    if (next !== value) onChange(next);
  };
  const move = (delta: number) => {
    if (!open) return show();
    const next = Math.min(shown.length - 1, Math.max(0, active + delta));
    setActive(next);
    reveal(next);
  };

  return (
    <div className={`combobox${open ? ' open' : ''}${restricted && display ? ' has-display' : ''}${leading ? ' has-leading' : ''}`}>
      {leading && <span className="combobox-leading" aria-hidden="true">{leading}</span>}
      {restricted && display && <span className="combobox-display" aria-hidden="true">{display}</span>}
      <input
        role="combobox"
        aria-label={label}
        aria-description={description}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        readOnly={restricted}
        disabled={disabled}
        placeholder={placeholder}
        // Mentre scrivi si vede il testo digitato; l'etichetta del valore torna quando esci dal campo
        value={query ?? shownValue}
        // Entrando nel campo il testo si seleziona tutto: scrivere sostituisce il valore invece di aggiungersi in coda
        // (anche col clic, finché non stai già scrivendo una bozza)
        onFocus={e => { if (!restricted) e.currentTarget.select(); }}
        // Sul rilascio del mouse (dopo che il clic ha messo il cursore): il browser non toglie più la selezione
        onMouseUp={e => {
          if (restricted || query !== null) return;
          e.preventDefault();
          e.currentTarget.select();
        }}
        onClick={() => (open ? setOpen(false) : show())}
        // Uscendo dal campo si salva quello che hai scritto (se hai scritto qualcosa)
        onBlur={() => { commit(); setOpen(false); setQuery(null); }}
        onChange={e => {
          // Mentre scrivi è solo una bozza: il set cambia con Invio, con una voce scelta o uscendo dal campo
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
          else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]); }
          // Invio senza voci da scegliere: si salva il testo libero
          else if (e.key === 'Enter' && query !== null) { e.preventDefault(); commit(); setOpen(false); setQuery(null); }
          // Esc butta la bozza: torna il valore di prima
          // (il testo torna selezionato: scrivere di nuovo lo sostituisce)
          else if (e.key === 'Escape' && (open || query !== null)) {
            e.stopPropagation(); setOpen(false); setQuery(null);
            const input = e.currentTarget;
            if (!restricted) requestAnimationFrame(() => input.select());
          }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={t("combobox.options", { label })} ref={listRef}>
          {shown.map((option, i) => [
            hasCommon && i === 0 && option.common
              ? <li key="common-head" role="presentation" className="group-head common-head">{commonLabel ?? t('combobox.common')}</li> : null,
            hasCommon && !grouped && !option.common && (i === 0 || shown[i - 1].common)
              ? <li key="all-head" role="presentation" className="group-head">{t('combobox.all')}</li> : null,
            grouped && !option.common && option.group && (i === 0 || shown[i - 1].common || shown[i - 1].group !== option.group)
              ? <li key={`group-${option.group}-${i}`} role="presentation" className="group-head format-head">{option.group}</li> : null,
            <li
              key={option.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              aria-label={option.ariaLabel}
              className={[i === active ? 'active' : '', option.common ? 'common' : ''].filter(Boolean).join(' ') || undefined}
              title={option.description}
              onMouseDown={e => { e.preventDefault(); pick(option); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="option-head">
                {option.icon}
                {option.content ?? <strong style={option.color ? { color: option.color } : undefined}>{option.label ?? option.value}</strong>}
                {option.detail && <span className="option-detail">{option.detail}</span>}
                {option.common && <span className="common-share" title={option.commonTitle}>{option.common}</span>}
              </span>
              {option.description && <small>{option.description}</small>}
            </li>,
          ])}
          {shown.length === 0 && <li className="empty" aria-disabled="true">{t("combobox.none")}</li>}
          {matches.length > MAX_SHOWN && (
            <li className="empty" aria-disabled="true">{t("combobox.more", { n: matches.length - MAX_SHOWN })}</li>
          )}
        </ul>
      )}
    </div>
  );
}
