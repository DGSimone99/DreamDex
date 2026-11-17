import { memo, useCallback, useDeferredValue, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { EngineData } from '../engine/data';
import { battleName, getSpecies, toID } from '../engine/dex';
import { activeFilterCount, EMPTY_FILTERS, searchPool, type CandidateFilters } from '../engine/filters';
import type { Format } from '../engine/format';
import { activeScope, clearList, customIdOf, isUserBanned, isUserFavorite, listContext, pairOf, pokedexSpecies, scopeLists, toggleIn, type ListKind, type ListScope, type UserLists } from '../engine/lists';
import { useLang, useT } from '../i18n/react';
import { ListsPicker, scopeName } from './ListsPicker';
import type { ListUndo } from './UndoToast';
import { FilterBar } from './FilterBar';
import { Icon } from './icons';
import { Sprite } from './Sprite';

interface Props {
  lists: UserLists;
  format: Format;
  data: EngineData;
  /** Liste cambiate; con `undo` la modifica si può annullare (Svuota lista). */
  onChange: (next: UserLists, undo?: ListUndo) => void;
}

const MARK: Record<ListKind, 'heart' | 'ban'> = { favorites: 'heart', bans: 'ban' };

/** Una cella del Pokédex: numero, sprite, nome, ♥ e ⊘. */
const DexCell = memo(function DexCell({ name, fav, ban, favHere, banHere, target, onToggle }: {
  name: string;
  /** Preferito o bannato in questo formato, anche per eredità (lista universale, specie base): si vede sulla cella. */
  fav: boolean;
  ban: boolean;
  /** Voce nella lista che si sta modificando: solo questa accende il pulsante, e il clic la toglie. */
  favHere: boolean;
  banHere: boolean;
  /** Il Pokémon che Invio aggiungerebbe. */
  target: boolean;
  onToggle: (kind: ListKind, species: string) => void;
}) {
  const tr = useT();
  return (
    <li className={`dex-cell${fav ? ' fav' : ''}${ban ? ' ban' : ''}${target ? ' target' : ''}`}>
      <span className="dex-no">#{String(getSpecies(name)?.num ?? 0).padStart(3, '0')}</span>
      <Sprite species={name} size={56} />
      <span className="dex-name">{name}</span>
      <span className="dex-actions">
        <button type="button" className="dex-fav" aria-pressed={favHere} aria-label={tr('lists.toggleFavorite', { species: name })}
          onClick={() => onToggle('favorites', name)}><Icon name="heart" /></button>
        <button type="button" className="dex-ban" aria-pressed={banHere} aria-label={tr('lists.toggleBan', { species: name })}
          onClick={() => onToggle('bans', name)}><Icon name="ban" /></button>
      </span>
    </li>
  );
});

/**
 * Preferiti e bannati dell'utente: a sinistra tutto il Pokédex del formato in ordine (ricerca e filtri),
 * a destra le due liste. Invio aggiunge il Pokémon cercato ai Preferiti, Shift+Invio ai Bannati.
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
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  const effective = useMemo(() => scopeLists(lists, editing), [lists, editing]);

  const all = useMemo(() => pokedexSpecies(format), [format]);
  // Filtri (tipi, ruoli…) sui set di riferimento: solo se ce n'è qualcuno attivo, la sola ricerca è sul nome
  const filtered = useMemo(() => {
    if (activeFilterCount(filters) === 0) return null;
    return new Set(searchPool([], format, data, { ...filters, query: '' }).map(set => battleName(set)));
  }, [filters, format, data]);
  // La griglia (oltre mille Pokémon) segue la ricerca appena può: il campo resta pronto a ogni lettera
  const query = toID(useDeferredValue(filters.query));
  const shown = useMemo(() => all.filter(name => (!query || toID(name).includes(query)) && (!filtered || filtered.has(name))),
    [all, query, filtered]);
  const exact = getSpecies(filters.query.trim())?.name;
  const target = exact && shown.includes(exact) ? exact : query ? shown[0] : undefined;

  const here = pairOf(lists, editing);
  const toggle = (kind: ListKind, species: string) => onChange(toggleIn(lists, editing, kind, species));
  // Le celle restano ferme finché non cambia il loro stato: il gestore passa da un riferimento stabile
  const live = useRef(toggle);
  live.current = toggle;
  const toggleRef = useCallback((kind: ListKind, species: string) => live.current(kind, species), []);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !target) return;
    e.preventDefault();
    const kind: ListKind = e.shiftKey ? 'bans' : 'favorites';
    // Già in quella lista: resta (Invio non toglie per sbaglio)
    if (!pairOf(lists, editing)[kind].includes(target)) onChange(toggleIn(lists, editing, kind, target));
    setFilters({ ...filters, query: '' });
  };
  const listOf = (kind: ListKind) => {
    const label = tr(kind === 'favorites' ? 'lists.favorites' : 'lists.bans');
    const names = all.filter(name => effective[kind].has(name));
    // Voci universali coperte dal formato: si dicono sulla voce del formato
    const note = (name: string) => effective.overridden.get(name);
    return (
      <section className={`user-list ${kind}`}>
        <h3>
          <span><Icon name={MARK[kind]} /> {label} <span className="count">{names.length}</span></span>
          <button type="button" className="list-clear" disabled={!pairOf(lists, editing)[kind].length}
            aria-label={tr('lists.clear', { list: label })}
            onClick={() => onChange(clearList(lists, editing, kind), { kind: 'clearList', from: `${scopeName(lists, editing, lang)} · ${label}` })}>
            {tr('lists.clearShort')}
          </button>
        </h3>
        {names.length === 0 && <p className="list-none">{tr(kind === 'favorites' ? 'lists.noFavorites' : 'lists.noBans')}</p>}
        <ul aria-label={label}>
            {names.map(name => {
              const universal = effective.universal.has(name);
              const overridden = note(name);
              return (
                <li key={name}>
                  <Sprite species={name} size={40} />
                  <span className="list-name">{name}</span>
                  {universal && <small className="scope-tag">{tr('lists.universalTag')}</small>}
                  {overridden && <small className="scope-tag">{tr('lists.overridden', { mark: MARK[overridden] })}</small>}
                  <button type="button" className="list-remove" aria-label={tr('lists.remove', { species: name })}
                    onClick={() => onChange(toggleIn(lists, universal ? 'universal' : editing, kind, name))}>
                    <Icon name="close" />
                  </button>
                </li>
              );
            })}
        </ul>
      </section>
    );
  };

  return (
    <section className="lists-panel" aria-label={tr('lists.title')}>
      <h2>{tr('lists.title')}</h2>
      <p className="note">{tr('lists.intro')}</p>
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
        <ListsPicker lists={lists} format={format} context={context} shown={editing} onChange={onChange}
          onShow={scope => setPicked({ context, scope })} />
      </div>
      <FilterBar filters={filters} onChange={setFilters} context="lists" />
      <div className="lists-main">
        <ol className="dex-grid" aria-label={tr('lists.pokedex')}>
          {shown.map(name => (
            // Stesse regole dei suggerimenti: bannare la specie base vale anche per le sue Mega e forme
            <DexCell key={name} name={name} fav={isUserFavorite({ species: name, item: '' }, effective)}
              ban={isUserBanned({ species: name, item: '' }, effective)} target={name === target}
              favHere={here.favorites.includes(name)} banHere={here.bans.includes(name)}
              onToggle={toggleRef} />
          ))}
        </ol>
        <div className="lists-side">
          {listOf('favorites')}
          {listOf('bans')}
        </div>
      </div>
    </section>
  );
});

