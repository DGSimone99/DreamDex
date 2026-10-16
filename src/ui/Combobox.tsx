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
  /** Scelta tra le più usate: va in cima, con questa etichetta (la quota d'uso, o "Preset"). */
  common?: string;
}

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
  const matches = useMemo(() => {
    if (!query) return ordered;
    const q = toID(query);
    const name = (o: ComboOption) => toID(o.label ?? o.value);
    const starts = ordered.filter(o => name(o).startsWith(q));
    const contains = ordered.filter(o => !name(o).startsWith(q) && name(o).includes(q));
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
    onChange(option.value);
    setOpen(false);
    setQuery(null);
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
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={() => { setOpen(false); setQuery(null); }}
        onChange={e => {
          // Testo uguale all'etichetta di una voce: si salva il valore della voce; altrimenti il testo libero
          const typed = toID(e.target.value);
          const exact = typed ? options.find(o => o.label !== undefined && toID(o.label) === typed) : undefined;
          onChange(exact ? exact.value : e.target.value);
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
          else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={t("combobox.options", { label })} ref={listRef}>
          {shown.map((option, i) => [
            hasCommon && i === 0 && option.common
              ? <li key="common-head" role="presentation" className="group-head common-head">{commonLabel ?? t('combobox.common')}</li> : null,
            hasCommon && !option.common && (i === 0 || shown[i - 1].common)
              ? <li key="all-head" role="presentation" className="group-head">{t('combobox.all')}</li> : null,
            <li
              key={option.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={option.value === value}
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
                {option.common && <span className="common-share">{option.common}</span>}
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
