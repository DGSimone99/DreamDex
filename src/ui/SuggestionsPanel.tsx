import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineData } from '../engine/data';
import type { Format } from '../engine/format';
import { formatRules } from '../engine/formatRules';
import { improveReplacements, similarity, similarReplacements, type Replacement } from '../engine/replace';
import { describeDiff, ratingGainOf, SIMILAR_THRESHOLD, type SwapPreview } from '../engine/coach';
import { suggest, type Suggestion } from '../engine/scoring';
import type { TeamSet } from '../engine/sets';
import type { TeamRating } from '../engine/rating';
import { getSpecies } from '../engine/dex';
import { formatLabel } from '../engine/formats';
import { EMPTY_FILTERS, isFiltering, searchCandidates, searchPool, tierLabel, type CandidateFilters } from '../engine/filters';
import { defaultSet } from '../engine/sets';
import { FilterBar } from './FilterBar';
import { conditionLabel, neededConditions, providesAll, viaName } from '../engine/synergy';
import { Sprite, TypeChip } from './Sprite';
import { Icon } from './icons';
import { SuggestionDetail } from './SuggestionDetail';
import { StatsBadge } from './StatsBadge';
import { AlertMark } from './AlertMark';
import { Typed } from './TypeText';
import { t } from '../i18n';
import { useLang, useT } from '../i18n/react';

/** Candidati per pagina e in tutto. */
export const PAGE = 10;
export const MAX = 50;

type ReplaceMode = 'improve' | 'similar';

interface Props {
  team: TeamSet[];
  format: Format;
  data: EngineData;
  replaceIndex: number | null;
  onAdd: (set: TeamSet) => void;
  onReplaceWith: (index: number, set: TeamSet) => void;
  onCancelReplace: () => void;
  /** Sostituto aperto (o chiuso) nella lista: il coaching mostra i suoi pro e contro. */
  onPreview?: (preview: SwapPreview, open: boolean) => void;
  /** Voto del team attuale, per mostrare come cambia col candidato. */
  rating?: TeamRating | null;
}

/** Solo se il Pokémon è bannato nel formato: triangolo rosso con il tier nel tooltip. */
function BanMark({ species, format }: { species: string; format: Format }) {
  const lang = useLang();
  const { label, banned } = tierLabel(species, format);
  return banned ? <AlertMark alerts={[{ level: 'danger', text: t(lang, 'suggest.banned', { tier: label, format: formatLabel(format, lang) }) }]} /> : null;
}

function SuggestionRow({ rank, item, quickLabel, actionLabel, replacing, picked, selected, onSelect, onAction, format }: {
  /** Riga scelta dalla ricerca (Invio la aggiunge). */
  picked?: boolean;
  /** Riga mostrata nel dettaglio. */
  selected: boolean;
  onSelect: () => void;
  quickLabel: string;
  actionLabel: string;
  replacing: boolean;
  format: Format;
  rank: number;
  item: Suggestion | Replacement;
  onAction: () => void;
}) {
  const tr = useT();
  const lang = useLang();
  const diff = 'diff' in item ? item.diff : null;
  const changes = diff ? describeDiff(diff, lang) : null;
  const diffText = changes
    ? [...changes.pros.map(p => `+${p}`), ...changes.cons.map(c => `−${c}`)].join(' · ') || tr('suggest.noDifference')
    : null;
  // La riga sotto il nome; le etichette uguali a questa riga non si ripetono
  const summaryText = diffText ?? item.reasons[0]?.text ?? '';
  const types = getSpecies(item.species)?.types ?? [];
  const tags = item.tags.filter(tag => tag !== summaryText);
  const className = ['suggestion', rank === 1 && 'first', selected && 'selected', picked && 'picked'].filter(Boolean).join(' ');
  return (
    // Tutta la riga apre il dettaglio col mouse; da tastiera lo fa il nome
    <li className={className} onClick={onSelect}>
      <span className="rank" aria-hidden="true">{rank}</span>
      <Sprite species={item.species} item={item.set.item} size={48} />
      <span className="who">
        <span className="name-line">
          <button type="button" className="pick" aria-pressed={selected} onClick={e => { e.stopPropagation(); onSelect(); }}>
            <strong><span className="visually-hidden">{rank}. </span>{item.species}</strong>
          </button>
          <BanMark species={item.species} format={format} />
          <StatsBadge species={item.species} item={item.set.item} />
        </span>
        <span className="types">{types.map(type => <TypeChip key={type} type={type} />)}</span>
        <small><Typed text={summaryText} /></small>
        {tags.length > 0 && (
          <span className="tags">
            {tags.map(tag => (tag.startsWith('⚠')
              ? <span key={tag} className="tag warn"><Icon name="warning" /><span>{tag.replace(/^⚠\s*/, '')}</span></span>
              : <span key={tag} className="tag">{tag}</span>))}
          </span>
        )}
      </span>
      <span className="score" aria-label={tr('suggest.score', { n: item.score })}>{item.score}</span>
      <button
        type="button"
        className="quick"
        aria-label={quickLabel}
        title={actionLabel}
        onClick={e => { e.stopPropagation(); onAction(); }}
      >
        <Icon name={replacing ? 'swap' : 'plus'} />
      </button>
    </li>
  );
}

/** Il valore si aggiorna solo dopo `delay` ms senza modifiche (per non ricalcolare a ogni lettera). */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export const SEARCH_DELAY = 200;

export function SuggestionsPanel({ team, format, data, replaceIndex, onAdd, onReplaceWith, onCancelReplace, onPreview, rating = null }: Props) {
  const tr = useT();
  const lang = useLang();
  const [mode, setMode] = useState<ReplaceMode>('improve');
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  // La lista si ricalcola sui filtri "stabili"; l'input mostra subito quello che scrivi
  const applied = useDebounced(filters, SEARCH_DELAY);
  const filtering = isFiltering(applied);
  const replacing = replaceIndex !== null && replaceIndex < team.length;
  /** Il team contro cui si valutano i candidati è vuoto: niente adattamento da mostrare. */
  const emptyTeam = (replacing ? team.length - 1 : team.length) === 0;

  const items: (Suggestion | Replacement)[] = useMemo(() => {
    if (replacing) {
      // Con ricerca o filtri i sostituti vengono da tutto il Pokédex, non solo dalle statistiche
      const pool = filtering ? searchPool(team.filter((_, i) => i !== replaceIndex), format, data, applied) : undefined;
      if (!pool && !data.stats) return [];
      return mode === 'improve'
        ? improveReplacements(team, replaceIndex, format, data, MAX, pool, lang)
        : similarReplacements(team, replaceIndex, format, data, MAX, pool, lang);
    }
    if (filtering) return searchCandidates(team, format, data, applied, MAX, lang);
    return data.stats ? suggest(team, format, data, MAX, lang) : [];
  }, [team, format, data, replacing, replaceIndex, mode, applied, filtering, lang]);

  const query = filters.query.trim();
  // I risultati valgono solo se la lista è già aggiornata su quello che hai scritto
  const fresh = !!query && applied.query.trim() === query;
  const exact = getSpecies(query);
  // Riga scelta con le frecce; null: il nome esatto se c'è, altrimenti il primo risultato
  const [cursor, setCursor] = useState<number | null>(null);
  // Riga aperta nel dettaglio col clic; null: quella scelta dalla ricerca o la prima della pagina
  const [selectedName, setSelectedName] = useState<string | null>(null);
  useEffect(() => { setCursor(null); setSelectedName(null); setPage(0); }, [items]);
  const pages = Math.ceil(items.length / PAGE);
  const pageItems = items.slice(page * PAGE, (page + 1) * PAGE);
  const chosen = fresh && cursor !== null ? items[cursor] : undefined;
  const fallback = fresh ? items[0] : undefined;
  const pickedIndex = !fresh ? -1
    : cursor ?? (exact ? items.findIndex(item => item.species === exact.name) : 0);
  /** Invio: la riga scelta con le frecce, altrimenti il nome esatto, altrimenti il primo risultato. */
  const pickFromSearch = () => {
    const set = chosen?.set ?? (exact ? defaultSet(data, exact.name, format.genLimit) : fallback?.set);
    if (!set) return;
    if (replacing) onReplaceWith(replaceIndex, set);
    else onAdd(set);
    setFilters({ ...filters, query: '' });
  };
  const target = chosen?.species ?? exact?.name ?? fallback?.species;
  const listRef = useRef<HTMLOListElement>(null);
  /** Frecce: passa al risultato successivo o precedente, tenendolo in vista. */
  const moveCursor = (delta: number) => {
    const first = page * PAGE;
    const last = Math.min(items.length, first + PAGE) - 1;
    if (!fresh || last < first) return;
    const next = Math.min(last, Math.max(first, Math.max(pickedIndex, first) + delta));
    setCursor(next);
    setSelectedName(null);
    listRef.current?.children[next - first]?.scrollIntoView?.({ block: 'nearest' });
  };
  const goToPage = (next: number) => {
    setPage(next);
    setCursor(null);
    setSelectedName(null);
  };
  const selected = pageItems.find(item => item.species === selectedName)
    ?? (pickedIndex >= page * PAGE && pickedIndex < (page + 1) * PAGE ? items[pickedIndex] : undefined)
    ?? pageItems[0];
  const selectedRank = selected ? items.indexOf(selected) + 1 : 0;
  const act = (item: Suggestion | Replacement) => (replacing ? onReplaceWith(replaceIndex, item.set) : onAdd(item.set));
  /** Apre il candidato nel dettaglio; in sostituzione il coaching mostra il sostituto scelto. */
  const select = (item: Suggestion | Replacement) => {
    setSelectedName(item.species);
    if (replacing && 'diff' in item && onPreview) {
      onPreview({
        index: replaceIndex,
        replacement: item.species,
        set: item.set,
        score: item.score,
        similar: similarity(team[replaceIndex], item.set, formatRules(format.formatId)) >= SIMILAR_THRESHOLD,
        ratingGain: ratingGainOf(team, replaceIndex, item.set, data),
        diff: item.diff,
      }, true);
    }
  };

  const title = replacing ? tr('suggest.replaceTitle', { species: team[replaceIndex].species }) : tr('suggest.title');

  // Sostituendo un setter di cui altri membri hanno bisogno, si mostrano solo setter della stessa condizione
  let setterNote: string | null = null;
  if (replacing) {
    const needed = neededConditions(team, replaceIndex);
    if (needed.length) {
      const labels = needed.map(n => conditionLabel(n.condition, lang)).join(` ${tr('suggest.and')} `);
      const who = [...new Set(needed.flatMap(n => n.beneficiaries.map(b => b.species)))].join(', ');
      setterNote = items.length > 0 && items.every(item => providesAll(item.set, needed))
        ? tr('suggest.setterOnly', { conditions: labels, who })
        : tr('suggest.setterNone', {
          conditions: labels,
          species: team[replaceIndex].species,
          losses: needed.flatMap(n => n.beneficiaries.map(b => tr('suggest.loses', { species: b.species, via: viaName(b.via, lang) }))).join(', '),
        });
    }
  }

  const full = !replacing && team.length >= 6;
  const search = full ? null : (
    <>
      <div className="search">
        <span className={`search-field${target ? ' has-hint' : ''}`}>
          <Icon name="search" />
          <input
            aria-label={tr('suggest.search')}
            aria-describedby={target ? 'search-hint' : undefined}
            placeholder={tr('suggest.searchPlaceholder')}
            value={filters.query}
            onChange={e => setFilters({ ...filters, query: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') pickFromSearch();
              else if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); }
              else if (e.key === 'Escape') setFilters({ ...filters, query: '' });
            }}
          />
          {target && (
            // Dentro il campo, a destra: comparendo non sposta il resto
            <span id="search-hint" className="search-hint">
              <kbd>{tr('suggest.enter')}</kbd> {tr(replacing ? 'suggest.enterReplaces' : 'suggest.enterAdds')} <strong>{target}</strong>
            </span>
          )}
          {filters.query && (
            <button type="button" className="clear" aria-label={tr('suggest.clear')} onClick={() => setFilters({ ...filters, query: '' })}>
              <Icon name="close" />
            </button>
          )}
        </span>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
    </>
  );

  // Il numero di risultati, sopra la lista quando si cerca o si filtra
  const countText = `${items.length === 1 ? tr('suggest.resultsOne') : tr('suggest.resultsMany', { n: items.length })}${items.length === MAX ? tr('suggest.best') : ''}`;

  let body;
  if (full) {
    body = <p>{tr('suggest.full')}</p>;
  } else if (!data.stats && !filtering) {
    body = <p>{tr('suggest.needData')}</p>;
  } else if (filtering && items.length === 0) {
    body = <p className="note">{tr('suggest.noMatch')}</p>;
  } else {
    body = (
      <>
        {filtering && <p className="visually-hidden" aria-live="polite">{tr('suggest.resultsAria', { text: countText })}</p>}
        {setterNote && <p className="note">{setterNote}</p>}
        {emptyTeam && (
          <p className="note">{tr('suggest.emptyTeam')}</p>
        )}
        {filtering && <p className="list-count">{countText}</p>}
        <ol className="suggestions" ref={listRef}>
          {pageItems.map((item, i) => (
            <SuggestionRow
              key={item.species}
              picked={page * PAGE + i === pickedIndex}
              selected={item === selected}
              onSelect={() => select(item)}
              rank={page * PAGE + i + 1}
              item={item}
              actionLabel={tr(replacing ? 'suggest.replaceWith' : 'suggest.add')}
              quickLabel={replacing ? tr('suggest.replaceQuick', { species: item.species }) : tr('suggest.addQuick', { species: item.species })}
              replacing={replacing}
              onAction={() => act(item)}
              format={format}
            />
          ))}
        </ol>
        {pages > 1 && (
          <nav className="pager" aria-label={tr('suggest.pages')}>
            <button type="button" className="step" aria-label={tr('suggest.prev')} disabled={page === 0} onClick={() => goToPage(page - 1)}>
              <Icon name="prev" />
            </button>
            {Array.from({ length: pages }, (_, n) => (
              <button key={n} type="button" aria-label={tr('suggest.page', { n: n + 1 })} aria-current={n === page ? 'page' : undefined}
                onClick={() => goToPage(n)}>
                {n + 1}
              </button>
            ))}
            <button type="button" className="step" aria-label={tr('suggest.next')} disabled={page === pages - 1} onClick={() => goToPage(page + 1)}>
              <Icon name="next" />
            </button>
          </nav>
        )}
      </>
    );
  }

  return (
    <section aria-label={tr('suggest.title')} className={`suggestions-panel${selected && !full ? ' has-detail' : ''}`}>
      <div className="picker">
      <h2>{title}</h2>
      {replacing && (
        <div className="actions" role="group" aria-label={tr('suggest.mode')}>
          <button type="button" aria-pressed={mode === 'improve'} onClick={() => setMode('improve')}>{tr('suggest.improve')}</button>
          <button type="button" aria-pressed={mode === 'similar'} onClick={() => setMode('similar')}>{tr('suggest.similar')}</button>
          <button type="button" onClick={onCancelReplace}>{tr('suggest.cancel')}</button>
        </div>
      )}
      {search}
      {body}
      </div>
      {selected && !full && (
        <SuggestionDetail
          key={selected.species}
          item={selected}
          rank={selectedRank}
          team={team}
          replaceIndex={replacing ? replaceIndex : null}
          data={data}
          rating={rating}
          emptyTeam={emptyTeam}
          banMark={<BanMark species={selected.species} format={format} />}
          actionLabel={tr(replacing ? 'suggest.replaceWith' : 'suggest.add')}
          onAction={() => act(selected)}
        />
      )}
    </section>
  );
}
