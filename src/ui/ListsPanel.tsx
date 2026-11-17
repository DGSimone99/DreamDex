import { memo, useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type RefObject } from 'react';
import type { EngineData } from '../engine/data';
import { battleName, getSpecies, toID } from '../engine/dex';
import { activeFilterCount, EMPTY_FILTERS, searchPool, type CandidateFilters } from '../engine/filters';
import type { Format } from '../engine/format';
import { formatLabel } from '../engine/formats';
import {
  activeScope, customIdOf, isUserBanned, isUserFavorite, listContext, otherKind, pairOf, pokedexSpecies, putIn, regionOf, REGIONS,
  scopeLists, toggleIn, type EffectiveLists, type ListKind, type ListScope, type Region, type UserLists,
} from '../engine/lists';
import { usageOf } from '../engine/stats';
import { TYPES } from '../engine/types';
import { useLang, useT } from '../i18n/react';
import { FilterBar } from './FilterBar';
import { Icon } from './icons';
import { ListsPicker, menuKeys, useFocusFirst, useMenu } from './ListsPicker';
import { PokemonIcon } from './PokemonName';
import { Sprite, typeColor } from './Sprite';
import type { ListUndo } from './UndoToast';
import { useRoving } from './useRoving';

interface Props {
  lists: UserLists;
  format: Format;
  data: EngineData;
  /** Liste cambiate; con `undo` la modifica si può annullare (raccolta svuotata o sostituita, Pokémon tolto da un box). */
  onChange: (next: UserLists, undo?: ListUndo) => void;
}

const MARK: Record<ListKind, 'heart' | 'ban'> = { favorites: 'heart', bans: 'ban' };
const KINDS: ListKind[] = ['favorites', 'bans'];

/** Ordine del Pokédex: nazionale, più usati, per tipo, per nome o un Pokédex regionale (solo quella regione). */
type DexOrder = 'national' | 'usage' | 'type' | 'name' | Region;

/** Caselle dei box: 10 colonne, sempre 2 righe (20 per pagina). */
const COLUMNS = 10;
const BOX_CAP = 2 * COLUMNS;
/** Scheda bassa (misurata, es. 1280×620 col team aperto): box di una riga e carte del Pokédex più basse, così ne
 *  entrano due righe. Sotto questa altezza della scheda Liste si passa alla forma bassa. */
const LOW_PANEL = 450;
const CARD_H_LOW = 80;
/** Carte del Pokédex: 9 per riga sugli schermi larghi (griglia da 1100px in su), 6 sugli stretti; righe quante ne
 *  entrano in altezza (almeno una). Senza misura (jsdom) una pagina di 60. */
const DEX_WIDE = 1100;
const CARD_H = 104;
const CARD_GAP = 8;
const DEX_PAGE = 60;
/** Vista grande: carte per pagina con le due liste affiancate o con una sola. */
const BIG_BOTH = 12;
const BIG_ONE = 24;

type View = { expanded: boolean; show: 'both' | ListKind };
const VIEW_KEY = 'dreamdex.listsView';
/** La vista (ridotta o espansa, e cosa mostra) resta per la sessione del browser. */
function loadView(): View {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(VIEW_KEY) ?? 'null') as Partial<View> | null;
    if (raw && typeof raw.expanded === 'boolean' && ['both', 'favorites', 'bans'].includes(raw.show as string)) return raw as View;
  } catch {
    // Archivio non disponibile: si parte dalla vista ridotta
  }
  return { expanded: false, show: 'both' };
}
function saveView(view: View) {
  try { window.sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch { /* vale solo finché resta aperta */ }
}

/** Misura di un elemento (ResizeObserver); 0×0 finché non c'è layout (scheda nascosta, jsdom). */
function useSize(ref: RefObject<HTMLElement | null>, key: unknown): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setSize(s => (s.w === w && s.h === h ? s : { w, h }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, key]);
  return size;
}

const firstType = (name: string) => getSpecies(name)?.types[0] ?? '';
const dexNo = (name: string) => `#${String(getSpecies(name)?.num ?? 0).padStart(4, '0')}`;

/** Pagine "‹ 1/2 ›": i pulsanti dicono quale lista sfogliano, la pagina si legge ai lettori di schermo. */
function Pager({ page, pages, label, onPage }: { page: number; pages: number; label: string; onPage: (page: number) => void }) {
  const tr = useT();
  if (pages <= 1) return null;
  return (
    <span className="lists-pager">
      <button type="button" aria-label={tr('lists.pagePrev', { list: label })} disabled={page === 0} onClick={() => onPage(page - 1)}><Icon name="prev" /></button>
      <span aria-label={tr('lists.pageOf', { n: page + 1, pages })}>{page + 1}/{pages}</span>
      <button type="button" aria-label={tr('lists.pageNext', { list: label })} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}><Icon name="next" /></button>
    </span>
  );
}

/** Una carta del Pokédex (o della vista grande): tinta del tipo, sprite con l'ombra, nome, numero, ♥ e ⊘. */
const DexCard = memo(function DexCard({ name, fav, ban, favHere, banHere, target, onToggle, onDragStart, onDragEnd }: {
  name: string;
  /** Preferito o bannato, anche per eredità (Universale, specie base): si vede sulla carta. */
  fav: boolean;
  ban: boolean;
  /** Voce nella raccolta che si modifica: solo questa accende il pulsante, e il clic la toglie. */
  favHere: boolean;
  banHere: boolean;
  /** Il Pokémon che Invio aggiungerebbe. */
  target?: boolean;
  onToggle: (kind: ListKind, species: string) => void;
  onDragStart?: (e: DragEvent, name: string) => void;
  onDragEnd?: () => void;
}) {
  const tr = useT();
  return (
    <li className={`dex-card${fav ? ' fav' : ''}${ban ? ' ban' : ''}${target ? ' target' : ''}`} style={{ '--t': typeColor(firstType(name)) } as CSSProperties}
      draggable={!!onDragStart} onDragStart={onDragStart && (e => onDragStart(e, name))} onDragEnd={onDragEnd} title={name}>
      <span className="dex-no" aria-hidden="true">{dexNo(name)}</span>
      <span className="dex-sprite" aria-hidden="true"><Sprite species={name} size={96} /></span>
      <span className="dex-name">{name}</span>
      <span className="dex-actions">
        <button type="button" className="dex-fav" aria-pressed={favHere} aria-label={tr('lists.toggleFavorite', { species: name })}
          onClick={() => onToggle('favorites', name)}><Icon name="heart" filled={favHere} /></button>
        <button type="button" className="dex-ban" aria-pressed={banHere} aria-label={tr('lists.toggleBan', { species: name })}
          onClick={() => onToggle('bans', name)}><Icon name="ban" /></button>
      </span>
    </li>
  );
});

/** Menu "Ordine" del Pokédex: nazionale, più usati nel formato, per tipo, per nome, poi i Pokédex regionali. */
function OrderMenu({ order, onOrder, usageLabel, hasUsage }: { order: DexOrder; onOrder: (order: DexOrder) => void; usageLabel: string; hasUsage: boolean }) {
  const tr = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useMenu(rootRef, buttonRef);
  useFocusFirst(open, menuRef);
  const id = useId();
  const label = (o: DexOrder) => (o === 'usage' ? usageLabel : tr(`lists.order.${o}`));
  const item = (o: DexOrder, disabled = false) => (
    <button key={o} type="button" role="menuitemradio" aria-checked={order === o} tabIndex={-1} aria-disabled={disabled || undefined}
      className={`lists-menu-item${order === o ? ' on' : ''}`}
      onClick={() => { if (disabled) return; onOrder(o); setOpen(false); buttonRef.current?.focus(); }}>
      <span className="lists-menu-name">{label(o)}</span>
    </button>
  );
  return (
    <div className="dex-order" ref={rootRef}>
      <button ref={buttonRef} type="button" className="dex-order-pick" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? id : undefined} onClick={() => setOpen(o => !o)}>
        <small>{tr('lists.order')}</small><span className="lists-pick-name">{label(order)}</span><span className="lists-chev" aria-hidden="true" />
      </button>
      {open && (
        <div ref={menuRef} id={id} className="lists-menu order" role="menu" aria-label={tr('lists.order')} onKeyDown={menuKeys}>
          <div role="group" aria-label={tr('lists.order')} className="lists-menu-group">
            {item('national')}{item('usage', !hasUsage)}{item('type')}{item('name')}
          </div>
          <div role="group" aria-labelledby={`${id}-reg`} className="lists-menu-group">
            <p id={`${id}-reg`} className="lists-menu-head" role="presentation">{tr('lists.order.regional')}</p>
            {REGIONS.map(r => item(r))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Drag { name: string; from: ListKind | 'dex' }

/**
 * Preferiti e bannati dell'utente, come il Box del PC di Spada e Scudo. Vista ridotta: in alto i due box (caselle con
 * lo sprite su un alone del tipo, pagine quando sono pieni), sotto il Pokédex a carte (ricerca, filtri, ordine). Il clic
 * su una casella non fa niente: si trascina (fuori dal box la toglie, nell'altro box la sposta, dal Pokédex la aggiunge);
 * da tastiera Canc toglie e M sposta. Invio nella ricerca aggiunge ai Preferiti, Shift+Invio ai Bannati.
 * Vista espansa ("Espandi le liste"): niente ricerca né Pokédex, le liste a carte grandi a pagine.
 * Si modifica la raccolta mostrata nella testata (ListsPicker); i suggerimenti usano quella attiva.
 */
export const ListsPanel = memo(function ListsPanel({ lists, format, data, onChange }: Props) {
  const tr = useT();
  const lang = useLang();
  const context = listContext(format);
  // La raccolta scelta nel menu, per il contesto in cui la si è scelta. Il contesto cambia: si guarda la raccolta attiva
  // del nuovo contesto (quella del formato o la personalizzata scelta lì); l'Universale resta l'Universale
  const [picked, setPicked] = useState<{ context: string; scope: ListScope } | null>(null);
  const pickedScope = picked && (picked.context === context || picked.scope === 'universal') ? picked.scope : null;
  const pickedId = pickedScope ? customIdOf(pickedScope) : null;
  const editing: ListScope = pickedScope && (pickedId === null || lists.custom.some(c => c.id === pickedId)) ? pickedScope : activeScope(lists, context);
  const effective = useMemo(() => scopeLists(lists, editing), [lists, editing]);
  const here = pairOf(lists, editing);
  const kindLabel = (kind: ListKind) => tr(kind === 'favorites' ? 'lists.favorites' : 'lists.bans');

  const [view, setViewState] = useState<View>(loadView);
  const setView = (next: View) => { setViewState(next); saveView(next); };

  // Le voci delle due liste: prima quelle della raccolta (nell'ordine in cui sono entrate), poi le universali sotto
  const entries = useMemo(() => {
    const of = (kind: ListKind) => [...here[kind], ...[...effective[kind]].filter(name => effective.universal.has(name))];
    return { favorites: of('favorites'), bans: of('bans') };
  }, [here, effective]);
  // Dove vive una voce: le universali si tolgono e si spostano nell'Universale
  const ownerOf = useCallback((name: string): ListScope => (effective.universal.has(name) ? 'universal' : editing), [effective, editing]);

  const [announce, setAnnounce] = useState('');
  const remove = (kind: ListKind, name: string) => {
    onChange(toggleIn(lists, ownerOf(name), kind, name), { kind: 'listRemove', from: name, to: kindLabel(kind) });
    setAnnounce(tr('lists.removedNote', { species: name, list: kindLabel(kind) }));
  };
  const move = (kind: ListKind, name: string) => {
    onChange(toggleIn(lists, ownerOf(name), otherKind(kind), name));
    setAnnounce(tr('lists.movedNote', { species: name, list: kindLabel(otherKind(kind)) }));
  };
  const add = (kind: ListKind, name: string) => {
    onChange(putIn(lists, editing, kind, name));
    setAnnounce(tr('lists.addedNote', { species: name, list: kindLabel(kind) }));
  };
  const toggle = (kind: ListKind, species: string) => onChange(toggleIn(lists, editing, kind, species));
  // Le carte restano ferme finché non cambia il loro stato: il gestore passa da un riferimento stabile
  const live = useRef(toggle);
  live.current = toggle;
  const toggleRef = useCallback((kind: ListKind, species: string) => live.current(kind, species), []);
  // Vista grande: ♥ e ⊘ agiscono dove sta la voce (le universali nell'Universale)
  const liveOwner = useRef((kind: ListKind, species: string) => onChange(toggleIn(lists, ownerOf(species), kind, species)));
  liveOwner.current = (kind: ListKind, species: string) => onChange(toggleIn(lists, ownerOf(species), kind, species));
  const toggleOwner = useCallback((kind: ListKind, species: string) => liveOwner.current(kind, species), []);

  // ── Trascinare: da un box (fuori lo toglie, nell'altro lo sposta) o dal Pokédex (in un box lo aggiunge) ──
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState<Drag | null>(null);
  const [over, setOver] = useState<ListKind | null>(null);
  const startDrag = (e: DragEvent, info: Drag) => {
    drag.current = info;
    try {
      e.dataTransfer.setData('text/plain', info.name);
      e.dataTransfer.effectAllowed = info.from === 'dex' ? 'copy' : 'move';
    } catch {
      // Senza dataTransfer (test, browser vecchi) basta il riferimento
    }
    setDragging(info);
  };
  const endDrag = useCallback(() => { drag.current = null; setDragging(null); setOver(null); }, []);
  const dexDragStart = useCallback((e: DragEvent, name: string) => startDrag(e, { name, from: 'dex' }), []);
  const dropOn = (kind: ListKind) => (e: DragEvent) => {
    const info = drag.current;
    if (!info) return;
    e.preventDefault();
    e.stopPropagation();
    if (info.from === 'dex') add(kind, info.name);
    else if (info.from !== kind) move(info.from, info.name);
    endDrag();
  };
  const overBox = (kind: ListKind) => (e: DragEvent) => {
    if (!drag.current) return;
    e.preventDefault();
    if (over !== kind) setOver(kind);
  };
  // Rilasciato nella scheda ma fuori dai box: tolto (annullabile). Fuori dalla scheda: niente
  const overPanel = (e: DragEvent) => {
    if (drag.current && drag.current.from !== 'dex') e.preventDefault();
    if (over) setOver(null);
  };
  const dropPanel = (e: DragEvent) => {
    const info = drag.current;
    if (!info) return;
    e.preventDefault();
    if (info.from !== 'dex') remove(info.from, info.name);
    endDrag();
  };

  // ── Ricerca, filtri e ordine del Pokédex ──
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  const [order, setOrder] = useState<DexOrder>('national');
  const all = useMemo(() => pokedexSpecies(format), [format]);
  const filtered = useMemo(() => {
    if (activeFilterCount(filters) === 0) return null;
    return new Set(searchPool([], format, data, { ...filters, query: '' }).map(set => battleName(set)));
  }, [filters, format, data]);
  const hasUsage = useMemo(() => all.some(name => usageOf(data.stats, name) > 0), [all, data.stats]);
  const ordered = useMemo(() => {
    if (order === 'national') return all;
    if (order === 'usage') return [...all].sort((a, b) => usageOf(data.stats, b) - usageOf(data.stats, a));
    if (order === 'name') return [...all].sort((a, b) => a.localeCompare(b));
    if (order === 'type') {
      const at = (name: string) => TYPES.indexOf(firstType(name) as typeof TYPES[number]);
      return [...all].sort((a, b) => at(a) - at(b));
    }
    return all.filter(name => regionOf(name) === order);
  }, [all, order, data.stats]);
  // La griglia segue la ricerca appena può: il campo resta pronto a ogni lettera
  const query = toID(useDeferredValue(filters.query));
  const shown = useMemo(() => ordered.filter(name => (!query || toID(name).includes(query)) && (!filtered || filtered.has(name))),
    [ordered, query, filtered]);
  const exact = getSpecies(filters.query.trim())?.name;
  const target = exact && shown.includes(exact) ? exact : query ? shown[0] : undefined;
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !target) return;
    e.preventDefault();
    const kind: ListKind = e.shiftKey ? 'bans' : 'favorites';
    // Già in quella lista: resta (Invio non toglie per sbaglio)
    if (!here[kind].includes(target)) add(kind, target);
    setFilters({ ...filters, query: '' });
  };

  // ── Misure: righe dei box (3 o 2) e carte del Pokédex per pagina ──
  const gridRef = useRef<HTMLOListElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // Si rimisura tornando dalla vista espansa (gli elementi sono nuovi)
  const gridSize = useSize(gridRef, view.expanded);
  const panelSize = useSize(panelRef, view.expanded);
  const low = panelSize.h > 0 && panelSize.h < LOW_PANEL;
  const cap = low ? COLUMNS : BOX_CAP;
  const cardH = low ? CARD_H_LOW : CARD_H;
  const gridPad = low ? 16 : 20;
  const measured = gridSize.w > 0 && gridSize.h > 0;
  // Sul telefono (griglia stretta) 3 per riga
  const dexCols = !measured || gridSize.w >= DEX_WIDE ? 9 : gridSize.w >= 600 ? 6 : 3;
  const dexRows = Math.max(1, Math.floor((gridSize.h - gridPad + CARD_GAP) / (cardH + CARD_GAP)));
  const dexPer = measured ? dexCols * dexRows : DEX_PAGE;
  const [dexPage, setDexPage] = useState(0);
  const dexPages = Math.max(1, Math.ceil(shown.length / dexPer));
  const dexAt = Math.min(dexPage, dexPages - 1);
  // Ricerca, filtri, ordine nuovi: si riparte dalla prima pagina; col bersaglio di Invio, la sua pagina
  const dexKey = `${query}|${order}|${filtered?.size ?? -1}`;
  const [pageKey, setPageKey] = useState(dexKey);
  if (pageKey !== dexKey) { setPageKey(dexKey); setDexPage(0); }
  const page = shown.slice(dexAt * dexPer, (dexAt + 1) * dexPer);

  const [boxPage, setBoxPage] = useState<Record<ListKind, number>>({ favorites: 0, bans: 0 });
  const usageLabel = tr('lists.order.usage', { format: formatLabel(format, lang) });

  const picker = <ListsPicker lists={lists} format={format} context={context} shown={editing} onChange={onChange} onShow={scope => setPicked({ context, scope })} />;

  if (view.expanded) {
    const kinds = view.show === 'both' ? KINDS : [view.show];
    const per = view.show === 'both' ? BIG_BOTH : BIG_ONE;
    return (
      <section className="lists-panel expanded" aria-label={tr('lists.title')}>
        <div className="lists-exphead">
          <h2>{tr('lists.yours')}</h2>
          <div className="lists-pills" role="group" aria-label={tr('lists.showWhich')}>
            {(['both', 'favorites', 'bans'] as const).map(show => (
              <button key={show} type="button" className="lists-pill" aria-pressed={view.show === show} onClick={() => setView({ ...view, show })}>
                {show === 'both' ? tr('lists.both') : kindLabel(show)}
              </button>
            ))}
          </div>
          <span className="lists-exphead-gap" />
          {picker}
          <button type="button" className="lists-expand" onClick={() => setView({ ...view, expanded: false })}>
            <Icon name="shrink" /> {tr('lists.reduce')}
          </button>
        </div>
        <div className={`lists-expgrid${kinds.length === 1 ? ' one' : ''}`}>
          {kinds.map(kind => {
            const names = entries[kind];
            const pages = Math.max(1, Math.ceil(names.length / per));
            const at = Math.min(boxPage[kind], pages - 1);
            return (
              <section key={kind} className={`lists-big ${kind}`} aria-label={kindLabel(kind)}>
                <BoxHead kind={kind} count={names.length} label={kindLabel(kind)} page={at} pages={pages}
                  onPage={p => setBoxPage({ ...boxPage, [kind]: p })} />
                {names.length === 0 && <p className="lists-big-empty">{tr(kind === 'favorites' ? 'lists.noFavorites' : 'lists.noBans')}</p>}
                <ol className="lists-big-grid" aria-label={kindLabel(kind)}>
                  {names.slice(at * per, (at + 1) * per).map(name => {
                    const owner = pairOf(lists, ownerOf(name));
                    return (
                      <DexCard key={name} name={name} fav={kind === 'favorites'} ban={kind === 'bans'}
                        favHere={owner.favorites.includes(name)} banHere={owner.bans.includes(name)} onToggle={toggleOwner} />
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section ref={panelRef} className={`lists-panel${dragging ? ' dragging' : ''}${low ? ' low' : ''}`} aria-label={tr('lists.title')}
      onDragOver={overPanel} onDrop={dropPanel}>
      <h2 className="visually-hidden">{tr('lists.title')}</h2>
      <div className="lists-bar">
        <span className={`search-field${target ? ' has-hint' : ''}`}>
          <Icon name="search" />
          <input aria-label={tr('lists.search')} placeholder={tr('lists.searchPlaceholder')} value={filters.query}
            onChange={e => setFilters({ ...filters, query: e.target.value })} onKeyDown={onKey} />
          {target && (
            <span className="search-hint">
              <strong>{target}</strong> <kbd>{tr('suggest.enter')}</kbd> <Icon name="heart" /> <kbd>⇧ {tr('suggest.enter')}</kbd> <Icon name="ban" />
            </span>
          )}
        </span>
        {picker}
        <button type="button" className="lists-expand" onClick={() => setView({ ...view, expanded: true })}>
          <Icon name="expand" /> {tr('lists.expand')}
        </button>
      </div>
      <div className="lists-boxes">
        {KINDS.map(kind => {
          const names = entries[kind];
          const pages = Math.max(1, Math.ceil(names.length / cap));
          const at = Math.min(boxPage[kind], pages - 1);
          return (
            <ListBox key={kind} kind={kind} label={kindLabel(kind)} names={names.slice(at * cap, (at + 1) * cap)} cap={cap} count={names.length}
              page={at} pages={pages} onPage={p => setBoxPage({ ...boxPage, [kind]: p })} effective={effective}
              over={over === kind} dragFrom={dragging && dragging.from === kind ? dragging.name : null} dragOther={!!dragging && dragging.from !== kind}
              onRemove={remove} onMove={move} onDragStart={startDrag} onDragEnd={endDrag} onDragOver={overBox(kind)} onDrop={dropOn(kind)}
              onDragLeave={() => setOver(o => (o === kind ? null : o))} />
          );
        })}
      </div>
      <section className="lists-dex" aria-label={tr('lists.pokedex')}>
        <div className="dex-head">
          <h3>{tr('lists.pokedex')}</h3>
          <OrderMenu order={order} onOrder={setOrder} usageLabel={usageLabel} hasUsage={hasUsage} />
          <FilterBar filters={filters} onChange={setFilters} context="lists" />
          <span className="dex-count">
            {tr('lists.dexCount', { n: shown.length })}
            <span className="dex-key" aria-hidden="true"><Icon name="heart" /> {tr('lists.hintFav')} <Icon name="ban" /> {tr('lists.hintBan')}</span>
          </span>
          <Pager page={dexAt} pages={dexPages} label={tr('lists.pokedex')} onPage={setDexPage} />
        </div>
        {/* Pagina su e giù (anche dai pulsanti delle carte) sfogliano il Pokédex */}
        <ol ref={gridRef} className="dex-grid" aria-label={tr('lists.pokedex')} style={measured ? { '--dex-cols': dexCols, '--dex-rows': dexRows } as CSSProperties : undefined}
          onKeyDown={e => {
            const step = e.key === 'PageDown' ? 1 : e.key === 'PageUp' ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            setDexPage(Math.max(0, Math.min(dexPages - 1, dexAt + step)));
          }}>
          {page.map(name => (
            // Stesse regole dei suggerimenti: bannare la specie base vale anche per le sue Mega e forme
            <DexCard key={name} name={name} fav={isUserFavorite({ species: name, item: '' }, effective)}
              ban={isUserBanned({ species: name, item: '' }, effective)} target={name === target}
              favHere={here.favorites.includes(name)} banHere={here.bans.includes(name)}
              onToggle={toggleRef} onDragStart={dexDragStart} onDragEnd={endDrag} />
          ))}
        </ol>
      </section>
      <p className="visually-hidden" aria-live="polite">{announce}</p>
    </section>
  );
});

/** Testata di un box o di una lista grande: targhetta inclinata col colore della lista, conto, significato, pagine. */
function BoxHead({ kind, count, label, page, pages, onPage, note }: {
  kind: ListKind; count: number; label: string; page: number; pages: number; onPage: (page: number) => void; note?: string;
}) {
  return (
    <div className="lbox-head">
      <h3 className="lbox-plate"><Icon name={MARK[kind]} filled={kind === 'favorites'} /> {label}</h3>
      <span className="lbox-count">{count}</span>
      <small className="lbox-note">{note}</small>
      <Pager page={page} pages={pages} label={label} onPage={onPage} />
    </div>
  );
}

/** Un box del PC: 10 colonne, le caselle vuote si vedono; ogni Pokémon si trascina, Canc lo toglie, M lo sposta. */
function ListBox({ kind, label, names, cap, count, page, pages, onPage, effective, over, dragFrom, dragOther, onRemove, onMove, onDragStart, onDragEnd, onDragOver, onDrop, onDragLeave }: {
  kind: ListKind;
  label: string;
  /** I Pokémon della pagina. */
  names: string[];
  cap: number;
  count: number;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  effective: EffectiveLists;
  /** Qualcosa si trascina sopra il box. */
  over: boolean;
  /** Il Pokémon di questo box che si sta trascinando. */
  dragFrom: string | null;
  /** Si trascina da fuori (l'altro box o il Pokédex): il box lo accoglie. */
  dragOther: boolean;
  onRemove: (kind: ListKind, name: string) => void;
  onMove: (kind: ListKind, name: string) => void;
  onDragStart: (e: DragEvent, info: Drag) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragLeave: () => void;
}) {
  const tr = useT();
  const hintId = useId();
  const roving = useRoving<HTMLUListElement>('.lslot-mon');
  // Dopo Canc o M il fuoco resta nel box, sulla casella che prende il posto (o sull'ultima)
  const refocus = useRef<number | null>(null);
  useEffect(() => {
    if (refocus.current === null) return;
    const slots = roving.ref.current?.querySelectorAll<HTMLElement>('.lslot-mon');
    const at = refocus.current;
    refocus.current = null;
    if (slots?.length) slots[Math.min(at, slots.length - 1)].focus();
  });
  const other = tr(kind === 'favorites' ? 'lists.bans' : 'lists.favorites');
  const keys = (e: KeyboardEvent<HTMLUListElement>) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.lslot-mon');
    const name = slot?.dataset.name;
    if (!name) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      refocus.current = names.indexOf(name);
      onRemove(kind, name);
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      refocus.current = names.indexOf(name);
      onMove(kind, name);
    } else roving.onKeyDown(e);
  };
  const note = dragFrom ? tr('lists.dropOut') : dragOther ? tr('lists.dropHere', { list: label }) : tr(kind === 'favorites' ? 'lists.favMeaning' : 'lists.banMeaning');
  const empty = Math.max(0, cap - names.length);
  return (
    <section className={`lbox ${kind}${over ? ' over' : ''}${dragOther ? ' accepts' : ''}`} aria-label={label}
      onDragOver={onDragOver} onDrop={onDrop} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDragLeave(); }}>
      <BoxHead kind={kind} count={count} label={label} page={page} pages={pages} onPage={onPage} note={note} />
      <p id={hintId} className="visually-hidden">{tr('lists.slotKeys', { list: other })}</p>
      <div className="lslots-wrap">
        <ul className="lslots" aria-label={label} ref={roving.ref} onFocus={roving.onFocus} onKeyDown={keys} style={{ '--cols': COLUMNS } as CSSProperties}>
          {names.map(name => {
            const universal = effective.universal.has(name);
            const overridden = effective.overridden.get(name);
            const title = [name, universal && tr('lists.universalTag'), overridden && tr(overridden === 'favorites' ? 'lists.overriddenFav' : 'lists.overriddenBan')].filter(Boolean).join(' · ');
            return (
              <li key={name} className={`lslot on${dragFrom === name ? ' lifted' : ''}`} style={{ '--t': typeColor(firstType(name)) } as CSSProperties}>
                <span className="lslot-mon" data-name={name} tabIndex={-1} draggable title={title} aria-describedby={hintId}
                  onDragStart={e => onDragStart(e, { name, from: kind })} onDragEnd={onDragEnd}>
                  <PokemonIcon name={name} />
                  <span className="visually-hidden">{name}</span>
                  {universal && <span className="visually-hidden">, {tr('lists.universalTag')}</span>}
                  {overridden && <span className="visually-hidden">, {tr(overridden === 'favorites' ? 'lists.overriddenFav' : 'lists.overriddenBan')}</span>}
                  {(universal || overridden) && (
                    <span className={`lslot-mark${overridden ? ' over' : ''}`} aria-hidden="true">
                      <Icon name="globe" />{overridden && <Icon name={MARK[overridden]} filled={overridden === 'favorites'} />}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
          {Array.from({ length: empty }, (_, i) => <li key={`e${i}`} className="lslot" aria-hidden="true" />)}
        </ul>
        {count === 0 && <p className="lslots-empty">{tr(kind === 'favorites' ? 'lists.noFavorites' : 'lists.noBans')}</p>}
      </div>
    </section>
  );
}
