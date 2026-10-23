import { memo, useCallback, useDeferredValue, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { EngineData } from '../engine/data';
import { battleName, getSpecies, toID } from '../engine/dex';
import { activeFilterCount, EMPTY_FILTERS, searchPool, type CandidateFilters } from '../engine/filters';
import type { Format, FormatId } from '../engine/format';
import { formatLabel, formatOptions } from '../engine/formats';
import { clearList, copyLists, effectiveLists, isUserBanned, isUserFavorite, pokedexSpecies, toggleIn, type ListKind, type ListScope, type UserLists } from '../engine/lists';
import { useLang, useT } from '../i18n/react';
import { FilterBar } from './FilterBar';
import { Icon } from './icons';
import { Sprite } from './Sprite';

interface Props {
  lists: UserLists;
  format: Format;
  data: EngineData;
  /** Liste cambiate; con `undo` la modifica si può annullare (Svuota lista). */
  onChange: (next: UserLists, undo?: { kind: 'clearList'; from: string }) => void;
}

const MARK: Record<ListKind, string> = { favorites: '♥', bans: '⊘' };

/** Una cella del Pokédex: numero, sprite, nome, ♥ e ⊘. */
const DexCell = memo(function DexCell({ name, fav, ban, target, onToggle }: {
  name: string;
  fav: boolean;
  ban: boolean;
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
        <button type="button" className="dex-fav" aria-pressed={fav} aria-label={tr('lists.toggleFavorite', { species: name })}
          onClick={() => onToggle('favorites', name)}>♥</button>
        <button type="button" className="dex-ban" aria-pressed={ban} aria-label={tr('lists.toggleBan', { species: name })}
          onClick={() => onToggle('bans', name)}>⊘</button>
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
  const [scope, setScope] = useState<ListScope>(format.formatId);
  // Il formato cambia: si modifica la sua lista (l'universale resta universale)
  const editing: ListScope = scope === 'universal' ? 'universal' : format.formatId;
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  const [copied, setCopied] = useState<string | null>(null);
  const effective = useMemo(() => effectiveLists(lists, format.formatId), [lists, format.formatId]);

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
    if (!pairOfScope(lists, editing)[kind].includes(target)) onChange(toggleIn(lists, editing, kind, target));
    setFilters({ ...filters, query: '' });
  };
  const scopeLabel = (s: ListScope) => (s === 'universal' ? tr('lists.universal') : formatLabel({ ...format, formatId: s }, lang));
  const sources = formatOptions(lang).filter(f => f.id !== format.formatId
    && ((lists.byFormat[f.id]?.favorites.length ?? 0) + (lists.byFormat[f.id]?.bans.length ?? 0) > 0));
  const copyFrom = (from: FormatId) => {
    const result = copyLists(lists, from, format.formatId, format);
    onChange(result.lists);
    setCopied(tr('lists.copied', { copied: result.copied, skipped: result.skipped, format: formatLabel(format, lang) }));
  };

  const listOf = (kind: ListKind) => {
    const label = tr(kind === 'favorites' ? 'lists.favorites' : 'lists.bans');
    const names = all.filter(name => effective[kind].has(name));
    // Voci universali coperte dal formato: si dicono sulla voce del formato
    const note = (name: string) => effective.overridden.get(name);
    return (
      <section className={`user-list ${kind}`}>
        <h3>
          <span>{MARK[kind]} {label} <span className="count">{names.length}</span></span>
          <button type="button" className="list-clear" disabled={!pairOfScope(lists, editing)[kind].length}
            aria-label={tr('lists.clear', { list: label })}
            onClick={() => onChange(clearList(lists, editing, kind), { kind: 'clearList', from: label })}>
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
                    onClick={() => onChange(toggleIn(lists, universal ? 'universal' : format.formatId, kind, name))}>
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
              <strong>{target}</strong> <kbd>{tr('suggest.enter')}</kbd> ♥ <kbd>⇧ {tr('suggest.enter')}</kbd> ⊘
            </span>
          )}
        </span>
        <div className="segmented" role="group" aria-label={tr('lists.scope')}>
          {(['format', 'universal'] as const).map(s => (
            <button key={s} type="button" aria-pressed={(s === 'universal') === (editing === 'universal')}
              onClick={() => setScope(s === 'universal' ? 'universal' : format.formatId)}>
              {scopeLabel(s === 'universal' ? 'universal' : format.formatId)}
            </button>
          ))}
        </div>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="lists-main">
        <ol className="dex-grid" aria-label={tr('lists.pokedex')}>
          {shown.map(name => (
            // Stesse regole dei suggerimenti: bannare la specie base vale anche per le sue Mega e forme
            <DexCell key={name} name={name} fav={isUserFavorite({ species: name, item: '' }, effective)}
              ban={isUserBanned({ species: name, item: '' }, effective)} target={name === target}
              onToggle={toggleRef} />
          ))}
        </ol>
        <div className="lists-side">
          {listOf('favorites')}
          {listOf('bans')}
          <div className="lists-copy">
            <label>
              <span className="visually-hidden">{tr('lists.copyFrom')}</span>
              <select aria-label={tr('lists.copyFrom')} value="" disabled={!sources.length}
                onChange={e => { if (e.target.value) copyFrom(e.target.value as FormatId); }}>
                <option value="">{tr('lists.copyFrom')}</option>
                {sources.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            {copied && <p className="note" role="status">{copied}</p>}
          </div>
        </div>
      </div>
    </section>
  );
});

const pairOfScope = (lists: UserLists, scope: ListScope) =>
  (scope === 'universal' ? lists.universal : lists.byFormat[scope]) ?? { favorites: [], bans: [] };
