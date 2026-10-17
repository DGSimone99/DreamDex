import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineData } from '../engine/data';
import type { Format } from '../engine/format';
import { formatRules } from '../engine/formatRules';
import { improveReplacements, similarity, similarReplacements, type Replacement } from '../engine/replace';
import { describeDiff, ratingGainOf, SIMILAR_THRESHOLD, type SwapPreview } from '../engine/coach';
import { suggest, type Suggestion } from '../engine/scoring';
import { exportShowdown, type TeamSet } from '../engine/sets';
import { getSpecies } from '../engine/dex';
import { formatLabel } from '../engine/formats';
import { EMPTY_FILTERS, isFiltering, searchCandidates, searchPool, tierLabel, type CandidateFilters } from '../engine/filters';
import { memberPower } from '../engine/power';
import { defaultSet } from '../engine/sets';
import { FilterBar } from './FilterBar';
import { conditionLabel, neededConditions, providesAll, viaName } from '../engine/synergy';
import { copyText } from './clipboard';
import { Sprite, TypeChip } from './Sprite';
import { Icon } from './icons';
import { ProsCons } from './ProsCons';
import { StatsBadge } from './StatsBadge';
import { PokemonName } from './PokemonName';
import { AlertMark } from './AlertMark';
import { Typed } from './TypeText';
import { t, type MessageKey } from '../i18n';
import { useLang, useT } from '../i18n/react';

/** Barre mostrate sulle carte: come il candidato si adatta al team, più le sue statistiche. */
const FIT_BARS: { key: 'defense' | 'coverage' | 'roles'; label: MessageKey }[] = [
  { key: 'defense', label: 'suggest.col.defense' },
  { key: 'coverage', label: 'suggest.col.coverage' },
  { key: 'roles', label: 'suggest.col.roles' },
];
const PAGE = 10;
const MAX = 20;

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
}

/** Solo se il Pokémon è bannato nel formato: triangolo rosso con il tier nel tooltip. */
function BanMark({ species, format }: { species: string; format: Format }) {
  const lang = useLang();
  const { label, banned } = tierLabel(species, format);
  return banned ? <AlertMark alerts={[{ level: 'danger', text: t(lang, 'suggest.banned', { tier: label, format: formatLabel(format, lang) }) }]} /> : null;
}

function SuggestionItem({ rank, item, actionLabel, quickLabel, replacing, member, picked, onAction, onToggle, emptyTeam, format }: {
  /** Riga scelta dalla ricerca (Invio la aggiunge). */
  picked?: boolean;
  /** Il membro che questo candidato sostituirebbe. */
  member?: string;
  onToggle?: (open: boolean) => void;
  emptyTeam: boolean;
  quickLabel: string;
  replacing: boolean;
  format: Format;
  rank: number;
  item: Suggestion | Replacement;
  actionLabel: string;
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
  const setText = exportShowdown([item.set]);
  const types = getSpecies(item.species)?.types ?? [];
  return (
    <li className={picked ? 'picked' : undefined}>
      <details className="suggestion" name="suggestion" onToggle={e => onToggle?.(e.currentTarget.open)}>
        <summary>
          <span className="rank" aria-hidden="true">{rank}</span>
          <Sprite species={item.species} item={item.set.item} size={64} />
          <span className="who">
            <span className="name-line">
              <strong><span className="visually-hidden">{rank}. </span>{item.species}</strong>
              <BanMark species={item.species} format={format} />
              <StatsBadge species={item.species} item={item.set.item} />
            </span>
            <span className="types">{types.map(type => <TypeChip key={type} type={type} />)}</span>
            <small><Typed text={summaryText} /></small>
            <span className="tags">
              {item.tags.filter(tag => tag !== summaryText).map(tag => (tag.startsWith('⚠')
                ? <span key={tag} className="tag warn"><Icon name="warning" />{tag.replace(/^⚠\s*/, '')}</span>
                : <span key={tag} className="tag">{tag}</span>))}
            </span>
          </span>
          <dl className="bars">
            {FIT_BARS.map(bar => (emptyTeam
              ? <div key={bar.key} className="bar-empty" aria-hidden="true" />
              : (
                <div key={bar.key}>
                  <dt>{tr(bar.label)}</dt>
                  <dd><meter min={0} max={1} value={item.components[bar.key]} /></dd>
                </div>
              )))}
            <div>
              <dt>{tr('suggest.col.stats')}</dt>
              <dd><meter min={0} max={100} value={memberPower(item.set)?.power ?? 0} /></dd>
            </div>
          </dl>
          <span className="score" aria-label={tr('suggest.score', { n: item.score })}>{item.score}</span>
          <button
            type="button"
            className="quick"
            aria-label={quickLabel}
            title={actionLabel}
            onClick={e => { e.preventDefault(); onAction(); }}
          >
            <Icon name={replacing ? 'swap' : 'plus'} />
          </button>
        </summary>
        {'similarity' in item && item.similarity !== undefined && (
          <p>{tr('suggest.similarity', { pct: Math.round(item.similarity * 100) })}</p>
        )}
        {changes && member && (
          <p className="swap-head replaces">
            <PokemonName name={member} muted />
            <Icon name="arrow" />
            <span className="visually-hidden">{tr('coach.with')}</span>
            <PokemonName name={item.species} />
          </p>
        )}
        {changes && <ProsCons pros={changes.pros} cons={changes.cons} />}
        <ul className="reasons">{item.reasons.map(reason => <li key={reason.text}><Typed text={reason.text} /></li>)}</ul>
        <pre className="set">{setText}</pre>
        <div className="actions">
          <button type="button" className={rank === 1 ? 'primary' : undefined} onClick={onAction}>{actionLabel}</button>
          <button type="button" onClick={() => copyText(setText)}>{tr('suggest.copySet')}</button>
        </div>
      </details>
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

export function SuggestionsPanel({ team, format, data, replaceIndex, onAdd, onReplaceWith, onCancelReplace, onPreview }: Props) {
  const tr = useT();
  const lang = useLang();
  const [mode, setMode] = useState<ReplaceMode>('improve');
  const [limit, setLimit] = useState(PAGE);
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
  useEffect(() => setCursor(null), [items]);
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
    const last = Math.min(items.length, limit) - 1;
    if (!fresh || last < 0) return;
    const next = Math.min(last, Math.max(0, Math.max(pickedIndex, 0) + delta));
    setCursor(next);
    listRef.current?.children[next]?.scrollIntoView?.({ block: 'nearest' });
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
            onChange={e => { setFilters({ ...filters, query: e.target.value }); setLimit(PAGE); }}
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
      <FilterBar filters={filters} onChange={next => { setFilters(next); setLimit(PAGE); }} />
    </>
  );

  // Il numero di risultati sta nell'intestazione della classifica: comparendo non sposta la lista
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
        <div className="board-head" aria-hidden="true">
          <span>#</span><span />
          <span>{tr('suggest.col.pokemon')}{filtering && <span className="count">{countText}</span>}</span>
          {([
            ['suggest.col.defense', 'suggest.col.defenseShort'], ['suggest.col.coverage', 'suggest.col.coverageShort'],
            ['suggest.col.roles', 'suggest.col.roles'], ['suggest.col.stats', 'suggest.col.statsShort'], ['suggest.col.points', 'suggest.col.points'],
          ] as [MessageKey, MessageKey][]).map(([long, short]) => (
            <span key={long}><span className="long">{tr(long)}</span><span className="short">{tr(short)}</span></span>
          ))}
          <span />
        </div>
        <ol className="suggestions" ref={listRef}>
          {items.slice(0, limit).map((item, i) => (
            <SuggestionItem
              key={item.species}
              picked={i === pickedIndex}
              rank={i + 1}
              item={item}
              actionLabel={tr(replacing ? 'suggest.replaceWith' : 'suggest.add')}
              quickLabel={replacing ? tr('suggest.replaceQuick', { species: item.species }) : tr('suggest.addQuick', { species: item.species })}
              replacing={replacing}
              member={replacing ? team[replaceIndex].species : undefined}
              onAction={() => (replacing ? onReplaceWith(replaceIndex, item.set) : onAdd(item.set))}
              onToggle={replacing && 'diff' in item && onPreview ? open => onPreview({
                index: replaceIndex,
                replacement: item.species,
                set: item.set,
                score: item.score,
                similar: similarity(team[replaceIndex], item.set, formatRules(format.formatId)) >= SIMILAR_THRESHOLD,
                ratingGain: ratingGainOf(team, replaceIndex, item.set, data),
                diff: item.diff,
              }, open) : undefined}
              emptyTeam={emptyTeam}
              format={format}
            />
          ))}
        </ol>
        {items.length > limit && (
          <button type="button" onClick={() => setLimit(MAX)}>
            {tr('suggest.more', { from: limit + 1, to: Math.min(MAX, items.length) })}
          </button>
        )}
      </>
    );
  }

  return (
    <section aria-label={tr('suggest.title')} className="suggestions-panel">
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
    </section>
  );
}
